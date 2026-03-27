import type { Service, ServiceRow, ApiKeyRecord, CallReport } from "./types.js";
import { rowToService } from "./types.js";

// ─── Service CRUD ───

export async function getAllServices(db: D1Database): Promise<Service[]> {
  const result = await db
    .prepare("SELECT * FROM services")
    .all<ServiceRow>();
  return (result.results ?? []).map(rowToService);
}

export async function upsertService(
  db: D1Database,
  service: Service
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO services (id, name, description, capabilities, platform, protocols, pricing,
        reputation_score, success_rate, uptime_30d, latency_p95_ms, total_calls,
        successful_calls, failed_calls, retry_rate, avg_cost_per_success,
        doc_completeness, verified, source_url, last_health_check, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        capabilities = excluded.capabilities,
        protocols = excluded.protocols,
        pricing = excluded.pricing,
        reputation_score = excluded.reputation_score,
        success_rate = excluded.success_rate,
        uptime_30d = excluded.uptime_30d,
        latency_p95_ms = excluded.latency_p95_ms,
        total_calls = excluded.total_calls,
        successful_calls = excluded.successful_calls,
        failed_calls = excluded.failed_calls,
        retry_rate = excluded.retry_rate,
        avg_cost_per_success = excluded.avg_cost_per_success,
        doc_completeness = excluded.doc_completeness,
        verified = excluded.verified,
        source_url = excluded.source_url,
        last_health_check = excluded.last_health_check,
        updated_at = datetime('now')`
    )
    .bind(
      service.id,
      service.name,
      service.description,
      JSON.stringify(service.capabilities),
      service.platform,
      JSON.stringify(service.protocols),
      JSON.stringify(service.pricing),
      service.reputation_score,
      service.success_rate,
      service.uptime_30d,
      service.latency_p95_ms,
      service.total_calls,
      service.successful_calls,
      service.failed_calls,
      service.retry_rate,
      service.avg_cost_per_success,
      service.doc_completeness,
      service.verified ? 1 : 0,
      service.source_url,
      service.latency_p95_ms !== null ? new Date().toISOString() : null
    )
    .run();
}

export async function getServicesByIds(
  db: D1Database,
  ids: string[]
): Promise<Service[]> {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const result = await db
    .prepare(`SELECT * FROM services WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<ServiceRow>();

  return (result.results ?? []).map(rowToService);
}

export async function searchFTS(
  db: D1Database,
  query: string,
  limit: number = 50
): Promise<Service[]> {
  const sanitized = query.replace(/['"]/g, "").trim();
  if (sanitized.length === 0) return [];

  // Split into words, add wildcard prefix matching, join with OR
  const terms = sanitized
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => `"${t}"*`)
    .join(" OR ");

  if (terms.length === 0) return [];

  const result = await db
    .prepare(
      `SELECT s.* FROM services s
       JOIN services_fts fts ON s.id = fts.id
       WHERE services_fts MATCH ?1
       ORDER BY rank
       LIMIT ?2`
    )
    .bind(terms, limit)
    .all<ServiceRow>();

  return (result.results ?? []).map(rowToService);
}

// ─── Call Reports (Feedback Loop) ───

export async function insertCallReport(
  db: D1Database,
  report: CallReport,
  callerKeyHash: string
): Promise<void> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO call_reports (id, service_id, query_id, success, actual_latency_ms,
        actual_cost_usd, retried, retry_count, human_escalated, task_context, caller_key_hash)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
    .bind(
      id,
      report.service_id,
      report.query_id,
      report.success ? 1 : 0,
      report.actual_latency_ms,
      report.actual_cost_usd,
      report.retried ? 1 : 0,
      report.retry_count,
      report.human_escalated ? 1 : 0,
      report.task_context,
      callerKeyHash
    )
    .run();

  // Update service aggregates from call data
  await refreshServiceStats(db, report.service_id);
}

/**
 * Recompute service stats from call_reports.
 * This is the core feedback loop: real call data → service quality scores → next routing decision.
 */
async function refreshServiceStats(
  db: D1Database,
  serviceId: string
): Promise<void> {
  const stats = await db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures,
        AVG(CASE WHEN retried = 1 THEN 1.0 ELSE 0.0 END) as retry_rate,
        AVG(actual_latency_ms) as avg_latency,
        SUM(actual_cost_usd) / NULLIF(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END), 0) as cost_per_success
      FROM call_reports
      WHERE service_id = ?1
        AND created_at > datetime('now', '-30 days')`
    )
    .bind(serviceId)
    .first<{
      total: number;
      successes: number;
      failures: number;
      retry_rate: number;
      avg_latency: number;
      cost_per_success: number;
    }>();

  if (!stats || stats.total === 0) return;

  const successRate = stats.successes / stats.total;

  await db
    .prepare(
      `UPDATE services SET
        total_calls = ?2,
        successful_calls = ?3,
        failed_calls = ?4,
        success_rate = ?5,
        retry_rate = ?6,
        latency_p95_ms = ?7,
        avg_cost_per_success = ?8,
        reputation_score = ?9,
        updated_at = datetime('now')
      WHERE id = ?1`
    )
    .bind(
      serviceId,
      stats.total,
      stats.successes,
      stats.failures,
      successRate,
      stats.retry_rate,
      Math.round(stats.avg_latency),
      stats.cost_per_success,
      computeReputation(successRate, stats.retry_rate, stats.total)
    )
    .run();
}

/**
 * Reputation = f(success_rate, retry_rate, volume)
 * Not star ratings — data-driven quality signal.
 */
function computeReputation(
  successRate: number,
  retryRate: number,
  volume: number
): number {
  const volumeBonus = Math.min(volume / 1000, 1) * 0.5;
  const reliabilityScore = successRate * 3.5 + (1 - retryRate) * 1.0 + volumeBonus;
  return Math.min(5, Math.max(0, reliabilityScore));
}

// ─── API Key Management ───

export async function validateApiKey(
  db: D1Database,
  keyHash: string
): Promise<ApiKeyRecord | null> {
  const today = new Date().toISOString().split("T")[0];

  const record = await db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?1")
    .bind(keyHash)
    .first<ApiKeyRecord>();

  if (!record) return null;

  if (record.last_reset !== today) {
    await db
      .prepare(
        "UPDATE api_keys SET daily_usage = 0, last_reset = ?1 WHERE key_hash = ?2"
      )
      .bind(today, keyHash)
      .run();
    return { ...record, daily_usage: 0, last_reset: today };
  }

  return record;
}

export async function incrementUsage(
  db: D1Database,
  keyHash: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE api_keys SET daily_usage = daily_usage + 1 WHERE key_hash = ?1"
    )
    .bind(keyHash)
    .run();
}

export async function createApiKey(
  db: D1Database,
  email: string,
  keyHash: string
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO api_keys (key_hash, email, tier, daily_usage, last_reset) VALUES (?1, ?2, 'free', 0, date('now'))"
    )
    .bind(keyHash, email)
    .run();
}

export async function getKeyCountByEmail(
  db: D1Database,
  email: string
): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM api_keys WHERE email = ?1")
    .bind(email)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export function getRateLimit(tier: string): number {
  const limits: Record<string, number> = {
    free: 1000,
    pro: 1000,
    scale: 1000,
  };
  return limits[tier] ?? 1000;
}

export async function getServiceCount(db: D1Database): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM services")
    .first<{ count: number }>();
  return result?.count ?? 0;
}

// ─── Public API: Service Listing ───

export async function getServicesPaginated(
  db: D1Database,
  options: { page: number; limit: number; search?: string; platform?: string; sort?: string }
): Promise<{ services: Service[]; total: number; page: number; limit: number }> {
  const { page, limit, search, platform, sort } = options;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (search && search.trim().length > 0) {
    conditions.push(`(name LIKE ?${paramIdx} OR description LIKE ?${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }
  if (platform && platform !== "all") {
    conditions.push(`platform = ?${paramIdx}`);
    params.push(platform);
    paramIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy = "ORDER BY reputation_score DESC NULLS LAST";
  if (sort === "name") orderBy = "ORDER BY name ASC";
  else if (sort === "calls") orderBy = "ORDER BY total_calls DESC";
  else if (sort === "price") orderBy = "ORDER BY json_extract(pricing, '$.price_usd') ASC";

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM services ${where}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count ?? 0;

  const result = await db
    .prepare(`SELECT * FROM services ${where} ${orderBy} LIMIT ?${paramIdx} OFFSET ?${paramIdx + 1}`)
    .bind(...params, limit, offset)
    .all<ServiceRow>();

  return {
    services: (result.results ?? []).map(rowToService),
    total,
    page,
    limit,
  };
}

// ─── Public API: Aggregated Stats ───

export async function getSystemStats(db: D1Database): Promise<{
  total_services: number;
  total_reports: number;
  avg_success_rate: number | null;
  avg_latency_ms: number | null;
  platforms: { platform: string; count: number }[];
  top_services: { name: string; reputation_score: number | null; total_calls: number }[];
  recent_reports: { service_id: string; success: number; created_at: string }[];
}> {
  const [countRes, reportRes, rateRes, latRes, platformRes, topRes, recentRes] = await Promise.all([
    db.prepare("SELECT COUNT(*) as c FROM services").first<{ c: number }>(),
    db.prepare("SELECT COUNT(*) as c FROM call_reports").first<{ c: number }>(),
    db.prepare("SELECT AVG(success_rate) as v FROM services WHERE success_rate IS NOT NULL").first<{ v: number | null }>(),
    db.prepare("SELECT AVG(latency_p95_ms) as v FROM services WHERE latency_p95_ms IS NOT NULL").first<{ v: number | null }>(),
    db.prepare("SELECT platform, COUNT(*) as count FROM services GROUP BY platform ORDER BY count DESC").all<{ platform: string; count: number }>(),
    db.prepare("SELECT name, reputation_score, total_calls FROM services ORDER BY total_calls DESC, reputation_score DESC LIMIT 10").all<{ name: string; reputation_score: number | null; total_calls: number }>(),
    db.prepare("SELECT service_id, success, created_at FROM call_reports ORDER BY created_at DESC LIMIT 20").all<{ service_id: string; success: number; created_at: string }>(),
  ]);

  return {
    total_services: countRes?.c ?? 0,
    total_reports: reportRes?.c ?? 0,
    avg_success_rate: rateRes?.v ?? null,
    avg_latency_ms: latRes?.v ?? null,
    platforms: platformRes.results ?? [],
    top_services: topRes.results ?? [],
    recent_reports: recentRes.results ?? [],
  };
}
