import type { AgentProfile, PersonalizationResult } from "./types.js";

// ─── Intent Keywords (simplified from discover.ts) ───

const INTENT_KEYWORDS = [
  "cheap", "free", "budget", "affordable",
  "reliable", "production", "stable", "enterprise",
  "best", "accurate", "precise", "advanced",
  "fast", "realtime", "low_latency",
];

function extractIntentKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return INTENT_KEYWORDS.filter((kw) => {
    const pattern = kw.replace("_", "[\\s-]?");
    return new RegExp(`\\b${pattern}\\b`).test(lower);
  });
}

// ─── Record Discovery ───

export async function recordDiscovery(
  db: D1Database,
  apiKeyHash: string,
  query: string,
  recommendedServiceIds: string[]
): Promise<void> {
  // 1. UPSERT agent_profiles
  await db
    .prepare(
      `INSERT INTO agent_profiles (api_key_hash, search_count, first_seen, last_seen)
       VALUES (?1, 1, datetime('now'), datetime('now'))
       ON CONFLICT(api_key_hash) DO UPDATE SET
         search_count = search_count + 1,
         last_seen = datetime('now'),
         updated_at = datetime('now')`
    )
    .bind(apiKeyHash)
    .run();

  // 2. Batch INSERT agent_tool_usage
  for (const serviceId of recommendedServiceIds) {
    await db
      .prepare(
        `INSERT INTO agent_tool_usage (api_key_hash, service_id, action)
         VALUES (?1, ?2, 'discovered')`
      )
      .bind(apiKeyHash, serviceId)
      .run();
  }
}

// ─── Record Report ───

export async function recordReport(
  db: D1Database,
  apiKeyHash: string,
  serviceId: string,
  success: boolean
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO agent_tool_usage (api_key_hash, service_id, action)
       VALUES (?1, ?2, ?3)`
    )
    .bind(apiKeyHash, serviceId, success ? "reported_success" : "reported_failure")
    .run();
}

// ─── Aggregate Profiles ───

export async function aggregateProfiles(
  db: D1Database,
  batchSize: number = 100
): Promise<{ profiles_updated: number }> {
  const rows = await db
    .prepare(
      `SELECT api_key_hash, search_count FROM agent_profiles
       ORDER BY updated_at ASC
       LIMIT ?`
    )
    .bind(batchSize)
    .all();

  if (!rows.results || rows.results.length === 0) {
    return { profiles_updated: 0 };
  }

  let updated = 0;

  for (const row of rows.results as any[]) {
    const keyHash = row.api_key_hash as string;
    const searchCount = row.search_count as number;

    // a. preferred_categories: capabilities from discovered services
    const catRows = await db
      .prepare(
        `SELECT s.capabilities, COUNT(*) as cnt
         FROM agent_tool_usage u
         JOIN services s ON u.service_id = s.id
         WHERE u.api_key_hash = ? AND u.action = 'discovered'
         GROUP BY s.capabilities
         ORDER BY cnt DESC
         LIMIT 50`
      )
      .bind(keyHash)
      .all();

    const categoryCount: Record<string, number> = {};
    for (const cr of (catRows.results ?? []) as any[]) {
      const caps = safeParseJsonArray(cr.capabilities);
      const cnt = cr.cnt as number;
      for (const cap of caps) {
        categoryCount[cap] = (categoryCount[cap] ?? 0) + cnt;
      }
    }

    // b. preferred_pricing: most common pricing_model
    const pricingRows = await db
      .prepare(
        `SELECT s.pricing_model, COUNT(*) as cnt
         FROM agent_tool_usage u
         JOIN services s ON u.service_id = s.id
         WHERE u.api_key_hash = ? AND u.action = 'discovered'
           AND s.pricing_model IS NOT NULL AND s.pricing_model != 'unknown'
         GROUP BY s.pricing_model
         ORDER BY cnt DESC
         LIMIT 1`
      )
      .bind(keyHash)
      .all();

    const preferredPricing =
      (pricingRows.results?.[0] as any)?.pricing_model ?? null;

    // c. intent_distribution from request_logs
    const intentRows = await db
      .prepare(
        `SELECT need FROM request_logs
         WHERE api_key_hash = ? AND need IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 100`
      )
      .bind(keyHash)
      .all();

    const intentDist: Record<string, number> = {};
    for (const ir of (intentRows.results ?? []) as any[]) {
      const keywords = extractIntentKeywords(ir.need as string);
      for (const kw of keywords) {
        intentDist[kw] = (intentDist[kw] ?? 0) + 1;
      }
    }

    // d. top_tools
    const toolRows = await db
      .prepare(
        `SELECT service_id, COUNT(*) as cnt
         FROM agent_tool_usage
         WHERE api_key_hash = ? AND action = 'discovered'
         GROUP BY service_id
         ORDER BY cnt DESC
         LIMIT 10`
      )
      .bind(keyHash)
      .all();

    const topTools = (toolRows.results ?? []).map(
      (r: any) => r.service_id as string
    );

    // e. avg_tools_per_session (simplified: total discovered / search_count)
    const totalDiscoveredRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM agent_tool_usage
         WHERE api_key_hash = ? AND action = 'discovered'`
      )
      .bind(keyHash)
      .first<{ cnt: number }>();

    const totalDiscovered = totalDiscoveredRow?.cnt ?? 0;
    const avgTools =
      searchCount > 0
        ? Math.round((totalDiscovered / searchCount) * 100) / 100
        : 0;

    // 3. Update profile
    await db
      .prepare(
        `UPDATE agent_profiles SET
           preferred_categories = ?1,
           preferred_pricing = ?2,
           intent_distribution = ?3,
           top_tools = ?4,
           avg_tools_per_session = ?5,
           updated_at = datetime('now')
         WHERE api_key_hash = ?6`
      )
      .bind(
        JSON.stringify(categoryCount),
        preferredPricing,
        JSON.stringify(intentDist),
        JSON.stringify(topTools),
        avgTools,
        keyHash
      )
      .run();

    updated++;
  }

  return { profiles_updated: updated };
}

// ─── Get Agent Profile ───

export async function getAgentProfile(
  db: D1Database,
  apiKeyHash: string
): Promise<AgentProfile | null> {
  const row = await db
    .prepare(
      `SELECT * FROM agent_profiles WHERE api_key_hash = ?`
    )
    .bind(apiKeyHash)
    .first();

  if (!row) return null;

  return {
    api_key_hash: row.api_key_hash as string,
    search_count: row.search_count as number,
    first_seen: row.first_seen as string,
    last_seen: row.last_seen as string,
    preferred_categories: safeParseJsonObj(row.preferred_categories as string),
    preferred_pricing: (row.preferred_pricing as string) ?? null,
    intent_distribution: safeParseJsonObj(row.intent_distribution as string),
    top_tools: safeParseJsonArray(row.top_tools as string),
    avg_tools_per_session: row.avg_tools_per_session as number,
    profile_data: safeParseJsonObj(row.profile_data as string),
  };
}

// ─── Personalize Ranking ───

export function personalizeRanking(
  recommendations: Array<{
    id: string;
    value_score: number;
    category?: string;
    capabilities?: string[];
    pricing_model?: string;
  }>,
  profile: AgentProfile | null,
  failedTools?: Set<string>
): PersonalizationResult[] {
  // No personalization if no profile or insufficient data
  if (!profile || profile.search_count < 5) {
    return recommendations.map((r) => ({
      id: r.id,
      value_score: r.value_score,
      personalization_boost: 0,
    }));
  }

  // Get top 3 categories
  const sortedCategories = Object.entries(profile.preferred_categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const topToolsSet = new Set(profile.top_tools);

  return recommendations
    .map((r) => {
      let boost = 0;

      // 1. Category preference match
      const rCategories = r.capabilities ?? [];
      const hasTopCategory = rCategories.some((c) =>
        sortedCategories.includes(c)
      );
      if (hasTopCategory) boost += 0.03;

      // 2. Pricing preference match
      if (
        profile.preferred_pricing &&
        r.pricing_model === profile.preferred_pricing
      ) {
        boost += 0.02;
      }

      // 3. Familiar tool bonus
      if (topToolsSet.has(r.id)) {
        boost += 0.02;
      }

      // 4. Historical failure penalty
      if (failedTools?.has(r.id)) {
        boost -= 0.05;
      }

      // Clamp boost to [-0.05, +0.05]
      boost = Math.max(-0.05, Math.min(0.05, boost));
      boost = Math.round(boost * 100) / 100;

      return {
        id: r.id,
        value_score:
          Math.round(Math.max(0, Math.min(1, r.value_score + boost)) * 100) /
          100,
        personalization_boost: boost,
      };
    })
    .sort((a, b) => b.value_score - a.value_score);
}

// ─── Get Failed Tools for Agent ───

export async function getFailedTools(
  db: D1Database,
  apiKeyHash: string
): Promise<Set<string>> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT service_id FROM agent_tool_usage
       WHERE api_key_hash = ? AND action = 'reported_failure'`
    )
    .bind(apiKeyHash)
    .all();

  return new Set(
    (rows.results ?? []).map((r: any) => r.service_id as string)
  );
}

// ─── Cleanup Inactive Profiles ───

export async function cleanupInactiveProfiles(
  db: D1Database,
  inactiveDays: number = 90
): Promise<number> {
  // Delete old profiles
  const result = await db
    .prepare(
      `DELETE FROM agent_profiles
       WHERE last_seen < datetime('now', '-' || ? || ' days')`
    )
    .bind(inactiveDays)
    .run();

  const deleted = result.meta?.changes ?? 0;

  // Clean orphaned usage records
  await db
    .prepare(
      `DELETE FROM agent_tool_usage
       WHERE api_key_hash NOT IN (SELECT api_key_hash FROM agent_profiles)`
    )
    .run();

  // Also trim old usage for active profiles (keep 90 days)
  await db
    .prepare(
      `DELETE FROM agent_tool_usage
       WHERE created_at < datetime('now', '-90 days')`
    )
    .run();

  return deleted;
}

// ─── Helpers ───

function safeParseJsonObj(value: string | null): Record<string, any> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeParseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
