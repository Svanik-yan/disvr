import { describe, it, expect } from "vitest";
import {
  extractCostFromText,
  inferCostFromPackage,
  inferCostFromRepo,
  determineCost,
  scoreCostEfficiency,
} from "../src/cost.js";

// ─── extractCostFromText ───

describe("extractCostFromText", () => {
  it("detects open source from MIT license mention", () => {
    const result = extractCostFromText("An open source MIT license tool for developers");
    expect(result.pricing_model).toBe("open_source");
    expect(result.cost_per_call).toBe(0);
    expect(result.free_tier_limit).toBe(-1);
  });

  it("detects open-source with hyphen", () => {
    const result = extractCostFromText("This is an open-source project");
    expect(result.pricing_model).toBe("open_source");
  });

  it("detects free tools", () => {
    const result = extractCostFromText("Free to use web scraper");
    expect(result.pricing_model).toBe("free");
    expect(result.cost_per_call).toBe(0);
    expect(result.free_tier_limit).toBe(-1);
    expect(result.monthly_price).toBe(0);
  });

  it("detects freemium from free tier + pricing", () => {
    const result = extractCostFromText("Free tier: 100 calls/day, Pro: $29/month");
    expect(result.pricing_model).toBe("freemium");
    expect(result.free_tier_limit).toBe(100);
    expect(result.monthly_price).toBe(29);
  });

  it("detects paid with per-call pricing", () => {
    const result = extractCostFromText("$0.01 per call, no free tier");
    expect(result.pricing_model).toBe("paid");
    expect(result.cost_per_call).toBe(0.01);
    expect(result.free_tier_limit).toBe(0);
  });

  it("detects paid with monthly pricing", () => {
    const result = extractCostFromText("Pricing: $49/month for unlimited access");
    expect(result.pricing_model).toBe("paid");
    expect(result.monthly_price).toBe(49);
  });

  it("returns unknown for no pricing info", () => {
    const result = extractCostFromText("A tool that does things");
    expect(result.pricing_model).toBe("unknown");
  });

  it("handles empty string", () => {
    expect(extractCostFromText("").pricing_model).toBe("unknown");
  });

  it("detects freemium from dollar + free mentions", () => {
    const result = extractCostFromText("$0.001 per request, first 1000 free requests included");
    expect(result.pricing_model).toBe("freemium");
    expect(result.cost_per_call).toBe(0.001);
    expect(result.free_tier_limit).toBe(1000);
  });

  it("extracts calls per day limit", () => {
    const result = extractCostFromText("Free plan: 500 requests/day. Pro: $19/mo");
    expect(result.free_tier_limit).toBe(500);
    expect(result.monthly_price).toBe(19);
  });
});

// ─── inferCostFromPackage ───

describe("inferCostFromPackage", () => {
  it("detects MIT license as open_source", () => {
    const result = inferCostFromPackage({ license: "MIT" });
    expect(result.pricing_model).toBe("open_source");
    expect(result.cost_per_call).toBe(0);
    expect(result.free_tier_limit).toBe(-1);
  });

  it("detects Apache-2.0 as open_source", () => {
    const result = inferCostFromPackage({ license: "Apache-2.0" });
    expect(result.pricing_model).toBe("open_source");
  });

  it("detects ISC as open_source", () => {
    const result = inferCostFromPackage({ license: "ISC" });
    expect(result.pricing_model).toBe("open_source");
  });

  it("detects free keyword", () => {
    const result = inferCostFromPackage({ keywords: ["free", "api"] });
    expect(result.pricing_model).toBe("free");
  });

  it("returns empty for no license info", () => {
    const result = inferCostFromPackage({});
    expect(result.pricing_model).toBeUndefined();
  });
});

// ─── inferCostFromRepo ───

describe("inferCostFromRepo", () => {
  it("detects MIT license as open_source", () => {
    const result = inferCostFromRepo({ license: "MIT" });
    expect(result.pricing_model).toBe("open_source");
  });

  it("detects open-source topic", () => {
    const result = inferCostFromRepo({ topics: ["open-source", "tools"] });
    expect(result.pricing_model).toBe("open_source");
  });

  it("returns empty for no info", () => {
    const result = inferCostFromRepo({});
    expect(result.pricing_model).toBeUndefined();
  });
});

// ─── determineCost ───

describe("determineCost", () => {
  it("text result takes priority over package", () => {
    const result = determineCost(
      "Free to use API",
      { license: "MIT" }
    );
    expect(result.pricing_model).toBe("free");
    expect(result.pricing_details.source).toBe("text");
  });

  it("falls back to package when text is unknown", () => {
    const result = determineCost(
      "A tool for data processing",
      { license: "MIT" }
    );
    expect(result.pricing_model).toBe("open_source");
    expect(result.pricing_details.source).toBe("package");
  });

  it("falls back to repo when text and package are unknown", () => {
    const result = determineCost(
      "A tool for data processing",
      undefined,
      { license: "Apache-2.0" }
    );
    expect(result.pricing_model).toBe("open_source");
    expect(result.pricing_details.source).toBe("repo");
  });

  it("returns unknown when all sources fail", () => {
    const result = determineCost("A tool for data processing");
    expect(result.pricing_model).toBe("unknown");
  });
});

// ─── scoreCostEfficiency ───

describe("scoreCostEfficiency", () => {
  it("scores open_source as 100", () => {
    expect(scoreCostEfficiency({ pricing_model: "open_source" })).toBe(100);
  });

  it("scores free as 95", () => {
    expect(scoreCostEfficiency({ pricing_model: "free" })).toBe(95);
  });

  it("scores freemium with generous free tier as 80", () => {
    expect(scoreCostEfficiency({ pricing_model: "freemium", free_tier_limit: 500 })).toBe(80);
  });

  it("scores freemium with small free tier as 60", () => {
    expect(scoreCostEfficiency({ pricing_model: "freemium", free_tier_limit: 50 })).toBe(60);
  });

  it("scores freemium with unlimited free tier as 80", () => {
    expect(scoreCostEfficiency({ pricing_model: "freemium", free_tier_limit: -1 })).toBe(80);
  });

  it("scores cheap paid as 50", () => {
    expect(scoreCostEfficiency({ pricing_model: "paid", monthly_price: 5 })).toBe(50);
  });

  it("scores moderate paid as 30", () => {
    expect(scoreCostEfficiency({ pricing_model: "paid", monthly_price: 29 })).toBe(30);
  });

  it("scores expensive paid as 10", () => {
    expect(scoreCostEfficiency({ pricing_model: "paid", monthly_price: 99 })).toBe(10);
  });

  it("scores unknown as 50", () => {
    expect(scoreCostEfficiency({ pricing_model: "unknown" })).toBe(50);
    expect(scoreCostEfficiency({ pricing_model: null })).toBe(50);
  });
});
