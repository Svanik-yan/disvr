import type { BenchmarkScenario } from "./benchmark-scenarios.js";
import { DEFAULT_SCENARIOS } from "./benchmark-scenarios.js";
import { scoreCostEfficiency } from "./cost.js";

// ─── Types ───

export interface DimensionScores {
  availability: number;
  installability: number;
  responsiveness: number;
  freshness: number;
  popularity: number;
  cost_efficiency: number;
}

export interface BenchmarkEntry {
  service_id: string;
  service_name: string;
  overall_score: number;
  dimension_scores: DimensionScores;
  rank: number;
}

// ─── Dimension Scoring Functions ───

export function scoreAvailability(health: {
  overall_status?: string | null;
  uptime_30d?: number | null;
} | null): number {
  if (!health) return 30;
  if (health.uptime_30d !== null && health.uptime_30d !== undefined && health.uptime_30d > 0) {
    return Math.round(health.uptime_30d * 100);
  }
  switch (health.overall_status) {
    case "healthy": return 100;
    case "degraded": return 50;
    case "dead": return 10;
    default: return 30;
  }
}

export function scoreInstallability(health: {
  install_score?: number | null;
} | null): number {
  if (!health || health.install_score === null || health.install_score === undefined) return 50;
  return health.install_score;
}

export function scoreResponsiveness(health: {
  call_success_rate?: number | null;
  avg_response_ms?: number | null;
} | null): number {
  if (!health) return 50;

  let score = 50;
  const rate = health.call_success_rate;
  const ms = health.avg_response_ms;

  if (rate !== null && rate !== undefined) {
    if (rate >= 0.9) score = 90;
    else if (rate >= 0.7) score = 70;
    else if (rate >= 0.5) score = 50;
    else if (rate >= 0.3) score = 30;
    else score = 10;

    // Adjust by response time
    if (ms !== null && ms !== undefined) {
      if (ms < 500) score = Math.min(100, score + 10);
      else if (ms < 1000) score = Math.min(100, score + 5);
      else if (ms > 3000) score = Math.max(0, score - 10);
    }
  } else if (ms !== null && ms !== undefined) {
    if (ms < 500) score = 80;
    else if (ms < 1000) score = 70;
    else if (ms < 3000) score = 60;
    else score = 40;
  }

  return score;
}

export function scoreFreshness(lastUpdated: string | null): number {
  if (!lastUpdated) return 40;
  const days = Math.floor(
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 30) return 100;
  if (days < 90) return 80;
  if (days < 180) return 50;
  return 20;
}

export function scorePopularity(service: {
  reputation_score?: number | null;
  total_calls?: number;
}): number {
  // Use reputation_score (0-5) as primary signal
  const rep = service.reputation_score;
  if (rep !== null && rep !== undefined && rep > 0) {
    return Math.min(100, Math.round(rep * 20));
  }
  // Fall back to total_calls
  const calls = service.total_calls ?? 0;
  if (calls > 10000) return 100;
  if (calls > 1000) return 80;
  if (calls > 100) return 60;
  if (calls > 10) return 40;
  return 20;
}

// ─── Seed Scenarios ───

export async function seedScenarios(db: D1Database): Promise<void> {
  for (const scenario of DEFAULT_SCENARIOS) {
    await db
      .prepare(
        `INSERT INTO benchmark_scenarios (id, name, description, category_match, tags_match, eval_weights)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           name = ?2, description = ?3, category_match = ?4, tags_match = ?5, eval_weights = ?6`
      )
      .bind(
        scenario.id,
        scenario.name,
        scenario.description,
        scenario.category_match,
        JSON.stringify(scenario.tags_match),
        JSON.stringify(scenario.eval_weights)
      )
      .run();
  }
}

// ─── Run Benchmark for a Single Scenario ───

export async function runBenchmarkForScenario(
  db: D1Database,
  scenario: BenchmarkScenario,
  runVersion: string
): Promise<BenchmarkEntry[]> {
  // 1. Find candidate services via capabilities + description matching
  const tagsLike = scenario.tags_match
    .map((_, i) => `s.description LIKE ?${i + 2}`)
    .join(" OR ");

  const query = `
    SELECT DISTINCT s.id, s.name, s.reputation_score, s.total_calls,
           s.pricing_model, s.free_tier_limit, s.monthly_price,
           h.overall_status, h.uptime_30d, h.install_score, h.call_success_rate,
           h.avg_response_ms, h.last_updated
    FROM services s
    LEFT JOIN health_summary h ON s.id = h.service_id
    WHERE EXISTS (
      SELECT 1 FROM json_each(s.capabilities) je
      WHERE je.value = ?1
    ) OR ${tagsLike}
    LIMIT 50
  `;

  const binds = [
    scenario.category_match,
    ...scenario.tags_match.map((t) => `%${t}%`),
  ];

  const rows = await db.prepare(query).bind(...binds).all();
  if (!rows.results || rows.results.length === 0) return [];

  // 2. Score each candidate
  const entries: BenchmarkEntry[] = (rows.results as any[]).map((row) => {
    const health = {
      overall_status: row.overall_status as string | null,
      uptime_30d: row.uptime_30d as number | null,
      install_score: row.install_score as number | null,
      call_success_rate: row.call_success_rate as number | null,
      avg_response_ms: row.avg_response_ms as number | null,
      last_updated: row.last_updated as string | null,
    };

    const dims: DimensionScores = {
      availability: scoreAvailability(health),
      installability: scoreInstallability(health),
      responsiveness: scoreResponsiveness(health),
      freshness: scoreFreshness(health.last_updated),
      popularity: scorePopularity({
        reputation_score: row.reputation_score as number | null,
        total_calls: (row.total_calls as number) ?? 0,
      }),
      cost_efficiency: scoreCostEfficiency({
        pricing_model: row.pricing_model as string | null,
        free_tier_limit: row.free_tier_limit as number | null,
        monthly_price: row.monthly_price as number | null,
      }),
    };

    const w = scenario.eval_weights;
    const overall = Math.round(
      dims.availability * w.availability +
      dims.installability * w.installability +
      dims.responsiveness * w.responsiveness +
      dims.freshness * w.freshness +
      dims.popularity * w.popularity +
      dims.cost_efficiency * w.cost_efficiency
    );

    return {
      service_id: row.id as string,
      service_name: row.name as string,
      overall_score: overall,
      dimension_scores: dims,
      rank: 0,
    };
  });

  // 3. Sort and assign ranks
  entries.sort((a, b) => b.overall_score - a.overall_score);
  entries.forEach((e, i) => { e.rank = i + 1; });

  // 4. Write to benchmark_results (batch)
  for (const entry of entries) {
    await db
      .prepare(
        `INSERT INTO benchmark_results (scenario_id, service_id, overall_score, dimension_scores, rank, run_version)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(scenario_id, service_id, run_version) DO UPDATE SET
           overall_score = ?3, dimension_scores = ?4, rank = ?5`
      )
      .bind(
        scenario.id,
        entry.service_id,
        entry.overall_score,
        JSON.stringify(entry.dimension_scores),
        entry.rank,
        runVersion
      )
      .run();
  }

  return entries;
}

// ─── Run Full Benchmark ───

export async function runFullBenchmark(
  db: D1Database
): Promise<{ scenarios_run: number; total_entries: number; run_version: string }> {
  const runVersion = new Date().toISOString().slice(0, 10); // '2026-03-30'
  let totalEntries = 0;

  for (const scenario of DEFAULT_SCENARIOS) {
    const entries = await runBenchmarkForScenario(db, scenario, runVersion);
    totalEntries += entries.length;
  }

  return {
    scenarios_run: DEFAULT_SCENARIOS.length,
    total_entries: totalEntries,
    run_version: runVersion,
  };
}

// ─── Get Scenario Leaderboard ───

export async function getScenarioLeaderboard(
  db: D1Database,
  scenarioId: string,
  limit: number = 10
): Promise<BenchmarkEntry[]> {
  // Get latest run_version for this scenario
  const latestRun = await db
    .prepare(
      `SELECT run_version FROM benchmark_results WHERE scenario_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .bind(scenarioId)
    .first<{ run_version: string }>();

  if (!latestRun) return [];

  const rows = await db
    .prepare(
      `SELECT br.service_id, s.name as service_name, br.overall_score, br.dimension_scores, br.rank
       FROM benchmark_results br
       JOIN services s ON br.service_id = s.id
       WHERE br.scenario_id = ?1 AND br.run_version = ?2
       ORDER BY br.rank ASC
       LIMIT ?3`
    )
    .bind(scenarioId, latestRun.run_version, limit)
    .all();

  return (rows.results ?? []).map((r) => ({
    service_id: r.service_id as string,
    service_name: r.service_name as string,
    overall_score: r.overall_score as number,
    dimension_scores: safeParseJson(r.dimension_scores as string, {
      availability: 0, installability: 0, responsiveness: 0, freshness: 0, popularity: 0, cost_efficiency: 0,
    }),
    rank: r.rank as number,
  }));
}

// ─── Get Benchmark Overview ───

export async function getBenchmarkOverview(
  db: D1Database
): Promise<Array<{
  scenario_id: string;
  scenario_name: string;
  top_tool: string;
  top_score: number;
  candidates_count: number;
  last_run: string;
}>> {
  const rows = await db
    .prepare(
      `SELECT bs.id as scenario_id, bs.name as scenario_name,
              (SELECT s.name FROM benchmark_results br2
               JOIN services s ON br2.service_id = s.id
               WHERE br2.scenario_id = bs.id AND br2.rank = 1
               ORDER BY br2.created_at DESC LIMIT 1) as top_tool,
              (SELECT br3.overall_score FROM benchmark_results br3
               WHERE br3.scenario_id = bs.id AND br3.rank = 1
               ORDER BY br3.created_at DESC LIMIT 1) as top_score,
              (SELECT COUNT(DISTINCT br4.service_id) FROM benchmark_results br4
               WHERE br4.scenario_id = bs.id
               AND br4.run_version = (SELECT run_version FROM benchmark_results WHERE scenario_id = bs.id ORDER BY created_at DESC LIMIT 1)
              ) as candidates_count,
              (SELECT MAX(br5.created_at) FROM benchmark_results br5
               WHERE br5.scenario_id = bs.id) as last_run
       FROM benchmark_scenarios bs
       ORDER BY bs.id`
    )
    .all();

  return (rows.results ?? [])
    .filter((r) => r.top_tool !== null)
    .map((r) => ({
      scenario_id: r.scenario_id as string,
      scenario_name: r.scenario_name as string,
      top_tool: (r.top_tool as string) ?? "N/A",
      top_score: (r.top_score as number) ?? 0,
      candidates_count: (r.candidates_count as number) ?? 0,
      last_run: (r.last_run as string) ?? "",
    }));
}

// ─── Match Scenario from Query ───

export function matchScenarioFromQuery(need: string): BenchmarkScenario | null {
  const lower = need.toLowerCase();
  for (const scenario of DEFAULT_SCENARIOS) {
    if (scenario.tags_match.some((tag) => lower.includes(tag))) {
      return scenario;
    }
  }
  return null;
}

// ─── Get Benchmark Rank for a Service ───

export async function getBenchmarkRankForService(
  db: D1Database,
  serviceId: string,
  scenarioId: string
): Promise<{ scenario: string; rank: number; score: number } | null> {
  const row = await db
    .prepare(
      `SELECT br.rank, br.overall_score, br.scenario_id
       FROM benchmark_results br
       WHERE br.service_id = ?1 AND br.scenario_id = ?2
       ORDER BY br.created_at DESC
       LIMIT 1`
    )
    .bind(serviceId, scenarioId)
    .first<{ rank: number; overall_score: number; scenario_id: string }>();

  if (!row) return null;
  return { scenario: row.scenario_id, rank: row.rank, score: row.overall_score };
}

// ─── Helpers ───

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
