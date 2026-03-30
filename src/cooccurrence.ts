import type { CooccurrencePair, CooccurrenceResult } from "./types.js";

// ─── Types ───

interface Session {
  api_key_hash: string;
  service_ids: string[];
}

// ─── Session Extraction ───

export async function extractSessions(
  db: D1Database,
  since?: string
): Promise<Session[]> {
  const sinceClause = since
    ? "AND created_at > ?"
    : "AND created_at > datetime('now', '-2 hours')";
  const params: (string | number)[] = [];
  if (since) params.push(since);

  const rows = await db
    .prepare(
      `SELECT api_key_hash, response_service_ids, created_at
       FROM request_logs
       WHERE endpoint = '/discover'
         AND response_service_ids IS NOT NULL
         ${sinceClause}
       ORDER BY api_key_hash, created_at`
    )
    .bind(...params)
    .all();

  if (!rows.results || rows.results.length === 0) return [];

  const sessions: Session[] = [];
  let currentKey = "";
  let currentServiceIds = new Set<string>();
  let lastTime = 0;

  for (const row of rows.results) {
    const keyHash = row.api_key_hash as string;
    const createdAt = new Date(row.created_at as string).getTime();
    const serviceIds = parseServiceIds(row.response_service_ids as string);

    if (serviceIds.length === 0) continue;

    const isNewSession =
      keyHash !== currentKey || createdAt - lastTime > 30 * 60 * 1000;

    if (isNewSession) {
      // Flush previous session
      if (currentServiceIds.size >= 2) {
        sessions.push({
          api_key_hash: currentKey,
          service_ids: Array.from(currentServiceIds),
        });
      }
      currentKey = keyHash;
      currentServiceIds = new Set<string>();
    }

    for (const id of serviceIds) {
      currentServiceIds.add(id);
    }
    lastTime = createdAt;
  }

  // Flush last session
  if (currentServiceIds.size >= 2) {
    sessions.push({
      api_key_hash: currentKey,
      service_ids: Array.from(currentServiceIds),
    });
  }

  return sessions;
}

function parseServiceIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

// ─── Pair Extraction ───

export function extractPairs(sessions: Session[]): CooccurrencePair[] {
  const pairs: CooccurrencePair[] = [];

  for (const session of sessions) {
    const ids = session.service_ids;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        pairs.push({ service_id_a: a, service_id_b: b });
      }
    }
  }

  return pairs;
}

// ─── Co-occurrence Update ───

export async function updateCooccurrence(
  db: D1Database,
  pairs: CooccurrencePair[]
): Promise<number> {
  if (pairs.length === 0) return 0;

  // Aggregate duplicates first
  const counts = new Map<string, number>();
  for (const p of pairs) {
    const key = `${p.service_id_a}|${p.service_id_b}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Batch upsert using D1 batch
  const stmts = [];
  for (const [key, count] of counts) {
    const [a, b] = key.split("|");
    stmts.push(
      db
        .prepare(
          `INSERT INTO tool_cooccurrence (service_id_a, service_id_b, co_count, last_seen)
           VALUES (?1, ?2, ?3, datetime('now'))
           ON CONFLICT(service_id_a, service_id_b)
           DO UPDATE SET co_count = co_count + ?3, last_seen = datetime('now')`
        )
        .bind(a, b, count)
    );
  }

  // D1 batch limit is 100 statements
  let updated = 0;
  for (let i = 0; i < stmts.length; i += 100) {
    const batch = stmts.slice(i, i + 100);
    await db.batch(batch);
    updated += batch.length;
  }

  return updated;
}

// ─── Query Co-occurrences ───

export async function getCooccurrences(
  db: D1Database,
  serviceId: string,
  limit: number = 3,
  minCount: number = 3
): Promise<CooccurrenceResult[]> {
  const rows = await db
    .prepare(
      `SELECT
        CASE WHEN c.service_id_a = ?1 THEN c.service_id_b ELSE c.service_id_a END as peer_id,
        c.co_count,
        s.name
       FROM tool_cooccurrence c
       JOIN services s ON s.id = CASE WHEN c.service_id_a = ?1 THEN c.service_id_b ELSE c.service_id_a END
       WHERE (c.service_id_a = ?1 OR c.service_id_b = ?1)
         AND c.co_count >= ?2
       ORDER BY c.co_count DESC
       LIMIT ?3`
    )
    .bind(serviceId, minCount, limit)
    .all();

  return (rows.results ?? []).map((r) => ({
    service_id: r.peer_id as string,
    name: r.name as string,
    co_count: r.co_count as number,
  }));
}

export async function getBatchCooccurrences(
  db: D1Database,
  serviceIds: string[],
  limit: number = 3,
  minCount: number = 3
): Promise<Map<string, CooccurrenceResult[]>> {
  if (serviceIds.length === 0) return new Map();

  // Use a single query with IN clause for efficiency
  const placeholders = serviceIds.map((_, i) => `?${i + 1}`).join(",");
  const rows = await db
    .prepare(
      `SELECT
        CASE WHEN c.service_id_a IN (${placeholders}) THEN c.service_id_a ELSE c.service_id_b END as source_id,
        CASE WHEN c.service_id_a IN (${placeholders}) THEN c.service_id_b ELSE c.service_id_a END as peer_id,
        c.co_count,
        s.name
       FROM tool_cooccurrence c
       JOIN services s ON s.id = CASE WHEN c.service_id_a IN (${placeholders}) THEN c.service_id_b ELSE c.service_id_a END
       WHERE (c.service_id_a IN (${placeholders}) OR c.service_id_b IN (${placeholders}))
         AND c.co_count >= ?${serviceIds.length + 1}
       ORDER BY c.co_count DESC`
    )
    .bind(...serviceIds, minCount)
    .all();

  const result = new Map<string, CooccurrenceResult[]>();
  for (const id of serviceIds) {
    result.set(id, []);
  }

  for (const row of rows.results ?? []) {
    const sourceId = row.source_id as string;
    const entry: CooccurrenceResult = {
      service_id: row.peer_id as string,
      name: row.name as string,
      co_count: row.co_count as number,
    };
    const list = result.get(sourceId);
    if (list && list.length < limit) {
      list.push(entry);
    }
  }

  return result;
}

// ─── Decay ───

export async function decayCooccurrence(
  db: D1Database,
  daysThreshold: number = 30
): Promise<number> {
  // Halve old counts
  const decayResult = await db
    .prepare(
      `UPDATE tool_cooccurrence
       SET co_count = MAX(1, co_count / 2)
       WHERE last_seen < datetime('now', '-' || ? || ' days')`
    )
    .bind(daysThreshold)
    .run();

  // Delete noise: co_count <= 1 and older than 60 days
  await db
    .prepare(
      `DELETE FROM tool_cooccurrence
       WHERE co_count <= 1
         AND last_seen < datetime('now', '-' || ? || ' days')`
    )
    .bind(daysThreshold * 2)
    .run();

  return decayResult.meta?.changes ?? 0;
}

// ─── Aggregation Entry Point ───

export async function runCooccurrenceAggregation(
  db: D1Database
): Promise<{ sessions_found: number; pairs_updated: number; decayed: number }> {
  // Use a 2-hour window for incremental processing
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const sessions = await extractSessions(db, since);
  const pairs = extractPairs(sessions);
  const pairsUpdated = await updateCooccurrence(db, pairs);
  const decayed = await decayCooccurrence(db, 30);

  return {
    sessions_found: sessions.length,
    pairs_updated: pairsUpdated,
    decayed,
  };
}
