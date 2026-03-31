// ─── Context-Aware Discovery ───
// Agent tells Disvr what tools it already has.
// Disvr excludes them and boosts complementary tools via co-occurrence data.

export interface ContextFilter {
  current_tools: string[];
  exclude: string[];
}

// ─── Build Context Filter ───

export function buildContextFilter(
  currentTools?: string[],
  exclude?: string[]
): ContextFilter {
  const tools = currentTools ?? [];
  const explicit = exclude ?? [];

  // Merge: current_tools are also excluded (don't recommend what agent already has)
  const allExclude = [...new Set([...tools, ...explicit])];

  return {
    current_tools: [...tools],
    exclude: allExclude,
  };
}

// ─── Apply Context Boost from Co-occurrence ───

export async function applyContextBoost(
  db: D1Database,
  recommendations: Array<{ id: string; value_score: number }>,
  currentTools: string[]
): Promise<Array<{ id: string; value_score: number; context_boost: number; cooccurring_tools: string[] }>> {
  if (currentTools.length === 0 || recommendations.length === 0) {
    return recommendations.map((r) => ({
      ...r,
      context_boost: 0,
      cooccurring_tools: [],
    }));
  }

  const candidateIds = recommendations.map((r) => r.id);

  // Batch query: find all co-occurrence pairs between candidates and current tools
  const candidatePlaceholders = candidateIds.map((_, i) => `?${i + 1}`).join(",");
  const ctOffset = candidateIds.length;
  const ctPlaceholders = currentTools.map((_, i) => `?${ctOffset + i + 1}`).join(",");

  const rows = await db
    .prepare(
      `SELECT service_id_a, service_id_b, co_count FROM tool_cooccurrence
       WHERE (service_id_a IN (${candidatePlaceholders}) AND service_id_b IN (${ctPlaceholders}))
          OR (service_id_b IN (${candidatePlaceholders}) AND service_id_a IN (${ctPlaceholders}))`
    )
    .bind(...candidateIds, ...currentTools)
    .all();

  // Aggregate co-occurrence counts per candidate
  const coCountMap = new Map<string, number>();
  const coToolsMap = new Map<string, Set<string>>();
  const candidateSet = new Set(candidateIds);
  const ctSet = new Set(currentTools);

  for (const row of rows.results ?? []) {
    const a = row.service_id_a as string;
    const b = row.service_id_b as string;
    const count = row.co_count as number;

    // Determine which is the candidate and which is the current tool
    let candidate: string;
    let currentTool: string;
    if (candidateSet.has(a) && ctSet.has(b)) {
      candidate = a;
      currentTool = b;
    } else if (candidateSet.has(b) && ctSet.has(a)) {
      candidate = b;
      currentTool = a;
    } else {
      continue;
    }

    coCountMap.set(candidate, (coCountMap.get(candidate) ?? 0) + count);
    if (!coToolsMap.has(candidate)) coToolsMap.set(candidate, new Set());
    coToolsMap.get(candidate)!.add(currentTool);
  }

  return recommendations.map((r) => {
    const totalCo = coCountMap.get(r.id) ?? 0;
    const boost = totalCo > 0 ? Math.min(0.05, totalCo * 0.01) : 0;
    const roundedBoost = Math.round(boost * 100) / 100;
    const coTools = coToolsMap.get(r.id);

    return {
      ...r,
      value_score: Math.round(Math.min(1, r.value_score + roundedBoost) * 100) / 100,
      context_boost: roundedBoost,
      cooccurring_tools: coTools ? [...coTools] : [],
    };
  });
}

// ─── Generate Context Reason ───

export function generateContextReason(
  serviceName: string,
  cooccurringTools: string[]
): string | null {
  if (cooccurringTools.length === 0) return null;

  if (cooccurringTools.length === 1) {
    return `Commonly used alongside ${cooccurringTools[0]}`;
  }

  const last = cooccurringTools[cooccurringTools.length - 1];
  const rest = cooccurringTools.slice(0, -1);
  return `Commonly used alongside ${rest.join(", ")} and ${last}`;
}
