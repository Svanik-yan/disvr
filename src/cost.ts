import type { CostInfo, PricingModel } from "./types.js";

// ─── Text-Based Cost Extraction ───

const OPEN_SOURCE_PATTERNS = [
  /\bopen[\s-]?source\b/i,
  /\blicense\b[^.]*\b(MIT|Apache|GPL|ISC|BSD|MPL|LGPL|AGPL|Unlicense)\b/i,
  /\b(MIT|Apache-2\.0|GPL-[23]\.0|ISC|BSD-[23]-Clause)\s+licen[sc]e\b/i,
];

const PRICE_PER_CALL_RE = /\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:call|request|query|invocation)/i;
const MONTHLY_PRICE_RE = /\$(\d+(?:\.\d+)?)\s*(?:\/\s*(?:mo(?:nth)?|mon)|per\s+month)/i;
const DOLLAR_AMOUNT_RE = /\$(\d+(?:\.\d+)?)/g;
const FREE_TIER_CALLS_RE = /(?:free\s*(?:tier|plan)?[:\s]*(\d[\d,]*)\s*(?:calls?|requests?|queries?)(?:\s*\/\s*(?:day|daily))?|(\d[\d,]*)\s*(?:calls?|requests?|queries?)\s*(?:\/\s*(?:day|daily)\s*)?(?:free|included)|(?:first|up\s+to)\s+(\d[\d,]*)\s*(?:free\s+)?(?:calls?|requests?|queries?))/i;
const CALLS_PER_DAY_RE = /(\d[\d,]*)\s*(?:calls?|requests?|queries?)\s*(?:\/|per)\s*(?:day|daily)/i;

export function extractCostFromText(text: string): CostInfo {
  const result: CostInfo = {
    pricing_model: "unknown",
    cost_per_call: null,
    free_tier_limit: null,
    monthly_price: null,
    pricing_details: { source: "text" },
  };

  if (!text || text.trim().length === 0) return result;

  const lower = text.toLowerCase();

  // 1. Determine pricing_model
  const isOpenSource = OPEN_SOURCE_PATTERNS.some((re) => re.test(text));
  const hasDollar = lower.includes("$") || DOLLAR_AMOUNT_RE.test(text);
  const hasPricingKeywords = /\b(pricing|subscription|plan|tier)\b/i.test(text);
  const hasFreeTier = /(?<!no\s)\bfree\s*(tier|plan|trial)\b/i.test(lower);
  const hasNoFree = /\bno\s+free\b/i.test(lower);
  const hasFreeWord = /\bfree\b/i.test(lower) && !hasNoFree;
  const hasFreemiumWord = /\bfreemium\b/i.test(lower);

  if (isOpenSource) {
    result.pricing_model = "open_source";
    result.cost_per_call = 0;
    result.free_tier_limit = -1;
    result.monthly_price = 0;
  } else if (hasDollar || hasPricingKeywords) {
    if (hasFreeTier || hasFreemiumWord) {
      result.pricing_model = "freemium";
    } else {
      result.pricing_model = "paid";
    }
  } else if (hasFreeWord && !hasFreemiumWord) {
    result.pricing_model = "free";
    result.cost_per_call = 0;
    result.free_tier_limit = -1;
    result.monthly_price = 0;
  }

  // 2. Extract price numbers
  const perCallMatch = text.match(PRICE_PER_CALL_RE);
  if (perCallMatch) {
    result.cost_per_call = parseFloat(perCallMatch[1]);
  }

  const monthlyMatch = text.match(MONTHLY_PRICE_RE);
  if (monthlyMatch) {
    result.monthly_price = parseFloat(monthlyMatch[1]);
  }

  // 3. Extract free tier limit
  const freeTierMatch = text.match(FREE_TIER_CALLS_RE);
  if (freeTierMatch) {
    const num = (freeTierMatch[1] || freeTierMatch[2] || freeTierMatch[3]).replace(/,/g, "");
    result.free_tier_limit = parseInt(num, 10);
    if (result.pricing_model === "paid" || result.pricing_model === "unknown") {
      result.pricing_model = "freemium";
    }
  }

  // 4. Estimate cost_per_call if we have monthly price + daily limit
  if (result.cost_per_call === null && result.monthly_price !== null && result.monthly_price > 0) {
    const dailyMatch = text.match(CALLS_PER_DAY_RE);
    if (dailyMatch) {
      const dailyCalls = parseInt(dailyMatch[1].replace(/,/g, ""), 10);
      if (dailyCalls > 0) {
        result.cost_per_call = Math.round((result.monthly_price / (dailyCalls * 30)) * 10000) / 10000;
      }
    }
  }

  // 5. Set free_tier_limit for paid with no free tier
  if (result.pricing_model === "paid" && result.free_tier_limit === null) {
    result.free_tier_limit = 0;
  }

  return result;
}

// ─── Package-Based Inference ───

const OPEN_SOURCE_LICENSES = [
  "MIT", "Apache-2.0", "ISC", "BSD-2-Clause", "BSD-3-Clause",
  "GPL-2.0", "GPL-3.0", "LGPL-2.1", "LGPL-3.0", "MPL-2.0",
  "AGPL-3.0", "Unlicense", "0BSD", "CC0-1.0",
  "GPL-2.0-only", "GPL-3.0-only", "AGPL-3.0-only",
  "GPL-2.0-or-later", "GPL-3.0-or-later",
];

export function inferCostFromPackage(packageInfo: {
  license?: string;
  keywords?: string[];
  description?: string;
}): Partial<CostInfo> {
  const result: Partial<CostInfo> = {};

  if (packageInfo.license) {
    const license = packageInfo.license.trim();
    if (OPEN_SOURCE_LICENSES.some((l) => license.startsWith(l) || license === l)) {
      result.pricing_model = "open_source";
      result.cost_per_call = 0;
      result.free_tier_limit = -1;
      result.monthly_price = 0;
    }
  }

  if (packageInfo.keywords?.some((k) => k.toLowerCase() === "free")) {
    if (!result.pricing_model) {
      result.pricing_model = "free";
      result.cost_per_call = 0;
      result.free_tier_limit = -1;
    }
  }

  return result;
}

// ─── Repo-Based Inference ───

export function inferCostFromRepo(repoInfo: {
  license?: string;
  topics?: string[];
}): Partial<CostInfo> {
  const result: Partial<CostInfo> = {};

  if (repoInfo.license) {
    const license = repoInfo.license.trim();
    if (OPEN_SOURCE_LICENSES.some((l) => license.startsWith(l) || license === l)) {
      result.pricing_model = "open_source";
      result.cost_per_call = 0;
      result.free_tier_limit = -1;
      result.monthly_price = 0;
    }
  }

  if (repoInfo.topics?.some((t) => t === "free" || t === "open-source")) {
    if (!result.pricing_model) {
      result.pricing_model = "open_source";
      result.cost_per_call = 0;
      result.free_tier_limit = -1;
    }
  }

  return result;
}

// ─── Combined Determination ───

export function determineCost(
  description: string,
  packageInfo?: { license?: string; keywords?: string[]; description?: string },
  repoInfo?: { license?: string; topics?: string[] }
): CostInfo {
  // 1. Text extraction (highest priority)
  const textResult = extractCostFromText(description);

  // 2. If text gave a definitive answer, use it
  if (textResult.pricing_model !== "unknown") {
    return {
      ...textResult,
      pricing_details: { ...textResult.pricing_details, source: "text" },
    };
  }

  // 3. Try package info
  if (packageInfo) {
    const pkgResult = inferCostFromPackage(packageInfo);
    if (pkgResult.pricing_model) {
      return {
        pricing_model: pkgResult.pricing_model as PricingModel,
        cost_per_call: pkgResult.cost_per_call ?? null,
        free_tier_limit: pkgResult.free_tier_limit ?? null,
        monthly_price: pkgResult.monthly_price ?? null,
        pricing_details: { source: "package" },
      };
    }
  }

  // 4. Try repo info
  if (repoInfo) {
    const repoResult = inferCostFromRepo(repoInfo);
    if (repoResult.pricing_model) {
      return {
        pricing_model: repoResult.pricing_model as PricingModel,
        cost_per_call: repoResult.cost_per_call ?? null,
        free_tier_limit: repoResult.free_tier_limit ?? null,
        monthly_price: repoResult.monthly_price ?? null,
        pricing_details: { source: "repo" },
      };
    }
  }

  // 5. All sources exhausted → unknown
  return textResult;
}

// ─── Existing Pricing JSON Inference ───

function inferFromExistingPricing(pricing: string | null): Partial<CostInfo> | null {
  if (!pricing) return null;
  try {
    const p = JSON.parse(pricing);
    if (p.model === "free" && (p.price_usd === 0 || !p.price_usd)) {
      return {
        pricing_model: "free",
        cost_per_call: 0,
        free_tier_limit: -1,
        monthly_price: 0,
      };
    }
    if (p.model === "per_call" && p.price_usd > 0) {
      return {
        pricing_model: "paid",
        cost_per_call: p.price_usd,
        free_tier_limit: 0,
        monthly_price: null,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Batch Extraction ───

export async function runCostExtraction(
  db: D1Database,
  batchSize: number = 50
): Promise<{ processed: number; free: number; freemium: number; paid: number; open_source: number; unknown: number }> {
  const rows = await db
    .prepare(
      `SELECT id, description, pricing, source_url
       FROM services
       WHERE pricing_model IS NULL
       LIMIT ?`
    )
    .bind(batchSize)
    .all();

  if (!rows.results || rows.results.length === 0) {
    return { processed: 0, free: 0, freemium: 0, paid: 0, open_source: 0, unknown: 0 };
  }

  const stats = { processed: 0, free: 0, freemium: 0, paid: 0, open_source: 0, unknown: 0 };

  for (const row of rows.results as any[]) {
    // Try existing pricing JSON first
    const existingInference = inferFromExistingPricing(row.pricing);
    let costInfo: CostInfo;

    if (existingInference && existingInference.pricing_model !== "unknown") {
      costInfo = {
        pricing_model: existingInference.pricing_model as PricingModel,
        cost_per_call: existingInference.cost_per_call ?? null,
        free_tier_limit: existingInference.free_tier_limit ?? null,
        monthly_price: existingInference.monthly_price ?? null,
        pricing_details: { source: "existing_pricing" },
      };
    } else {
      // Determine from description + source URL context
      const isGitHub = row.source_url && (row.source_url as string).includes("github.com");
      const repoInfo = isGitHub ? { license: undefined, topics: ["open-source"] } : undefined;
      costInfo = determineCost(row.description as string, undefined, repoInfo);
    }

    await db
      .prepare(
        `UPDATE services SET
          pricing_model = ?1,
          pricing_details = ?2,
          cost_per_call = ?3,
          free_tier_limit = ?4,
          monthly_price = ?5,
          updated_at = datetime('now')
         WHERE id = ?6`
      )
      .bind(
        costInfo.pricing_model,
        JSON.stringify(costInfo.pricing_details),
        costInfo.cost_per_call,
        costInfo.free_tier_limit,
        costInfo.monthly_price,
        row.id
      )
      .run();

    stats.processed++;
    stats[costInfo.pricing_model as keyof typeof stats]++;
  }

  return stats;
}

// ─── Cost Efficiency Scoring (for Benchmark) ───

export function scoreCostEfficiency(service: {
  pricing_model?: string | null;
  free_tier_limit?: number | null;
  monthly_price?: number | null;
}): number {
  const model = service.pricing_model;
  if (model === "open_source") return 100;
  if (model === "free") return 95;
  if (model === "freemium") {
    const limit = service.free_tier_limit ?? 0;
    return limit > 100 || limit === -1 ? 80 : 60;
  }
  if (model === "paid") {
    const price = service.monthly_price;
    if (price === null || price === undefined) return 30;
    if (price < 10) return 50;
    if (price < 50) return 30;
    return 10;
  }
  return 50; // unknown → neutral
}
