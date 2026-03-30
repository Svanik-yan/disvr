import type { Alternative } from "./types.js";

// ─── Get Alternatives for a Single Service ───

export async function getAlternatives(
  db: D1Database,
  serviceId: string,
  limit: number = 3
): Promise<Alternative[]> {
  // 1. Get source service info + health status
  const source = await db
    .prepare(
      `SELECT s.id, s.capabilities, h.overall_status
       FROM services s
       LEFT JOIN health_summary h ON s.id = h.service_id
       WHERE s.id = ?`
    )
    .bind(serviceId)
    .first<{ id: string; capabilities: string | null; overall_status: string | null }>();

  if (!source) return [];

  // Only suggest alternatives for degraded/dead services
  const status = source.overall_status;
  if (status !== "degraded" && status !== "dead") return [];

  // 2. Parse capabilities
  const capabilities = safeParseJson<string[]>(source.capabilities, []);
  if (capabilities.length === 0) {
    // No capabilities to match on — fall back to keyword search not possible here
    return [];
  }

  // 3. Find healthy services with overlapping capabilities
  //    Use json_each to match any capability overlap
  const capPlaceholders = capabilities.map((_, i) => `?${i + 3}`).join(",");
  const rows = await db
    .prepare(
      `SELECT DISTINCT s.id, s.name, s.description, s.reputation_score,
              COALESCE(h.overall_status, 'unknown') as health_status
       FROM services s
       LEFT JOIN health_summary h ON s.id = h.service_id
       WHERE s.id != ?1
         AND (h.overall_status IS NULL OR h.overall_status = 'healthy' OR h.overall_status = 'unknown')
         AND EXISTS (
           SELECT 1 FROM json_each(s.capabilities) je
           WHERE je.value IN (${capPlaceholders})
         )
       ORDER BY s.reputation_score DESC NULLS LAST
       LIMIT ?2`
    )
    .bind(serviceId, limit, ...capabilities)
    .all();

  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: truncate(r.description as string, 120),
    value_score: ((r.reputation_score as number) ?? 0) / 5, // normalize 0-5 to 0-1
    health_status: r.health_status as string,
    reason: "Same category replacement",
  }));
}

// ─── Batch Get Alternatives ───

export async function getBatchAlternatives(
  db: D1Database,
  serviceIds: string[],
  limit: number = 3
): Promise<Map<string, Alternative[]>> {
  if (serviceIds.length === 0) return new Map();

  // 1. Batch check which services are unhealthy
  const placeholders = serviceIds.map((_, i) => `?${i + 1}`).join(",");
  const healthRows = await db
    .prepare(
      `SELECT service_id, overall_status FROM health_summary
       WHERE service_id IN (${placeholders})
         AND overall_status IN ('degraded', 'dead')`
    )
    .bind(...serviceIds)
    .all();

  const unhealthyIds = (healthRows.results ?? []).map(
    (r) => r.service_id as string
  );

  if (unhealthyIds.length === 0) return new Map();

  // 2. Only query alternatives for unhealthy services
  const result = new Map<string, Alternative[]>();
  for (const id of unhealthyIds) {
    const alts = await getAlternatives(db, id, limit);
    if (alts.length > 0) {
      result.set(id, alts);
    }
  }

  return result;
}

// ─── Deprecation Overview ───

export async function getDeprecationOverview(
  db: D1Database
): Promise<{
  total_degraded: number;
  total_dead: number;
  with_alternatives: number;
  without_alternatives: number;
  recent_deprecations: Array<{
    service_id: string;
    name: string;
    status: string;
    capabilities: string[];
    detected_at: string;
  }>;
}> {
  const [statusRows, recentRows] = await Promise.all([
    db
      .prepare(
        `SELECT overall_status, COUNT(*) as c FROM health_summary
         WHERE overall_status IN ('degraded', 'dead')
         GROUP BY overall_status`
      )
      .all<{ overall_status: string; c: number }>(),
    db
      .prepare(
        `SELECT h.service_id, s.name, h.overall_status as status, s.capabilities, h.updated_at as detected_at
         FROM health_summary h
         JOIN services s ON s.id = h.service_id
         WHERE h.overall_status IN ('degraded', 'dead')
           AND h.updated_at > datetime('now', '-7 days')
         ORDER BY h.updated_at DESC
         LIMIT 20`
      )
      .all(),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of statusRows.results ?? []) {
    statusMap[row.overall_status] = row.c;
  }

  const totalDegraded = statusMap["degraded"] ?? 0;
  const totalDead = statusMap["dead"] ?? 0;

  // Check how many have alternatives (services with capabilities that overlap healthy services)
  const withAltsRow = await db
    .prepare(
      `SELECT COUNT(DISTINCT h.service_id) as c
       FROM health_summary h
       JOIN services s ON s.id = h.service_id
       WHERE h.overall_status IN ('degraded', 'dead')
         AND s.capabilities IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM services s2
           LEFT JOIN health_summary h2 ON s2.id = h2.service_id
           WHERE s2.id != s.id
             AND (h2.overall_status IS NULL OR h2.overall_status = 'healthy' OR h2.overall_status = 'unknown')
             AND EXISTS (
               SELECT 1 FROM json_each(s.capabilities) je1
               JOIN json_each(s2.capabilities) je2 ON je1.value = je2.value
             )
         )`
    )
    .first<{ c: number }>();

  const withAlternatives = withAltsRow?.c ?? 0;

  return {
    total_degraded: totalDegraded,
    total_dead: totalDead,
    with_alternatives: withAlternatives,
    without_alternatives: totalDegraded + totalDead - withAlternatives,
    recent_deprecations: (recentRows.results ?? []).map((r) => ({
      service_id: r.service_id as string,
      name: r.name as string,
      status: r.status as string,
      capabilities: safeParseJson<string[]>(r.capabilities as string, []),
      detected_at: r.detected_at as string,
    })),
  };
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

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}
