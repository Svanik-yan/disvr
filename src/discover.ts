import OpenAI from "openai";
import type {
  Env, Service, DiscoverRequest, Recommendation,
  DiscoverResponse, SpendSummary,
} from "./types.js";
import { getServicesByIds, searchFTS, getServiceSignals, getHealthSummaryByIds } from "./db.js";
import { getBatchCooccurrences } from "./cooccurrence.js";
import { getBatchAlternatives } from "./alternatives.js";
import { matchScenarioFromQuery, getBenchmarkRankForService } from "./benchmark.js";
import { generateRiskNote } from "./error-taxonomy.js";
import { generateFailoverHint } from "./failover.js";
import type { ErrorType } from "./types.js";
import { buildContextFilter, applyContextBoost, generateContextReason } from "./context-aware.js";
import { shouldSuggestWatch } from "./watch.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const TOP_K_CANDIDATES = 50;
const TOP_N_RESULTS = 3;

// ─── Scoring Weights ───
// Core thesis: not just "find matching tools" but "find the best value for money"
//
//   value_score = f(semantic_match, quality, cost_efficiency, reliability)
//
// This is what separates us from directories (pure match) and routers (pure cost).
// Weights shift dynamically based on query intent keywords.

interface DynamicWeights {
  semantic: number;
  quality: number;
  cost_efficiency: number;
  reliability: number;
}

const DEFAULT_WEIGHTS: DynamicWeights = {
  semantic: 0.30,
  quality: 0.25,
  cost_efficiency: 0.25,
  reliability: 0.20,
};

const INTENT_KEYWORDS: Record<string, Partial<DynamicWeights>> = {
  // Cost-sensitive
  cheap: { cost_efficiency: 0.45, quality: 0.15 },
  free: { cost_efficiency: 0.45, quality: 0.15 },
  budget: { cost_efficiency: 0.40, quality: 0.15 },
  affordable: { cost_efficiency: 0.40, quality: 0.15 },
  // Reliability-sensitive
  reliable: { reliability: 0.40, cost_efficiency: 0.10 },
  production: { reliability: 0.40, cost_efficiency: 0.10 },
  stable: { reliability: 0.35, cost_efficiency: 0.15 },
  enterprise: { reliability: 0.35, cost_efficiency: 0.10 },
  // Quality-sensitive
  best: { quality: 0.40, cost_efficiency: 0.10 },
  accurate: { quality: 0.40, cost_efficiency: 0.10 },
  precise: { quality: 0.35, cost_efficiency: 0.15 },
  advanced: { quality: 0.35, cost_efficiency: 0.15 },
  // Speed-sensitive
  fast: { reliability: 0.35, quality: 0.15 },
  realtime: { reliability: 0.35, quality: 0.15 },
  low_latency: { reliability: 0.35, quality: 0.15 },
};

export function detectWeights(need: string): DynamicWeights {
  const lower = need.toLowerCase();
  for (const [keyword, overrides] of Object.entries(INTENT_KEYWORDS)) {
    const pattern = keyword.replace("_", "[\\s-]?");
    if (new RegExp(`\\b${pattern}\\b`).test(lower)) {
      return { ...DEFAULT_WEIGHTS, ...overrides };
    }
  }
  return { ...DEFAULT_WEIGHTS };
}

// ─── Elimination Filters ───
// Hard gate: drop services that can't meet minimum bar
// Soft penalty: degrade stale services' quality scores

export function applyEliminationFilters(
  candidates: Array<{ service: Service; similarity: number }>,
  now: Date = new Date()
): Array<{ service: Service; similarity: number }> {
  return candidates
    .filter(({ service }) => {
      // Hard elimination: reliability too low
      const reliability = service.uptime_30d ?? 1;
      return reliability >= 0.3;
    })
    .map((item) => {
      // Soft penalty: >180 days since last update, halve quality signals
      const updatedAt = (item.service as any).updated_at;
      if (updatedAt) {
        const daysSinceUpdate =
          (now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate > 180) {
          return {
            ...item,
            service: {
              ...item.service,
              reputation_score:
                item.service.reputation_score !== null
                  ? item.service.reputation_score * 0.5
                  : null,
            },
          };
        }
      }
      return item;
    });
}

export async function searchServices(
  env: Env,
  request: DiscoverRequest
): Promise<DiscoverResponse> {
  const queryId = crypto.randomUUID();

  // Step 1: Get embedding
  const embedding = await embedQuery(env, request.need);

  let candidates: Array<{ service: Service; similarity: number }>;

  if (embedding) {
    candidates = await vectorSearch(env, embedding);

    // Hybrid: supplement vector results with FTS to catch services not yet embedded
    const ftsResults = await searchFTS(env.DB, request.need, TOP_K_CANDIDATES);
    const vectorIds = new Set(candidates.map((c) => c.service.id));
    const ftsOnly = ftsResults.filter((s) => !vectorIds.has(s.id));
    if (ftsOnly.length > 0) {
      // FTS-only results get a capped similarity (max 0.65) — they matched keywords but have no semantic score
      candidates.push(
        ...ftsOnly.map((s, i) => ({
          service: s,
          similarity: Math.max(0.3, 0.65 - i * 0.02),
        }))
      );
    }

    // If vector search returned nothing at all, FTS is primary
    if (vectorIds.size === 0 && candidates.length === 0) {
      console.log("Vector search returned 0 results, FTS is primary");
    }
  } else {
    console.log("Embedding failed, using FTS fallback");
    const ftsResults = await searchFTS(env.DB, request.need, TOP_K_CANDIDATES);
    // FTS-only: capped similarity scores
    candidates = ftsResults.map((s, i) => ({
      service: s,
      similarity: Math.max(0.3, 0.65 - i * 0.02),
    }));
  }

  if (candidates.length === 0) {
    return { recommendations: [], query_id: queryId, spend_summary: null };
  }

  // Step 2: Apply constraints
  let filtered = applyConstraints(candidates, request);

  // Step 2b: Context-aware exclusion — remove tools the agent already has
  const contextFilter = buildContextFilter(request.current_tools, request.exclude);
  if (contextFilter.exclude.length > 0) {
    const excludeSet = new Set(contextFilter.exclude);
    filtered = filtered.filter((c) => !excludeSet.has(c.service.id));
  }

  // Step 3: Pre-fetch passive signals for candidate services
  const candidateIds = filtered.map((c) => c.service.id);
  const signals = await getServiceSignals(env.DB, candidateIds);

  // Step 4: Rank by value (not just relevance) — weights shift by query intent
  const ranked = rankServices(filtered, request.need, signals);
  const topN = ranked.slice(0, TOP_N_RESULTS);

  // Step 4: Build recommendations with spend intelligence + health info
  const topIds = topN.map((item) => item.service.id);
  const [healthMap, cooccurrenceMap, alternativesMap] = await Promise.all([
    getHealthSummaryByIds(env.DB, topIds),
    getBatchCooccurrences(env.DB, topIds),
    getBatchAlternatives(env.DB, topIds),
  ]);

  const recommendations: Recommendation[] = topN.map((item) => {
    const rec = buildRecommendation(item.service, item.similarity, item.valueScore, request);
    const healthInfo = healthMap.get(item.service.id);
    const coItems = cooccurrenceMap.get(item.service.id);
    const alts = alternativesMap.get(item.service.id);
    return {
      ...rec,
      ...(healthInfo?.last_check_at
        ? {
            health: {
              status: healthInfo.status,
              uptime_30d: healthInfo.uptime_30d,
              last_checked: healthInfo.last_check_at,
              ...(healthInfo.install_score !== null ? { install_score: healthInfo.install_score } : {}),
              ...(healthInfo.install_difficulty ? { install_difficulty: healthInfo.install_difficulty } : {}),
              ...(healthInfo.call_success_rate !== null ? { call_success_rate: healthInfo.call_success_rate } : {}),
              ...(healthInfo.probe_type ? { probe_type: healthInfo.probe_type } : {}),
            },
          }
        : {}),
      ...(coItems && coItems.length > 0
        ? { commonly_used_with: coItems }
        : {}),
      ...(alts && alts.length > 0
        ? {
            deprecation_warning: {
              status: healthInfo?.status ?? "degraded",
              message: `This tool is ${healthInfo?.status ?? "degraded"}. Consider these alternatives.`,
              alternatives: alts,
            },
          }
        : {}),
      ...(item.service.pricing_model && item.service.pricing_model !== "unknown"
        ? {
            cost: {
              pricing_model: item.service.pricing_model,
              cost_per_call: item.service.cost_per_call ?? null,
              free_tier_limit: item.service.free_tier_limit ?? null,
              monthly_price: item.service.monthly_price ?? null,
            },
          }
        : {}),
      ...(() => {
        if (!healthInfo || healthInfo.error_count_30d < 3 || !healthInfo.primary_error_type) return {};
        const riskNote = generateRiskNote(healthInfo.primary_error_type as ErrorType, healthInfo.error_count_30d);
        if (!riskNote) return {};
        return {
          error_profile: {
            primary_error: healthInfo.primary_error_type as ErrorType,
            error_count_30d: healthInfo.error_count_30d,
            risk_note: riskNote,
          },
        };
      })(),
      ...(() => {
        if (!healthInfo?.recent_breaking_change || !healthInfo.last_version_change || !healthInfo.current_version) return {};
        const changedAt = new Date(healthInfo.last_version_change);
        const now = new Date();
        const daysSinceChange = (now.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceChange > 7) return {};
        return {
          version_warning: {
            current_version: healthInfo.current_version,
            previous_version: "", // filled from version_history if needed
            changed_at: healthInfo.last_version_change.slice(0, 10),
            message: `Breaking change detected ${Math.round(daysSinceChange)} day${Math.round(daysSinceChange) !== 1 ? "s" : ""} ago. Consider pinning to previous version.`,
          },
        };
      })(),
      ...(() => {
        if (!healthInfo || !healthInfo.primary_error_type || healthInfo.error_count_30d < 5) return {};
        return { failover_hint: generateFailoverHint(healthInfo.primary_error_type) };
      })(),
      ...(shouldSuggestWatch(
        healthInfo?.status,
        healthInfo?.recent_breaking_change,
        healthInfo?.error_count_30d
      )
        ? { watch_suggestion: "This tool has had recent issues. Use POST /api/watch to subscribe to health alerts." }
        : {}),
    };
  });

  // Step 4b: Context-aware boost — boost tools that co-occur with agent's current stack
  if (contextFilter.current_tools.length > 0 && recommendations.length > 0) {
    const boosted = await applyContextBoost(
      env.DB,
      recommendations.map((r) => ({ id: r.service_id, value_score: r.value_score })),
      contextFilter.current_tools
    );
    for (const b of boosted) {
      const rec = recommendations.find((r) => r.service_id === b.id);
      if (rec && b.context_boost > 0) {
        rec.value_score = b.value_score;
        rec.context_boost = b.context_boost;
        const reason = generateContextReason(rec.service, b.cooccurring_tools);
        if (reason) {
          rec.context_reason = reason;
        }
      }
    }
  }

  // Step 5: Apply call_success_rate adjustments + error penalties + tiebreaker
  for (const rec of recommendations) {
    const rate = rec.health?.call_success_rate;
    if (rate !== undefined && rate !== null) {
      if (rate >= 0.8) {
        rec.value_score = Math.round(Math.min(1, rec.value_score + 0.1) * 100) / 100;
      } else if (rate < 0.3) {
        rec.value_score = Math.round((rec.value_score * 0.5) * 100) / 100;
      }
    }

    // Error-based ranking penalties
    if (rec.error_profile) {
      const { primary_error, error_count_30d } = rec.error_profile;
      if (error_count_30d >= 10 && primary_error === "deprecated") {
        rec.value_score = Math.round(Math.max(0, rec.value_score - 0.2) * 100) / 100;
      } else if (error_count_30d >= 10 && primary_error === "server_error") {
        rec.value_score = Math.round(Math.max(0, rec.value_score - 0.15) * 100) / 100;
      }
      // rate_limited with count >= 5: no penalty, risk_note already attached
    }

    // Breaking change penalty: -0.1 if within 3 days
    if (rec.version_warning) {
      const changedAt = new Date(rec.version_warning.changed_at);
      const daysSince = (Date.now() - changedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 3) {
        rec.value_score = Math.round(Math.max(0, rec.value_score - 0.1) * 100) / 100;
      }
    }
  }
  recommendations.sort((a, b) => {
    const diff = b.value_score - a.value_score;
    if (Math.abs(diff) < 0.01) {
      const aInstall = a.health?.install_score ?? 0;
      const bInstall = b.health?.install_score ?? 0;
      return bInstall - aInstall;
    }
    return diff;
  });

  // Step 6: Attach benchmark rank if a matching scenario exists
  const matchedScenario = matchScenarioFromQuery(request.need);
  if (matchedScenario) {
    const benchRanks = await Promise.all(
      recommendations.map((rec) =>
        getBenchmarkRankForService(env.DB, rec.service_id, matchedScenario.id)
      )
    );
    for (let i = 0; i < recommendations.length; i++) {
      if (benchRanks[i]) {
        (recommendations[i] as any).benchmark_rank = {
          scenario: matchedScenario.name,
          rank: benchRanks[i]!.rank,
          score: benchRanks[i]!.score,
        };
      }
    }
  }

  // Step 7: Spend summary
  const spendSummary = buildSpendSummary(ranked, request);

  return { recommendations, query_id: queryId, spend_summary: spendSummary };
}

// ─── Embedding ───

export async function embedQuery(
  env: Env,
  text: string
): Promise<number[] | null> {
  const hash = await hashText(text);
  const cached = await env.DB.prepare(
    "SELECT embedding FROM query_cache WHERE query_hash = ?1"
  )
    .bind(hash)
    .first<{ embedding: ArrayBuffer }>();

  if (cached?.embedding) {
    return Array.from(new Float32Array(cached.embedding));
  }

  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const vector = response.data[0].embedding;

    const buffer = new Float32Array(vector).buffer;
    await env.DB.prepare(
      "INSERT OR REPLACE INTO query_cache (query_hash, embedding, created_at) VALUES (?1, ?2, datetime('now'))"
    )
      .bind(hash, buffer)
      .run();

    return vector;
  } catch (error) {
    console.error("Embedding failed, falling back to FTS:", error);
    return null;
  }
}

// ─── Vector Search ───

async function vectorSearch(
  env: Env,
  embedding: number[]
): Promise<Array<{ service: Service; similarity: number }>> {
  const vectorResults = await env.VECTORIZE.query(embedding, {
    topK: TOP_K_CANDIDATES,
    returnValues: false,
    returnMetadata: "none",
  });

  if (!vectorResults.matches || vectorResults.matches.length === 0) {
    return [];
  }

  const ids = vectorResults.matches.map((m) => m.id);
  const services = await getServicesByIds(env.DB, ids);

  const scoreMap = new Map<string, number>();
  for (const match of vectorResults.matches) {
    scoreMap.set(match.id, match.score ?? 0);
  }

  return services.map((s) => ({
    service: s,
    similarity: scoreMap.get(s.id) ?? 0,
  }));
}

// ─── Constraint Filtering ───

export function applyConstraints(
  candidates: Array<{ service: Service; similarity: number }>,
  request: DiscoverRequest
): Array<{ service: Service; similarity: number }> {
  return candidates.filter(({ service }) => {
    if (
      request.max_price_per_call !== undefined &&
      service.pricing.price_usd > request.max_price_per_call
    ) {
      return false;
    }
    if (
      request.max_latency_ms !== undefined &&
      service.latency_p95_ms !== null &&
      service.latency_p95_ms > request.max_latency_ms
    ) {
      return false;
    }
    if (
      request.min_reputation !== undefined &&
      (service.reputation_score === null ||
        service.reputation_score < request.min_reputation)
    ) {
      return false;
    }
    if (
      request.min_success_rate !== undefined &&
      (service.success_rate === null ||
        service.success_rate < request.min_success_rate)
    ) {
      return false;
    }
    // Cost constraints — unknown services pass through (avoid false elimination)
    if (request.max_cost_per_call !== undefined && service.cost_per_call !== null && service.cost_per_call !== undefined) {
      if (service.cost_per_call > request.max_cost_per_call) return false;
    }
    if (request.max_monthly_price !== undefined && service.monthly_price !== null && service.monthly_price !== undefined) {
      if (service.monthly_price > request.max_monthly_price) return false;
    }
    if (request.pricing_model) {
      const pm = service.pricing_model;
      if (pm && pm !== "unknown") {
        // "free" matches both "free" and "open_source"
        if (request.pricing_model === "free") {
          if (pm !== "free" && pm !== "open_source") return false;
        } else if (pm !== request.pricing_model) {
          return false;
        }
      }
      // pm is null or unknown → pass through
    }
    return true;
  });
}

// ─── Ranking: The Core Algorithm ───

interface RankedCandidate {
  service: Service;
  similarity: number;
  valueScore: number;
}

export function rankServices(
  candidates: Array<{ service: Service; similarity: number }>,
  need: string = "",
  signals: Map<string, Record<string, number>> = new Map()
): RankedCandidate[] {
  const weights = detectWeights(need);
  const filtered = applyEliminationFilters(candidates);

  const scored = filtered.map((item) => {
    const s = item.service;

    // 1. Semantic relevance (0-1)
    const semanticScore = item.similarity;

    // 2. Quality score (0-1): success rate + reputation
    const successNorm = s.success_rate ?? 0.5;
    const reputationNorm = (s.reputation_score ?? 2.5) / 5;
    let qualityScore = successNorm * 0.6 + reputationNorm * 0.4;

    // 3. Cost efficiency (0-1): lower cost_per_success = better
    //    For free services, perfect score. For paid, normalize against $1/call ceiling
    const costPerSuccess = s.avg_cost_per_success ?? s.pricing.price_usd;
    const costEfficiency = costPerSuccess <= 0
      ? 1.0
      : Math.max(0, 1 - costPerSuccess / 1.0);

    // 4. Reliability (0-1): uptime, low retry rate, low latency
    const uptimeNorm = s.uptime_30d ?? 0.5;
    const retryPenalty = 1 - (s.retry_rate ?? 0);
    const latencyNorm = s.latency_p95_ms !== null
      ? Math.max(0, 1 - s.latency_p95_ms / 10000)
      : 0.5;
    let reliabilityScore = uptimeNorm * 0.4 + retryPenalty * 0.35 + latencyNorm * 0.25;

    // 5. Apply passive signals (from cron-aggregated user behavior)
    const svcSignals = signals.get(s.id);
    if (svcSignals) {
      // repeat_search: negative signal → penalize reliability
      if (svcSignals.repeat_search) {
        reliabilityScore = Math.max(0, reliabilityScore + svcSignals.repeat_search);
      }
      // satisfied: positive signal → boost quality + reliability
      if (svcSignals.satisfied) {
        qualityScore = Math.min(1, qualityScore + svcSignals.satisfied);
        reliabilityScore = Math.min(1, reliabilityScore + svcSignals.satisfied);
      }
    }

    // Final value score — dynamic weights based on query intent
    let valueScore =
      weights.semantic * semanticScore +
      weights.quality * qualityScore +
      weights.cost_efficiency * costEfficiency +
      weights.reliability * reliabilityScore;

    // low_confidence: global multiplier (0.7–1.0)
    if (svcSignals?.low_confidence) {
      valueScore *= svcSignals.low_confidence;
    }

    return { ...item, valueScore };
  });

  scored.sort((a, b) => b.valueScore - a.valueScore);
  return scored;
}

// ─── Build Recommendation ───

function buildRecommendation(
  service: Service,
  similarity: number,
  valueScore: number,
  request: DiscoverRequest
): Recommendation {
  const protocols = service.protocols;
  const primaryProtocol = Object.keys(protocols)[0] ?? "unknown";
  const primaryEndpoint = protocols[primaryProtocol] ?? "";

  const costPerSuccess = service.avg_cost_per_success ?? service.pricing.price_usd;
  const estimatedTasks = request.budget_usd !== undefined && costPerSuccess > 0
    ? Math.floor(request.budget_usd / costPerSuccess)
    : null;

  return {
    service_id: service.id,
    service: service.name,
    summary: truncate(service.description, 120),
    platform: service.platform,
    type: service.service_type ?? "mcp_server",
    protocol: primaryProtocol,
    endpoint: primaryEndpoint,
    price_usd: service.pricing.price_usd,
    reputation: service.reputation_score,
    latency_p95_ms: service.latency_p95_ms,
    match_confidence: round2(similarity),
    total_calls: service.total_calls,
    success_rate: service.success_rate,
    cost_per_success: costPerSuccess > 0 ? round4(costPerSuccess) : null,
    value_score: round2(valueScore),
    retry_rate: service.retry_rate,
    estimated_tasks_per_budget: estimatedTasks,
    reason: generateReason(service, valueScore, similarity),
    ...(service.install ? { install: service.install } : {}),
  };
}

// ─── Spend Summary ───

function buildSpendSummary(
  ranked: RankedCandidate[],
  request: DiscoverRequest
): SpendSummary | null {
  if (ranked.length === 0) return null;

  const costs = ranked
    .map((r) => r.service.avg_cost_per_success ?? r.service.pricing.price_usd)
    .filter((c) => c > 0);

  if (costs.length === 0) {
    return {
      recommended_cost_usd: 0,
      cheapest_cost_usd: 0,
      best_quality_cost_usd: 0,
      budget_estimate: null,
    };
  }

  const recommendedCost = costs[0];
  const cheapestCost = Math.min(...costs);

  // Best quality = highest value_score that has a cost
  const bestQualityItem = ranked.find(
    (r) => (r.service.avg_cost_per_success ?? r.service.pricing.price_usd) > 0
  );
  const bestQualityCost = bestQualityItem
    ? bestQualityItem.service.avg_cost_per_success ?? bestQualityItem.service.pricing.price_usd
    : cheapestCost;

  const budgetEstimate = request.budget_usd !== undefined && recommendedCost > 0
    ? { budget_usd: request.budget_usd, estimated_calls: Math.floor(request.budget_usd / recommendedCost) }
    : null;

  return {
    recommended_cost_usd: round4(recommendedCost),
    cheapest_cost_usd: round4(cheapestCost),
    best_quality_cost_usd: round4(bestQualityCost),
    budget_estimate: budgetEstimate,
  };
}

// ─── Reason Generation ───

export function generateReason(
  service: Service,
  valueScore: number,
  similarity: number
): string {
  const parts: string[] = [];

  // Match quality
  if (similarity > 0.85) {
    parts.push("Highly relevant");
  } else if (similarity > 0.7) {
    parts.push("Good match");
  } else if (similarity > 0.5) {
    parts.push("Partial match");
  } else {
    parts.push("Keyword match");
  }

  // Spend efficiency
  if (service.avg_cost_per_success !== null) {
    if (service.avg_cost_per_success === 0) {
      parts.push("free");
    } else {
      parts.push(`$${service.avg_cost_per_success.toFixed(4)}/success`);
    }
  } else if (service.pricing.price_usd === 0) {
    parts.push("free");
  } else {
    parts.push(`$${service.pricing.price_usd}/call`);
  }

  // Quality signals
  if (service.success_rate !== null && service.success_rate > 0.95) {
    parts.push(`${(service.success_rate * 100).toFixed(1)}% success`);
  }

  if (service.retry_rate !== null && service.retry_rate < 0.05) {
    parts.push("rarely needs retry");
  } else if (service.retry_rate !== null && service.retry_rate > 0.2) {
    parts.push(`${(service.retry_rate * 100).toFixed(0)}% retry rate`);
  }

  // Volume
  if (service.total_calls > 10000) {
    parts.push(`${(service.total_calls / 1000).toFixed(0)}k+ calls`);
  } else if (service.total_calls > 0) {
    parts.push(`${service.total_calls} calls`);
  }

  // Value verdict
  if (valueScore > 0.8) {
    parts.push("best value");
  } else if (valueScore > 0.6) {
    parts.push("good value");
  }

  return parts.join(", ");
}

// ─── Helpers ───

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
