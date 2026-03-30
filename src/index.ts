import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, DiscoverRequest, CallReport } from "./types.js";
import { searchServices } from "./discover.js";
import { validateApiKey, incrementUsage, getRateLimit, getServiceCount, insertCallReport, getServicesPaginated, getSystemStats, createApiKey, getKeyCountByEmail, logRequest, getRequestStats, aggregateDailyStats, getServiceDetail, getServiceHealth, getHealthOverview, cleanupOldHealthChecks } from "./db.js";
import { crawlSmithery, crawlAwesomeMcp, crawlMcpRegistry, enrichGitHubStars, embedAndIndex } from "./crawl.js";
import { runHealthChecks } from "./health.js";
import { runCooccurrenceAggregation, getCooccurrences } from "./cooccurrence.js";
import { getAlternatives, getDeprecationOverview } from "./alternatives.js";
import { runLiveProbes } from "./probe.js";
import { seedScenarios, runFullBenchmark, getScenarioLeaderboard, getBenchmarkOverview, matchScenarioFromQuery, getBenchmarkRankForService } from "./benchmark.js";
import { runCostExtraction } from "./cost.js";
import { runErrorClassification, cleanupOldErrors } from "./error-taxonomy.js";
import { runVersionChecks, getVersionHistory, getRecentBreakingChanges } from "./changelog.js";
import { recordDiscovery, recordReport, aggregateProfiles, getAgentProfile, personalizeRanking, getFailedTools, cleanupInactiveProfiles } from "./agent-profile.js";
import { getFailoverAdvice } from "./failover.js";
import { DEFAULT_SCENARIOS } from "./benchmark-scenarios.js";
import { enrichServices } from "./enrich.js";
import { runSignalAggregation } from "./signals.js";
import { getAllServices } from "./db.js";
import { DisvrMcpAgent } from "./mcp.js";
import { landingPageHtml } from "./landing.js";
import { registryPageHtml } from "./pages/registry.js";
import { explorerPageHtml } from "./pages/explorer.js";
import { analyticsPageHtml } from "./pages/analytics.js";
import { keysPageHtml } from "./pages/keys.js";
import { benchmarkPageHtml } from "./pages/benchmark.js";
import { serviceDetailPageHtml } from "./pages/service-detail.js";
import { FAVICON_32_B64, APPLE_TOUCH_B64, ICON_192_B64 } from "./icons.js";

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use("*", cors());

// Favicon & icons
app.get("/favicon.ico", (c) => {
  const buf = Uint8Array.from(atob(FAVICON_32_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});
app.get("/favicon.png", (c) => {
  const buf = Uint8Array.from(atob(FAVICON_32_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});
app.get("/apple-touch-icon.png", (c) => {
  const buf = Uint8Array.from(atob(APPLE_TOUCH_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});
app.get("/icon-192.png", (c) => {
  const buf = Uint8Array.from(atob(ICON_192_B64), (ch) => ch.charCodeAt(0));
  return c.body(buf, 200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" });
});

// Landing page
app.get("/", (c) => {
  return c.html(landingPageHtml);
});

// Pages
app.get("/registry", (c) => c.html(registryPageHtml));
app.get("/explorer", (c) => c.html(explorerPageHtml));
app.get("/analytics", (c) => c.html(analyticsPageHtml));
app.get("/keys", (c) => c.html(keysPageHtml));
app.get("/benchmark", (c) => c.html(benchmarkPageHtml));
app.get("/registry/:serviceId", (c) => {
  const serviceId = c.req.param("serviceId");
  return c.html(serviceDetailPageHtml(serviceId));
});

// Health check
app.get("/health", async (c) => {
  const count = await getServiceCount(c.env.DB);
  return c.json({ status: "ok", services_indexed: count });
});

// Auth middleware for /discover
app.use("/discover", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header. Use: Bearer <api-key>" },
      401
    );
  }

  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const apiKey = await validateApiKey(c.env.DB, keyHash);

  if (!apiKey) {
    return c.json(
      { error: "unauthorized", message: "Invalid API key." },
      401
    );
  }

  const limit = getRateLimit(apiKey.tier);
  if (apiKey.daily_usage >= limit) {
    return c.json(
      {
        error: "rate_limited",
        message: `Daily limit of ${limit} requests exceeded. Resets at midnight UTC.`,
        retry_after_seconds: secondsUntilMidnight(),
      },
      429
    );
  }

  // Increment usage
  await incrementUsage(c.env.DB, keyHash);
  await next();
});

// Main discovery endpoint
app.post("/discover", async (c) => {
  const startTime = Date.now();

  let body: DiscoverRequest;
  try {
    body = await c.req.json<DiscoverRequest>();
  } catch {
    return c.json(
      { error: "invalid_json", message: "Request body must be valid JSON." },
      400
    );
  }

  if (!body.need || typeof body.need !== "string" || body.need.trim().length < 5) {
    return c.json(
      {
        error: "need_too_vague",
        message: "Please provide a more specific description of what you need (min 5 characters).",
      },
      400
    );
  }

  const result = await searchServices(c.env, {
    need: body.need.trim(),
    max_price_per_call: body.max_price_per_call,
    max_latency_ms: body.max_latency_ms,
    min_reputation: body.min_reputation,
    min_success_rate: body.min_success_rate,
    budget_usd: body.budget_usd,
    task_context: body.task_context,
    max_cost_per_call: body.max_cost_per_call,
    pricing_model: body.pricing_model,
    max_monthly_price: body.max_monthly_price,
  });

  // Log request + record discovery (non-blocking)
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const recommendedIds = result.recommendations?.map((r) => r.service_id) ?? [];
  c.executionCtx.waitUntil(
    Promise.all([
      logRequest(c.env.DB, {
        api_key_hash: keyHash,
        endpoint: "/discover",
        need: body.need.trim(),
        response_service_ids: recommendedIds,
        query_id: result.query_id,
        status_code: 200,
        latency_ms: Date.now() - startTime,
      }),
      recordDiscovery(c.env.DB, keyHash, body.need.trim(), recommendedIds),
    ])
  );

  // Personalize ranking if agent has profile
  const [profile, failedTools] = await Promise.all([
    getAgentProfile(c.env.DB, keyHash),
    getFailedTools(c.env.DB, keyHash),
  ]);

  if (profile && profile.search_count >= 5) {
    const personalized = personalizeRanking(
      result.recommendations.map((r) => ({
        id: r.service_id,
        value_score: r.value_score,
        capabilities: [], // capabilities already factored into value_score
        pricing_model: r.cost?.pricing_model,
      })),
      profile,
      failedTools
    );

    // Apply personalized scores back
    for (const p of personalized) {
      const rec = result.recommendations.find((r) => r.service_id === p.id);
      if (rec) {
        rec.value_score = p.value_score;
      }
    }

    // Re-sort by personalized value_score
    result.recommendations.sort((a, b) => b.value_score - a.value_score);
  }

  return c.json(result);
});

// ─── Feedback Loop: Call Report ───
// Agents report back how a tool performed → feeds into quality scores → improves next recommendation
// This is the real moat: closed-loop machine signal, not human reviews

app.post("/report", async (c) => {
  // Auth check
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized", message: "Missing API key." }, 401);
  }
  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const apiKey = await validateApiKey(c.env.DB, keyHash);
  if (!apiKey) {
    return c.json({ error: "unauthorized", message: "Invalid API key." }, 401);
  }

  let body: CallReport;
  try {
    body = await c.req.json<CallReport>();
  } catch {
    return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  if (!body.service_id) {
    return c.json({ error: "missing_fields", message: "service_id is required." }, 400);
  }

  // Fill defaults for optional fields to avoid DB insert failures
  const normalizedReport: CallReport = {
    service_id: body.service_id,
    query_id: body.query_id ?? crypto.randomUUID(),
    success: body.success ?? false,
    actual_latency_ms: body.actual_latency_ms ?? 0,
    actual_cost_usd: body.actual_cost_usd ?? 0,
    retried: body.retried ?? false,
    retry_count: body.retry_count ?? 0,
    human_escalated: body.human_escalated ?? false,
    task_context: body.task_context ?? null,
  };

  const reportStartTime = Date.now();
  await insertCallReport(c.env.DB, normalizedReport, keyHash);

  // Log report + record agent usage (non-blocking)
  c.executionCtx.waitUntil(
    Promise.all([
      logRequest(c.env.DB, {
        api_key_hash: keyHash,
        endpoint: "/report",
        query_id: normalizedReport.query_id,
        status_code: 200,
        latency_ms: Date.now() - reportStartTime,
      }),
      recordReport(c.env.DB, keyHash, normalizedReport.service_id, normalizedReport.success),
    ])
  );

  return c.json({ status: "ok", message: "Call report recorded. Thank you for improving recommendations." });
});

// ─── Public API: Service Listing & Stats ───

app.get("/api/services", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") || "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20") || 1));
  const search = c.req.query("search") || undefined;
  const platform = c.req.query("platform") || undefined;
  const sort = c.req.query("sort") || undefined;
  const health = c.req.query("health") || undefined;
  const pricing = c.req.query("pricing") || undefined;
  const install = c.req.query("install") || undefined;
  const result = await getServicesPaginated(c.env.DB, { page, limit, search, platform, sort, health, pricing, install });
  return c.json(result);
});

app.get("/api/services/:id", async (c) => {
  const service = await getServiceDetail(c.env.DB, c.req.param("id"));
  if (!service) {
    return c.json({ error: "not_found", message: "Service not found" }, 404);
  }
  return c.json({
    service: {
      id: service.id,
      name: service.name,
      description: service.description,
      type: service.service_type ?? "mcp_server",
      install: service.install ?? null,
      required_env: service.required_env ?? [],
      tools_provided: service.tools_provided ?? [],
      metrics: {
        reputation_score: service.reputation_score,
        success_rate: service.success_rate,
        uptime_30d: service.uptime_30d,
        latency_p95_ms: service.latency_p95_ms,
        total_calls: service.total_calls,
        retry_rate: service.retry_rate,
      },
      platform: service.platform,
      source_url: service.source_url,
    },
  });
});

// ─── Aggregated Service Detail (for detail page) ───

app.get("/api/services/:id/detail", async (c) => {
  const serviceId = c.req.param("id");
  const service = await getServiceDetail(c.env.DB, serviceId);
  if (!service) {
    return c.json({ error: "not_found", message: "Service not found" }, 404);
  }

  // Fetch all related data in parallel
  const [healthData, costRow, errorsRow, versionsData, cooccurrenceData, benchmarkRows, recentErrorsRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT overall_status, uptime_30d, last_check_at, avg_response_ms, install_score, install_difficulty, install_details,
              call_success_rate, probe_type, last_probe_details,
              error_distribution, primary_error_type, error_count_30d,
              current_version, last_version_change, recent_breaking_change
       FROM health_summary WHERE service_id = ?`
    ).bind(serviceId).first(),

    c.env.DB.prepare(
      `SELECT pricing_model, cost_per_call, free_tier_limit, monthly_price, pricing_details FROM services WHERE id = ?`
    ).bind(serviceId).first(),

    c.env.DB.prepare(
      `SELECT error_distribution, primary_error_type, error_count_30d FROM health_summary WHERE service_id = ?`
    ).bind(serviceId).first(),

    c.env.DB.prepare(
      `SELECT version, previous_version, is_breaking_change, published_at, detected_at
       FROM version_history WHERE service_id = ? ORDER BY detected_at DESC LIMIT 10`
    ).bind(serviceId).all(),

    getCooccurrences(c.env.DB, serviceId),

    c.env.DB.prepare(
      `SELECT br.scenario_id, bs.name as scenario_name, br.rank, br.overall_score
       FROM benchmark_results br
       JOIN benchmark_scenarios bs ON br.scenario_id = bs.id
       WHERE br.service_id = ?
       ORDER BY br.created_at DESC`
    ).bind(serviceId).all(),

    c.env.DB.prepare(
      `SELECT error_type, source, details, occurred_at FROM error_classifications
       WHERE service_id = ? ORDER BY occurred_at DESC LIMIT 10`
    ).bind(serviceId).all(),
  ]);

  // Parse health
  const health = healthData ? {
    status: (healthData as any).overall_status ?? "unknown",
    uptime_30d: (healthData as any).uptime_30d ?? 0,
    last_check_at: (healthData as any).last_check_at ?? null,
    avg_response_ms: (healthData as any).avg_response_ms ?? null,
    install_score: (healthData as any).install_score ?? null,
    install_difficulty: (healthData as any).install_difficulty ?? null,
    install_details: safeParseJson((healthData as any).install_details),
    call_success_rate: (healthData as any).call_success_rate ?? null,
    probe_type: (healthData as any).probe_type ?? null,
    probe_details: safeParseJson((healthData as any).last_probe_details),
  } : null;

  // Parse cost
  const cost = costRow && (costRow as any).pricing_model ? {
    pricing_model: (costRow as any).pricing_model,
    cost_per_call: (costRow as any).cost_per_call,
    free_tier_limit: (costRow as any).free_tier_limit,
    monthly_price: (costRow as any).monthly_price,
    details: safeParseJson((costRow as any).pricing_details),
  } : null;

  // Parse errors
  let errorDist: Record<string, any> = {};
  try { errorDist = errorsRow && (errorsRow as any).error_distribution ? JSON.parse((errorsRow as any).error_distribution) : {}; } catch { errorDist = {}; }
  const errors = {
    primary_error_type: errorsRow ? (errorsRow as any).primary_error_type : null,
    error_count_30d: errorsRow ? (errorsRow as any).error_count_30d ?? 0 : 0,
    distribution: errorDist,
    recent: (recentErrorsRows.results ?? []).map((r: any) => ({
      error_type: r.error_type,
      source: r.source,
      details: safeParseJson(r.details),
      occurred_at: r.occurred_at,
    })),
  };

  // Parse versions
  const versions = (versionsData.results ?? []).map((r: any) => ({
    version: r.version,
    previous_version: r.previous_version,
    is_breaking: r.is_breaking_change === 1,
    published_at: r.published_at,
    detected_at: r.detected_at,
  }));
  const versionInfo = healthData ? {
    current_version: (healthData as any).current_version ?? null,
    last_version_change: (healthData as any).last_version_change ?? null,
    recent_breaking_change: ((healthData as any).recent_breaking_change ?? 0) === 1,
    history: versions,
  } : { current_version: null, last_version_change: null, recent_breaking_change: false, history: versions };

  // Parse benchmarks
  const benchmarks = (benchmarkRows.results ?? []).map((r: any) => ({
    scenario_id: r.scenario_id,
    scenario_name: r.scenario_name,
    rank: r.rank,
    score: r.overall_score,
  }));

  return c.json({
    success: true,
    data: {
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        type: service.service_type ?? "mcp_server",
        platform: service.platform,
        source_url: service.source_url,
        capabilities: service.capabilities,
        install: service.install ?? null,
        required_env: service.required_env ?? [],
        tools_provided: service.tools_provided ?? [],
        metrics: {
          reputation_score: service.reputation_score,
          success_rate: service.success_rate,
          uptime_30d: service.uptime_30d,
          latency_p95_ms: service.latency_p95_ms,
          total_calls: service.total_calls,
          retry_rate: service.retry_rate,
        },
      },
      health,
      cost,
      errors,
      versions: versionInfo,
      cooccurrence: cooccurrenceData,
      benchmarks,
    },
  });
});

app.get("/api/stats", async (c) => {
  const stats = await getSystemStats(c.env.DB);
  return c.json(stats);
});

app.get("/api/analytics", async (c) => {
  const days = Math.min(90, Math.max(1, parseInt(c.req.query("days") || "7") || 7));
  const stats = await getRequestStats(c.env.DB, days);
  return c.json(stats);
});

// ─── API Key Registration ───

app.post("/api/register", async (c) => {
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "invalid_email", message: "Please provide a valid email address." }, 400);
  }

  // Limit: max 3 keys per email
  const existingCount = await getKeyCountByEmail(c.env.DB, email);
  if (existingCount >= 3) {
    return c.json(
      { error: "limit_reached", message: "Maximum 3 API keys per email. Contact us for more." },
      429
    );
  }

  // Generate key: dsvr_ prefix + 32 random hex chars
  const rawBytes = new Uint8Array(16);
  crypto.getRandomValues(rawBytes);
  const apiKey = "dsvr_" + Array.from(rawBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const keyHash = await hashKey(apiKey);
  await createApiKey(c.env.DB, email, keyHash);

  return c.json({
    status: "ok",
    api_key: apiKey,
    tier: "free",
    daily_limit: 1000,
    message: "Save this key — it will not be shown again.",
  });
});

// ─── Health API: Public Endpoints ───

app.get("/api/health/summary", async (c) => {
  const overview = await getHealthOverview(c.env.DB);
  return c.json({ success: true, data: overview });
});

app.get("/api/health/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const health = await getServiceHealth(c.env.DB, serviceId);
  if (!health.summary) {
    return c.json({ error: "not_found", message: "No health data for this service" }, 404);
  }
  return c.json({ success: true, data: health });
});

// ─── Alternatives & Deprecation API ───

app.get("/api/alternatives/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const alternatives = await getAlternatives(c.env.DB, serviceId);
  return c.json({ success: true, data: alternatives });
});

app.get("/api/deprecations", async (c) => {
  const overview = await getDeprecationOverview(c.env.DB);
  return c.json({ success: true, data: overview });
});

// ─── Install Score API ───

app.get("/api/install/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const row = await c.env.DB
    .prepare(
      `SELECT install_score, install_difficulty, install_details FROM health_summary WHERE service_id = ?`
    )
    .bind(serviceId)
    .first<{ install_score: number | null; install_difficulty: string | null; install_details: string | null }>();

  if (!row || row.install_score === null) {
    return c.json({ error: "not_found", message: "No install data for this service" }, 404);
  }

  let details: Record<string, any> = {};
  try {
    details = row.install_details ? JSON.parse(row.install_details) : {};
  } catch {
    details = {};
  }

  return c.json({
    success: true,
    data: {
      service_id: serviceId,
      install_score: row.install_score,
      install_difficulty: row.install_difficulty,
      details,
    },
  });
});

// ─── Live Probe API ───

app.get("/api/probe/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");

  const summary = await c.env.DB
    .prepare(
      `SELECT call_success_rate, probe_type, last_probe_details FROM health_summary WHERE service_id = ?`
    )
    .bind(serviceId)
    .first<{ call_success_rate: number | null; probe_type: string | null; last_probe_details: string | null }>();

  if (!summary || summary.probe_type === null) {
    return c.json({ error: "not_found", message: "No probe data for this service" }, 404);
  }

  const recentRows = await c.env.DB
    .prepare(
      `SELECT check_type, status, response_time_ms, details, checked_at
       FROM health_checks
       WHERE service_id = ? AND check_type IN ('mcp_handshake', 'api_probe')
       ORDER BY checked_at DESC
       LIMIT 10`
    )
    .bind(serviceId)
    .all();

  let probeDetails: Record<string, any> = {};
  try {
    probeDetails = summary.last_probe_details ? JSON.parse(summary.last_probe_details) : {};
  } catch {
    probeDetails = {};
  }

  const recentProbes = (recentRows.results ?? []).map((r) => {
    let details: Record<string, any> = {};
    try {
      details = r.details ? JSON.parse(r.details as string) : {};
    } catch {
      details = {};
    }
    return {
      check_type: r.check_type,
      status: r.status,
      response_time_ms: r.response_time_ms,
      details,
      checked_at: r.checked_at,
    };
  });

  return c.json({
    success: true,
    data: {
      summary: {
        service_id: serviceId,
        call_success_rate: summary.call_success_rate,
        probe_type: summary.probe_type,
        last_probe_details: probeDetails,
      },
      recent_probes: recentProbes,
    },
  });
});

// ─── Co-occurrence API ───

app.get("/api/cooccurrence/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const results = await getCooccurrences(c.env.DB, serviceId);
  return c.json({ success: true, data: results });
});

// ─── Cost Intelligence API ───

app.get("/api/cost/summary", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT pricing_model, COUNT(*) as count FROM services WHERE pricing_model IS NOT NULL GROUP BY pricing_model`
    )
    .all();

  const distribution: Record<string, number> = {};
  for (const r of (rows.results ?? []) as any[]) {
    distribution[r.pricing_model] = r.count;
  }

  const totalRow = await c.env.DB
    .prepare(`SELECT COUNT(*) as total FROM services`)
    .first<{ total: number }>();

  const extractedRow = await c.env.DB
    .prepare(`SELECT COUNT(*) as extracted FROM services WHERE pricing_model IS NOT NULL`)
    .first<{ extracted: number }>();

  return c.json({
    success: true,
    data: {
      distribution,
      total_services: totalRow?.total ?? 0,
      extracted: extractedRow?.extracted ?? 0,
      pending: (totalRow?.total ?? 0) - (extractedRow?.extracted ?? 0),
    },
  });
});

app.get("/api/cost/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const row = await c.env.DB
    .prepare(
      `SELECT pricing_model, cost_per_call, free_tier_limit, monthly_price, pricing_details
       FROM services WHERE id = ?`
    )
    .bind(serviceId)
    .first<{
      pricing_model: string | null;
      cost_per_call: number | null;
      free_tier_limit: number | null;
      monthly_price: number | null;
      pricing_details: string | null;
    }>();

  if (!row) {
    return c.json({ error: "not_found", message: "Service not found" }, 404);
  }

  if (!row.pricing_model) {
    return c.json({ error: "not_found", message: "No cost data for this service yet" }, 404);
  }

  let details: Record<string, any> = {};
  try {
    details = row.pricing_details ? JSON.parse(row.pricing_details) : {};
  } catch {
    details = {};
  }

  return c.json({
    success: true,
    data: {
      service_id: serviceId,
      pricing_model: row.pricing_model,
      cost_per_call: row.cost_per_call,
      free_tier_limit: row.free_tier_limit,
      monthly_price: row.monthly_price,
      details,
    },
  });
});

// ─── Error Taxonomy API ───

app.get("/api/errors/summary", async (c) => {
  const rows = await c.env.DB
    .prepare(
      `SELECT error_type, COUNT(*) as count, COUNT(DISTINCT service_id) as services
       FROM error_classifications
       WHERE occurred_at > datetime('now', '-30 days')
       GROUP BY error_type
       ORDER BY count DESC`
    )
    .all();

  const byType: Record<string, { count: number; services: number }> = {};
  let totalErrors = 0;
  let totalServices = 0;

  for (const r of (rows.results ?? []) as any[]) {
    byType[r.error_type] = { count: r.count, services: r.services };
    totalErrors += r.count;
    totalServices += r.services;
  }

  const uniqueServicesRow = await c.env.DB
    .prepare(
      `SELECT COUNT(DISTINCT service_id) as cnt FROM error_classifications WHERE occurred_at > datetime('now', '-30 days')`
    )
    .first<{ cnt: number }>();

  return c.json({
    success: true,
    data: {
      period: "30d",
      total_errors: totalErrors,
      services_affected: uniqueServicesRow?.cnt ?? 0,
      by_type: byType,
    },
  });
});

app.get("/api/errors/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");

  const summary = await c.env.DB
    .prepare(
      `SELECT error_distribution, primary_error_type, error_count_30d
       FROM health_summary WHERE service_id = ?`
    )
    .bind(serviceId)
    .first<{ error_distribution: string | null; primary_error_type: string | null; error_count_30d: number }>();

  let distribution: Record<string, any> = {};
  try {
    distribution = summary?.error_distribution ? JSON.parse(summary.error_distribution) : {};
  } catch {
    distribution = {};
  }

  const recentRows = await c.env.DB
    .prepare(
      `SELECT error_type, source, details, occurred_at
       FROM error_classifications
       WHERE service_id = ?
       ORDER BY occurred_at DESC
       LIMIT 10`
    )
    .bind(serviceId)
    .all();

  const recent = (recentRows.results ?? []).map((r: any) => {
    let details: Record<string, any> = {};
    try { details = r.details ? JSON.parse(r.details) : {}; } catch { details = {}; }
    return {
      error_type: r.error_type,
      source: r.source,
      details,
      occurred_at: r.occurred_at,
    };
  });

  return c.json({
    success: true,
    data: {
      service_id: serviceId,
      primary_error_type: summary?.primary_error_type ?? null,
      error_count_30d: summary?.error_count_30d ?? 0,
      distribution,
      recent,
    },
  });
});

// ─── Agent Profile API ───

// Agent views own profile (Bearer auth, same as /discover)
app.get("/api/profile", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized", message: "Missing API key." }, 401);
  }
  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const apiKey = await validateApiKey(c.env.DB, keyHash);
  if (!apiKey) {
    return c.json({ error: "unauthorized", message: "Invalid API key." }, 401);
  }

  const profile = await getAgentProfile(c.env.DB, keyHash);
  if (!profile) {
    return c.json({ error: "No profile yet. Use /discover to start building your profile." }, 404);
  }
  return c.json({ success: true, data: profile });
});

// ─── Failover Advisor API ───

app.post("/api/failover", async (c) => {
  // Bearer auth (same as /discover)
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header. Use: Bearer <api-key>" },
      401
    );
  }
  const token = authHeader.slice(7);
  const keyHash = await hashKey(token);
  const apiKey = await validateApiKey(c.env.DB, keyHash);
  if (!apiKey) {
    return c.json({ error: "unauthorized", message: "Invalid API key." }, 401);
  }

  let body: { service_id?: string; error_type?: string; status_code?: number; error_message?: string; retry_count?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json", message: "Request body must be valid JSON." }, 400);
  }

  if (!body.service_id || !body.error_type) {
    return c.json({ error: "bad_request", message: "service_id and error_type are required." }, 400);
  }

  const advice = await getFailoverAdvice(c.env.DB, body.service_id, body.error_type, {
    status_code: body.status_code,
    error_message: body.error_message,
    retry_count: body.retry_count,
  });

  return c.json({ success: true, data: advice });
});

// ─── Changelog Intelligence API ───

app.get("/api/versions/:serviceId", async (c) => {
  const serviceId = c.req.param("serviceId");
  const history = await getVersionHistory(c.env.DB, serviceId);
  return c.json({ success: true, data: history });
});

app.get("/api/breaking-changes", async (c) => {
  const days = Number(c.req.query("days") || 7);
  const changes = await getRecentBreakingChanges(c.env.DB, days);
  return c.json({ success: true, data: changes });
});

// ─── Benchmark API ───

app.get("/api/benchmark", async (c) => {
  const overview = await getBenchmarkOverview(c.env.DB);
  return c.json({ success: true, data: overview });
});

app.get("/api/benchmark/scenarios", async (c) => {
  return c.json({
    success: true,
    data: DEFAULT_SCENARIOS.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category_match: s.category_match,
      tags_match: s.tags_match,
      eval_weights: s.eval_weights,
    })),
  });
});

app.get("/api/benchmark/:scenarioId", async (c) => {
  const scenarioId = c.req.param("scenarioId");
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20") || 20));
  const entries = await getScenarioLeaderboard(c.env.DB, scenarioId, limit);
  return c.json({ success: true, data: entries });
});

// Admin auth middleware — requires ADMIN_KEY env var
app.use("/admin/*", async (c, next) => {
  const adminKey = (c.env as any).ADMIN_KEY;
  if (adminKey) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ") || authHeader.slice(7) !== adminKey) {
      return c.json({ error: "unauthorized", message: "Admin access requires valid ADMIN_KEY." }, 401);
    }
  }
  await next();
});

// Admin: trigger crawl manually
app.post("/admin/crawl", async (c) => {
  const source = c.req.query("source") || "all";
  if (source === "smithery") {
    const count = await crawlSmithery(c.env);
    return c.json({ status: "ok", source: "smithery", services_crawled: count });
  }
  if (source === "github") {
    const count = await crawlAwesomeMcp(c.env);
    return c.json({ status: "ok", source: "github", services_crawled: count });
  }
  if (source === "mcp_registry") {
    const count = await crawlMcpRegistry(c.env);
    return c.json({ status: "ok", source: "mcp_registry", services_crawled: count });
  }
  const [smitheryCount, githubCount, mcpRegCount] = await Promise.all([
    crawlSmithery(c.env),
    crawlAwesomeMcp(c.env),
    crawlMcpRegistry(c.env),
  ]);
  return c.json({ status: "ok", source: "all", smithery: smitheryCount, github: githubCount, mcp_registry: mcpRegCount, total: smitheryCount + githubCount + mcpRegCount });
});

// Admin: reindex existing services into Vectorize
app.post("/admin/reindex", async (c) => {
  const services = await getAllServices(c.env.DB);
  if (services.length === 0) {
    return c.json({ status: "ok", message: "No services to index." });
  }
  await embedAndIndex(c.env, services);
  return c.json({ status: "ok", services_indexed: services.length });
});

// Admin: rebuild FTS5 index
app.post("/admin/rebuild-fts", async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM services_fts"),
    c.env.DB.prepare(
      "INSERT INTO services_fts(rowid, id, name, description, capabilities) SELECT rowid, id, name, description, capabilities FROM services"
    ),
  ]);
  const count = await c.env.DB.prepare("SELECT count(*) as c FROM services_fts").first<{ c: number }>();
  return c.json({ status: "ok", fts_entries: count?.c ?? 0 });
});

// Admin: enrich GitHub services with star counts
app.post("/admin/enrich", async (c) => {
  const count = await enrichGitHubStars(c.env);
  return c.json({ status: "ok", services_enriched: count });
});

// Admin: enrich services with README-extracted metadata (install, env vars, tools)
app.post("/admin/enrich-readme", async (c) => {
  let body: { limit?: number; force?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    // use defaults
  }
  const limit = Math.min(Number(body.limit) || 20, 50);
  const forceRefresh = body.force === true;

  const result = await enrichServices(c.env.DB, c.env.OPENAI_API_KEY, {
    limit,
    forceRefresh,
  });

  return c.json(result);
});

// Admin: run health checks
app.post("/admin/health-check", async (c) => {
  const githubToken = (c.env as any).GITHUB_TOKEN;
  const [healthResult, cleanedCount] = await Promise.all([
    runHealthChecks(c.env.DB, 50, githubToken),
    cleanupOldHealthChecks(c.env.DB),
  ]);
  return c.json({
    status: "ok",
    ...healthResult,
    old_records_cleaned: cleanedCount,
  });
});

// Admin: trigger live probes
app.post("/admin/probe", async (c) => {
  const result = await runLiveProbes(c.env.DB, 20);
  return c.json({ success: true, data: result });
});

// Admin: trigger co-occurrence aggregation
app.post("/admin/cooccurrence", async (c) => {
  const result = await runCooccurrenceAggregation(c.env.DB);
  return c.json({ success: true, data: result });
});

// Admin: classify errors from probes and reports
app.post("/admin/classify-errors", async (c) => {
  const result = await runErrorClassification(c.env.DB);
  await cleanupOldErrors(c.env.DB);
  return c.json({ success: true, data: result });
});

// Admin: version check (changelog intelligence)
app.post("/admin/version-check", async (c) => {
  const result = await runVersionChecks(c.env.DB);
  return c.json({ success: true, data: result });
});

// Admin: extract cost intelligence
app.post("/admin/extract-cost", async (c) => {
  let body: { limit?: number } = {};
  try { body = await c.req.json(); } catch { /* defaults */ }
  const limit = Math.min(Number(body.limit) || 50, 200);
  const result = await runCostExtraction(c.env.DB, limit);
  return c.json({ success: true, data: result });
});

// Admin: trigger benchmark run
app.post("/admin/benchmark", async (c) => {
  await seedScenarios(c.env.DB);
  const result = await runFullBenchmark(c.env.DB);
  return c.json({ success: true, data: result });
});

// Admin: aggregate agent profiles
app.post("/admin/aggregate-profiles", async (c) => {
  const result = await aggregateProfiles(c.env.DB);
  return c.json({ success: true, data: result });
});

// Admin: profile stats overview
app.get("/api/profiles/stats", async (c) => {
  const stats = await c.env.DB
    .prepare(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN search_count >= 10 THEN 1 END) as active,
         AVG(search_count) as avg_searches
       FROM agent_profiles`
    )
    .first<{ total: number; active: number; avg_searches: number }>();

  return c.json({
    success: true,
    data: {
      total_profiles: stats?.total ?? 0,
      active_profiles: stats?.active ?? 0,
      avg_searches: Math.round((stats?.avg_searches ?? 0) * 100) / 100,
    },
  });
});

// MCP Server endpoint (Streamable HTTP via Durable Objects)
const mcpHandler = DisvrMcpAgent.serve("/mcp", { binding: "MCP_AGENT" });

app.all("/mcp", (c) => {
  return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx);
});

app.all("/mcp/*", (c) => {
  return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx);
});

// Cron handler
const worker = {
  fetch: app.fetch,

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        // Phase 1: crawl all sources in parallel
        await Promise.all([
          crawlSmithery(env).catch((err) => console.error("Smithery crawl failed:", err)),
          crawlAwesomeMcp(env).catch((err) => console.error("GitHub crawl failed:", err)),
          crawlMcpRegistry(env).catch((err) => console.error("MCP Registry crawl failed:", err)),
        ]);
        // Phase 2: enrich with GitHub stars
        await enrichGitHubStars(env).catch((err) => console.error("GitHub stars enrichment failed:", err));
        // Phase 3: run health checks + cleanup
        const githubToken = (env as any).GITHUB_TOKEN;
        await runHealthChecks(env.DB, 50, githubToken).catch((err) => console.error("Health checks failed:", err));
        await cleanupOldHealthChecks(env.DB).catch((err) => console.error("Health check cleanup failed:", err));
        // Phase 4: aggregate daily stats + passive signals (idempotent — safe to run every hour)
        await runSignalAggregation(env.DB).catch((err) => console.error("Signal aggregation failed:", err));
        // Phase 5: co-occurrence aggregation
        await runCooccurrenceAggregation(env.DB).catch((err) => console.error("Co-occurrence aggregation failed:", err));
        // Phase 5b: error classification
        await runErrorClassification(env.DB)
          .then((r) => console.log(`Error classification: ${r.classified} classified, ${r.services_affected} services`))
          .catch((err) => console.error("Error classification failed:", err));
        // Phase 5c: version checks (30 per hour, full cycle ~17h)
        await runVersionChecks(env.DB, 30)
          .then((r) => console.log(`Version check: ${r.checked} checked, ${r.updated} updated, ${r.breaking_changes} breaking`))
          .catch((err) => console.error("Version check failed:", err));
        // Phase 5d: aggregate agent profiles (50 per hour)
        await aggregateProfiles(env.DB, 50)
          .then((r) => console.log(`Profile aggregation: ${r.profiles_updated} updated`))
          .catch((err) => console.error("Profile aggregation failed:", err));
        // Phase 6: daily benchmark at UTC 0
        const hour = new Date().getUTCHours();
        if (hour === 0) {
          await seedScenarios(env.DB).catch((err) => console.error("Benchmark seed failed:", err));
          await runFullBenchmark(env.DB)
            .then((r) => console.log(`Benchmark: ${r.scenarios_run} scenarios, ${r.total_entries} entries`))
            .catch((err) => console.error("Benchmark run failed:", err));
          await cleanupOldErrors(env.DB, 60).catch((err) => console.error("Error cleanup failed:", err));
          await cleanupInactiveProfiles(env.DB, 90).catch((err) => console.error("Profile cleanup failed:", err));
        }
        // Phase 7: auto-enrich README metadata at UTC 1:00 (30 services/day)
        if (hour === 1) {
          await enrichServices(env.DB, env.OPENAI_API_KEY, { limit: 30 })
            .then((r) => console.log(`Enrich result: ${r.enriched} enriched, ${r.skipped} skipped`))
            .catch((err) => console.error("README enrichment failed:", err));
        }
      })()
    );
  },
};

export { DisvrMcpAgent };
export default worker;

// Helpers

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeParseJson(value: string | null | undefined): Record<string, any> | null {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}
