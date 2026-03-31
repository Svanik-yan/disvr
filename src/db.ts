import type { Service, ServiceRow, ApiKeyRecord, CallReport, HealthCheckResult, HealthSummary, HealthCheck } from "./types.js";
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
        doc_completeness, verified, source_url, last_health_check,
        install_command, install_runtime, runtime_version, service_type, required_env, tools_provided,
        updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, datetime('now'))
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
        install_command = excluded.install_command,
        install_runtime = excluded.install_runtime,
        runtime_version = excluded.runtime_version,
        service_type = excluded.service_type,
        required_env = excluded.required_env,
        tools_provided = excluded.tools_provided,
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
      service.latency_p95_ms !== null ? new Date().toISOString() : null,
      service.install?.command ?? null,
      service.install?.runtime ?? null,
      service.install?.min_version ?? null,
      service.service_type ?? "mcp_server",
      service.required_env ? JSON.stringify(service.required_env) : null,
      service.tools_provided ? JSON.stringify(service.tools_provided) : null
    )
    .run();
}

export async function getServiceDetail(
  db: D1Database,
  serviceId: string
): Promise<Service | null> {
  const row = await db
    .prepare("SELECT * FROM services WHERE id = ?")
    .bind(serviceId)
    .first();
  if (!row) return null;
  return rowToService(row as any);
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

  // Fetch current uptime + doc_completeness for richer reputation
  const current = await db
    .prepare("SELECT uptime_30d, doc_completeness FROM services WHERE id = ?1")
    .bind(serviceId)
    .first<{ uptime_30d: number | null; doc_completeness: number | null }>();

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
      computeReputation({
        successRate,
        retryRate: stats.retry_rate,
        volume: stats.total,
        uptime: current?.uptime_30d ?? null,
        docCompleteness: current?.doc_completeness ?? null,
      })
    )
    .run();
}

/**
 * Reputation = f(success_rate, retry_rate, volume, uptime, doc_completeness)
 *
 * Multi-signal quality score (0-5):
 *   - Call data (success + retry)  → 60% weight when available
 *   - Uptime                       → 20% weight when available
 *   - Volume (social proof)        → 10%
 *   - Doc completeness             → 10%
 *
 * Gracefully degrades: missing signals get neutral defaults.
 */
interface ReputationInput {
  successRate: number;
  retryRate: number;
  volume: number;
  uptime: number | null;
  docCompleteness: number | null;
}

export function computeReputation(input: ReputationInput): number {
  const { successRate, retryRate, volume, uptime, docCompleteness } = input;

  // Call reliability (0-5): success rate dominates, retry rate penalizes
  const callScore = successRate * 4.0 + (1 - retryRate) * 1.0;

  // Uptime (0-5): direct mapping, neutral if unknown
  const uptimeScore = uptime !== null ? uptime * 5.0 : 2.5;

  // Volume bonus (0-5): logarithmic — diminishing returns past 1000 calls
  const volumeScore = volume > 0
    ? Math.min(5, Math.log10(volume + 1) * 1.67)
    : 0;

  // Documentation quality (0-5): direct mapping
  const docScore = docCompleteness !== null ? docCompleteness * 5.0 : 2.5;

  const score =
    callScore * 0.6 +
    uptimeScore * 0.2 +
    volumeScore * 0.1 +
    docScore * 0.1;

  return Math.min(5, Math.max(0, Math.round(score * 100) / 100));
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
  options: {
    page: number;
    limit: number;
    search?: string;
    platform?: string;
    sort?: string;
    health?: string;
    pricing?: string;
    install?: string;
  }
): Promise<{ services: ServiceWithMeta[]; total: number; page: number; limit: number }> {
  const { page, limit, search, platform, sort, health, pricing, install } = options;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (search && search.trim().length > 0) {
    conditions.push(`(s.name LIKE ?${paramIdx} OR s.description LIKE ?${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }
  if (platform && platform !== "all") {
    conditions.push(`s.platform = ?${paramIdx}`);
    params.push(platform);
    paramIdx++;
  }
  if (health && health !== "all") {
    conditions.push(`h.overall_status = ?${paramIdx}`);
    params.push(health);
    paramIdx++;
  }
  if (pricing && pricing !== "all") {
    conditions.push(`s.pricing_model = ?${paramIdx}`);
    params.push(pricing);
    paramIdx++;
  }
  if (install && install !== "all") {
    conditions.push(`h.install_difficulty = ?${paramIdx}`);
    params.push(install);
    paramIdx++;
  }

  const joinClause = "LEFT JOIN health_summary h ON s.id = h.service_id";
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderBy = "ORDER BY s.reputation_score DESC NULLS LAST";
  if (sort === "name") orderBy = "ORDER BY s.name ASC";
  else if (sort === "calls") orderBy = "ORDER BY s.total_calls DESC";
  else if (sort === "price") orderBy = "ORDER BY json_extract(s.pricing, '$.price_usd') ASC";
  else if (sort === "health") orderBy = "ORDER BY CASE h.overall_status WHEN 'healthy' THEN 0 WHEN 'degraded' THEN 1 WHEN 'dead' THEN 2 ELSE 3 END ASC";
  else if (sort === "install") orderBy = "ORDER BY h.install_score DESC NULLS LAST";

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM services s ${joinClause} ${where}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count ?? 0;

  const result = await db
    .prepare(
      `SELECT s.*, h.overall_status as health_status, h.uptime_30d as health_uptime,
              h.install_score, h.install_difficulty,
              h.error_count_30d, h.primary_error_type,
              h.current_version, h.recent_breaking_change
       FROM services s ${joinClause} ${where} ${orderBy}
       LIMIT ?${paramIdx} OFFSET ?${paramIdx + 1}`
    )
    .bind(...params, limit, offset)
    .all();

  const services: ServiceWithMeta[] = (result.results ?? []).map((row: any) => ({
    ...rowToService(row as ServiceRow),
    health_status: row.health_status ?? "unknown",
    health_uptime: row.health_uptime ?? 0,
    install_score: row.install_score ?? null,
    install_difficulty: row.install_difficulty ?? null,
    error_count_30d: row.error_count_30d ?? 0,
    primary_error_type: row.primary_error_type ?? null,
    current_version: row.current_version ?? null,
    recent_breaking_change: (row.recent_breaking_change ?? 0) === 1,
  }));

  return { services, total, page, limit };
}

export interface ServiceWithMeta extends Service {
  health_status: string;
  health_uptime: number;
  install_score: number | null;
  install_difficulty: string | null;
  error_count_30d: number;
  primary_error_type: string | null;
  current_version: string | null;
  recent_breaking_change: boolean;
}

// ─── Request Logging ───

export async function logRequest(
  db: D1Database,
  log: {
    api_key_hash: string;
    endpoint: string;
    need?: string;
    response_service_ids?: string[];
    query_id?: string;
    status_code: number;
    latency_ms: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO request_logs (id, api_key_hash, endpoint, need, response_service_ids, query_id, status_code, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      log.api_key_hash,
      log.endpoint,
      log.need ?? null,
      log.response_service_ids ? JSON.stringify(log.response_service_ids) : null,
      log.query_id ?? null,
      log.status_code,
      log.latency_ms
    )
    .run();
}

// ─── Analytics Queries ───

export async function getRequestStats(
  db: D1Database,
  days: number = 7
): Promise<{
  daily: { date: string; calls: number; unique_keys: number }[];
  top_queries: { query: string; count: number }[];
  total_calls: number;
  total_unique_keys: number;
}> {
  const [dailyRes, queriesRes, totalsRes] = await Promise.all([
    db
      .prepare(
        `SELECT date(created_at) as date, COUNT(*) as calls, COUNT(DISTINCT api_key_hash) as unique_keys
         FROM request_logs
         WHERE created_at >= datetime('now', '-' || ?1 || ' days')
         GROUP BY date(created_at)
         ORDER BY date DESC`
      )
      .bind(days)
      .all<{ date: string; calls: number; unique_keys: number }>(),
    db
      .prepare(
        `SELECT need as query, COUNT(*) as count
         FROM request_logs
         WHERE created_at >= datetime('now', '-' || ?1 || ' days')
           AND need IS NOT NULL
         GROUP BY need
         ORDER BY count DESC
         LIMIT 20`
      )
      .bind(days)
      .all<{ query: string; count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) as total_calls, COUNT(DISTINCT api_key_hash) as total_unique_keys
         FROM request_logs
         WHERE created_at >= datetime('now', '-' || ?1 || ' days')`
      )
      .bind(days)
      .first<{ total_calls: number; total_unique_keys: number }>(),
  ]);

  return {
    daily: dailyRes.results ?? [],
    top_queries: queriesRes.results ?? [],
    total_calls: totalsRes?.total_calls ?? 0,
    total_unique_keys: totalsRes?.total_unique_keys ?? 0,
  };
}

// ─── Daily Stats Aggregation ───

export async function aggregateDailyStats(db: D1Database): Promise<number> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO daily_stats (date, endpoint, request_count, unique_keys, avg_latency_ms, error_count)
       SELECT
         date(created_at) as date,
         endpoint,
         COUNT(*) as request_count,
         COUNT(DISTINCT api_key_hash) as unique_keys,
         AVG(latency_ms) as avg_latency_ms,
         SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
       FROM request_logs
       WHERE date(created_at) = date('now', '-1 day')
       GROUP BY date(created_at), endpoint`
    )
    .run();
  return 1;
}

// ─── Passive Signal Detection ───

export async function getRepeatSearchSignals(
  db: D1Database
): Promise<Array<{ service_ids: string; repeat_count: number }>> {
  const rows = await db
    .prepare(
      `SELECT
        r1.response_service_ids as service_ids,
        COUNT(*) as repeat_count
       FROM request_logs r1
       WHERE r1.endpoint = '/discover'
         AND r1.need IS NOT NULL
         AND r1.created_at > datetime('now', '-7 days')
         AND EXISTS (
           SELECT 1 FROM request_logs r2
           WHERE r2.api_key_hash = r1.api_key_hash
             AND r2.endpoint = '/discover'
             AND r2.need = r1.need
             AND r2.id != r1.id
             AND r2.created_at > datetime(r1.created_at, '-24 hours')
             AND r2.created_at < datetime(r1.created_at, '+24 hours')
         )
       GROUP BY r1.api_key_hash, r1.need`
    )
    .all();
  return (rows.results ?? []).map((r) => ({
    service_ids: r.service_ids as string,
    repeat_count: r.repeat_count as number,
  }));
}

export async function getSatisfiedSearchSignals(
  db: D1Database
): Promise<Array<{ service_ids: string; satisfied_count: number }>> {
  const rows = await db
    .prepare(
      `SELECT
        r.response_service_ids as service_ids,
        COUNT(*) as satisfied_count
       FROM request_logs r
       WHERE r.endpoint = '/discover'
         AND r.need IS NOT NULL
         AND r.response_service_ids IS NOT NULL
         AND r.created_at < datetime('now', '-24 hours')
         AND r.created_at > datetime('now', '-7 days')
         AND NOT EXISTS (
           SELECT 1 FROM request_logs r2
           WHERE r2.api_key_hash = r.api_key_hash
             AND r2.endpoint = '/discover'
             AND r2.need = r.need
             AND r2.id != r.id
             AND r2.created_at > r.created_at
             AND r2.created_at < datetime(r.created_at, '+24 hours')
         )
       GROUP BY r.response_service_ids`
    )
    .all();
  return (rows.results ?? []).map((r) => ({
    service_ids: r.service_ids as string,
    satisfied_count: r.satisfied_count as number,
  }));
}

export async function getLowConfidenceSignals(
  db: D1Database
): Promise<Array<{ service_id: string; recommend_count: number; report_count: number }>> {
  const rows = await db
    .prepare(
      `SELECT
        s.id as service_id,
        COALESCE(rec.cnt, 0) as recommend_count,
        COALESCE(rep.cnt, 0) as report_count
       FROM services s
       LEFT JOIN (
         SELECT json_each.value as sid, COUNT(*) as cnt
         FROM request_logs, json_each(request_logs.response_service_ids)
         WHERE request_logs.endpoint = '/discover'
           AND request_logs.created_at > datetime('now', '-30 days')
         GROUP BY json_each.value
       ) rec ON rec.sid = s.id
       LEFT JOIN (
         SELECT service_id, COUNT(*) as cnt
         FROM reports
         WHERE created_at > datetime('now', '-30 days')
         GROUP BY service_id
       ) rep ON rep.service_id = s.id
       WHERE COALESCE(rec.cnt, 0) > 10
         AND COALESCE(rep.cnt, 0) = 0`
    )
    .all();
  return (rows.results ?? []).map((r) => ({
    service_id: r.service_id as string,
    recommend_count: r.recommend_count as number,
    report_count: r.report_count as number,
  }));
}

// ─── Signal Read/Write ───

export async function upsertServiceSignal(
  db: D1Database,
  signal: {
    service_id: string;
    signal_type: string;
    signal_value: number;
    sample_count: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO service_signals (service_id, signal_type, signal_value, sample_count, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT (service_id, signal_type)
       DO UPDATE SET signal_value = ?, sample_count = ?, updated_at = datetime('now')`
    )
    .bind(
      signal.service_id,
      signal.signal_type,
      signal.signal_value,
      signal.sample_count,
      signal.signal_value,
      signal.sample_count
    )
    .run();
}

export async function getServiceSignals(
  db: D1Database,
  serviceIds: string[]
): Promise<Map<string, Record<string, number>>> {
  if (serviceIds.length === 0) return new Map();
  const placeholders = serviceIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT service_id, signal_type, signal_value, updated_at
       FROM service_signals
       WHERE service_id IN (${placeholders})`
    )
    .bind(...serviceIds)
    .all();

  const result = new Map<string, Record<string, number>>();
  for (const row of rows.results ?? []) {
    const sid = row.service_id as string;
    const type = row.signal_type as string;
    const value = row.signal_value as number;
    const updatedAt = row.updated_at as string;

    // Exponential decay: half-life ~7 days
    const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    const decayed = value * Math.exp(-0.1 * daysSince);

    if (!result.has(sid)) result.set(sid, {});
    result.get(sid)![type] = decayed;
  }
  return result;
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

// ─── MCP Reports (simplified feedback) ───

export async function insertReport(
  db: D1Database,
  report: {
    service_id: string;
    query_id: string;
    api_key_hash: string;
    success: boolean;
    latency_ms?: number;
    error_message?: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO reports (id, service_id, query_id, api_key_hash, success, latency_ms, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      report.service_id,
      report.query_id,
      report.api_key_hash,
      report.success ? 1 : 0,
      report.latency_ms ?? null,
      report.error_message ?? null
    )
    .run();
}

export async function getServiceReportStats(
  db: D1Database,
  serviceId: string
): Promise<{ total: number; success_rate: number; avg_latency_ms: number | null }> {
  const row = await db
    .prepare(
      `SELECT
        COUNT(*) as total,
        AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as success_rate,
        AVG(CASE WHEN success = 1 THEN latency_ms ELSE NULL END) as avg_latency_ms
       FROM reports WHERE service_id = ?`
    )
    .bind(serviceId)
    .first();
  return {
    total: (row?.total as number) ?? 0,
    success_rate: (row?.success_rate as number) ?? 0,
    avg_latency_ms: (row?.avg_latency_ms as number) ?? null,
  };
}

// ─── Health Check DB Functions ───

export async function insertHealthCheck(
  db: D1Database,
  result: HealthCheckResult
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO health_checks (service_id, check_type, status, response_time_ms, details, checked_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      result.service_id,
      result.check_type,
      result.status,
      result.response_time_ms,
      JSON.stringify(result.details)
    )
    .run();
}

export async function upsertHealthSummary(
  db: D1Database,
  serviceId: string,
  summary: {
    overall_status: string;
    github_status?: string;
    package_status?: string;
    endpoint_status?: string;
    last_updated?: string;
    uptime_30d: number;
    avg_response_ms?: number;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO health_summary (service_id, overall_status, github_status, package_status, endpoint_status, last_updated, uptime_30d, avg_response_ms, last_check_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))
       ON CONFLICT(service_id) DO UPDATE SET
         overall_status = ?2,
         github_status = ?3,
         package_status = ?4,
         endpoint_status = ?5,
         last_updated = COALESCE(?6, health_summary.last_updated),
         uptime_30d = ?7,
         avg_response_ms = ?8,
         last_check_at = datetime('now'),
         updated_at = datetime('now')`
    )
    .bind(
      serviceId,
      summary.overall_status,
      summary.github_status ?? null,
      summary.package_status ?? null,
      summary.endpoint_status ?? null,
      summary.last_updated ?? null,
      summary.uptime_30d,
      summary.avg_response_ms ?? null
    )
    .run();
}

export async function updateServiceReliability(
  db: D1Database,
  serviceId: string,
  reliability: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE services SET uptime_30d = ?1, last_health_check = datetime('now'), updated_at = datetime('now') WHERE id = ?2`
    )
    .bind(reliability, serviceId)
    .run();
}

export async function getServiceHealth(
  db: D1Database,
  serviceId: string
): Promise<{ summary: HealthSummary | null; recent_checks: HealthCheck[] }> {
  const [summaryRow, checksRows] = await Promise.all([
    db
      .prepare("SELECT * FROM health_summary WHERE service_id = ?")
      .bind(serviceId)
      .first(),
    db
      .prepare(
        `SELECT * FROM health_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 10`
      )
      .bind(serviceId)
      .all(),
  ]);

  const summary: HealthSummary | null = summaryRow
    ? {
        service_id: summaryRow.service_id as string,
        overall_status: summaryRow.overall_status as HealthSummary["overall_status"],
        github_status: (summaryRow.github_status as string) ?? null,
        package_status: (summaryRow.package_status as string) ?? null,
        endpoint_status: (summaryRow.endpoint_status as string) ?? null,
        last_updated: (summaryRow.last_updated as string) ?? null,
        uptime_30d: (summaryRow.uptime_30d as number) ?? 0,
        avg_response_ms: (summaryRow.avg_response_ms as number) ?? null,
        last_check_at: (summaryRow.last_check_at as string) ?? null,
        updated_at: (summaryRow.updated_at as string) ?? "",
      }
    : null;

  const recent_checks: HealthCheck[] = (checksRows.results ?? []).map((row: any) => ({
    id: row.id,
    service_id: row.service_id,
    check_type: row.check_type,
    status: row.status,
    response_time_ms: row.response_time_ms,
    details: typeof row.details === "string" ? JSON.parse(row.details) : (row.details ?? {}),
    checked_at: row.checked_at,
  }));

  return { summary, recent_checks };
}

export async function getHealthOverview(
  db: D1Database
): Promise<{
  total: number;
  healthy: number;
  degraded: number;
  dead: number;
  unknown: number;
  last_full_scan: string | null;
}> {
  const [totalRow, statusRows, lastScanRow] = await Promise.all([
    db.prepare("SELECT COUNT(*) as c FROM services").first<{ c: number }>(),
    db
      .prepare(
        `SELECT overall_status, COUNT(*) as c FROM health_summary GROUP BY overall_status`
      )
      .all<{ overall_status: string; c: number }>(),
    db
      .prepare(
        `SELECT MIN(last_check_at) as oldest FROM health_summary`
      )
      .first<{ oldest: string | null }>(),
  ]);

  const total = totalRow?.c ?? 0;
  const statusMap: Record<string, number> = {};
  for (const row of statusRows.results ?? []) {
    statusMap[row.overall_status] = row.c;
  }

  const checked = Object.values(statusMap).reduce((a, b) => a + b, 0);

  return {
    total,
    healthy: statusMap["healthy"] ?? 0,
    degraded: statusMap["degraded"] ?? 0,
    dead: statusMap["dead"] ?? 0,
    unknown: total - checked + (statusMap["unknown"] ?? 0),
    last_full_scan: lastScanRow?.oldest ?? null,
  };
}

export async function cleanupOldHealthChecks(
  db: D1Database,
  daysToKeep: number = 30
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM health_checks WHERE checked_at < datetime('now', '-' || ? || ' days')`
    )
    .bind(daysToKeep)
    .run();
  return result.meta?.changes ?? 0;
}

export interface HealthSummaryInfo {
  status: string;
  uptime_30d: number;
  last_check_at: string | null;
  install_score: number | null;
  install_difficulty: string | null;
  call_success_rate: number | null;
  probe_type: string | null;
  error_distribution: Record<string, any> | null;
  primary_error_type: string | null;
  error_count_30d: number;
  current_version: string | null;
  last_version_change: string | null;
  recent_breaking_change: boolean;
}

export async function getHealthSummaryByIds(
  db: D1Database,
  serviceIds: string[]
): Promise<Map<string, HealthSummaryInfo>> {
  if (serviceIds.length === 0) return new Map();
  const placeholders = serviceIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT service_id, overall_status, uptime_30d, last_check_at, install_score, install_difficulty, call_success_rate, probe_type, error_distribution, primary_error_type, error_count_30d, current_version, last_version_change, recent_breaking_change FROM health_summary WHERE service_id IN (${placeholders})`
    )
    .bind(...serviceIds)
    .all();

  const result = new Map<string, HealthSummaryInfo>();
  for (const row of rows.results ?? []) {
    let errorDist: Record<string, any> | null = null;
    try {
      errorDist = row.error_distribution ? JSON.parse(row.error_distribution as string) : null;
    } catch {
      errorDist = null;
    }

    result.set(row.service_id as string, {
      status: row.overall_status as string,
      uptime_30d: (row.uptime_30d as number) ?? 0,
      last_check_at: (row.last_check_at as string) ?? null,
      install_score: (row.install_score as number) ?? null,
      install_difficulty: (row.install_difficulty as string) ?? null,
      call_success_rate: (row.call_success_rate as number) ?? null,
      probe_type: (row.probe_type as string) ?? null,
      error_distribution: errorDist,
      primary_error_type: (row.primary_error_type as string) ?? null,
      error_count_30d: (row.error_count_30d as number) ?? 0,
      current_version: (row.current_version as string) ?? null,
      last_version_change: (row.last_version_change as string) ?? null,
      recent_breaking_change: (row.recent_breaking_change as number) === 1,
    });
  }
  return result;
}
