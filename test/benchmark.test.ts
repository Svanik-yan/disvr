import { describe, it, expect } from "vitest";
import {
  scoreAvailability,
  scoreInstallability,
  scoreResponsiveness,
  scoreFreshness,
  scorePopularity,
  matchScenarioFromQuery,
} from "../src/benchmark.js";
import { DEFAULT_SCENARIOS } from "../src/benchmark-scenarios.js";
import type { BenchmarkScenario, EvalWeights } from "../src/benchmark-scenarios.js";

// ─── scoreAvailability ───

describe("scoreAvailability", () => {
  it("returns 30 when health is null", () => {
    expect(scoreAvailability(null)).toBe(30);
  });

  it("returns uptime_30d * 100 when available", () => {
    expect(scoreAvailability({ uptime_30d: 0.95 })).toBe(95);
  });

  it("returns 100 for healthy status", () => {
    expect(scoreAvailability({ overall_status: "healthy" })).toBe(100);
  });

  it("returns 50 for degraded status", () => {
    expect(scoreAvailability({ overall_status: "degraded" })).toBe(50);
  });

  it("returns 10 for dead status", () => {
    expect(scoreAvailability({ overall_status: "dead" })).toBe(10);
  });

  it("returns 30 for unknown status", () => {
    expect(scoreAvailability({ overall_status: "unknown" })).toBe(30);
  });
});

// ─── scoreInstallability ───

describe("scoreInstallability", () => {
  it("returns 50 when health is null", () => {
    expect(scoreInstallability(null)).toBe(50);
  });

  it("returns install_score directly", () => {
    expect(scoreInstallability({ install_score: 85 })).toBe(85);
  });

  it("returns 50 when install_score is null", () => {
    expect(scoreInstallability({ install_score: null })).toBe(50);
  });
});

// ─── scoreResponsiveness ───

describe("scoreResponsiveness", () => {
  it("returns 50 when health is null", () => {
    expect(scoreResponsiveness(null)).toBe(50);
  });

  it("scores high for high success rate", () => {
    const score = scoreResponsiveness({ call_success_rate: 0.95, avg_response_ms: 200 });
    expect(score).toBe(100); // 90 + 10
  });

  it("scores lower for poor success rate", () => {
    const score = scoreResponsiveness({ call_success_rate: 0.2, avg_response_ms: null });
    expect(score).toBe(10);
  });

  it("scores by response time alone when no success rate", () => {
    expect(scoreResponsiveness({ call_success_rate: null, avg_response_ms: 300 })).toBe(80);
    expect(scoreResponsiveness({ call_success_rate: null, avg_response_ms: 800 })).toBe(70);
    expect(scoreResponsiveness({ call_success_rate: null, avg_response_ms: 5000 })).toBe(40);
  });

  it("penalizes slow response time", () => {
    const score = scoreResponsiveness({ call_success_rate: 0.95, avg_response_ms: 5000 });
    expect(score).toBe(80); // 90 - 10
  });
});

// ─── scoreFreshness ───

describe("scoreFreshness", () => {
  it("returns 40 when lastUpdated is null", () => {
    expect(scoreFreshness(null)).toBe(40);
  });

  it("returns 100 for recent updates (<30 days)", () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(recent)).toBe(100);
  });

  it("returns 80 for updates 30-90 days ago", () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(date)).toBe(80);
  });

  it("returns 50 for updates 90-180 days ago", () => {
    const date = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(date)).toBe(50);
  });

  it("returns 20 for updates >180 days ago", () => {
    const date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(date)).toBe(20);
  });
});

// ─── scorePopularity ───

describe("scorePopularity", () => {
  it("uses reputation_score when available", () => {
    expect(scorePopularity({ reputation_score: 4.5 })).toBe(90);
    expect(scorePopularity({ reputation_score: 5.0 })).toBe(100);
  });

  it("falls back to total_calls tiers", () => {
    expect(scorePopularity({ reputation_score: null, total_calls: 50000 })).toBe(100);
    expect(scorePopularity({ reputation_score: null, total_calls: 5000 })).toBe(80);
    expect(scorePopularity({ reputation_score: null, total_calls: 500 })).toBe(60);
    expect(scorePopularity({ reputation_score: null, total_calls: 50 })).toBe(40);
    expect(scorePopularity({ reputation_score: null, total_calls: 5 })).toBe(20);
  });

  it("returns 20 for zero calls and no reputation", () => {
    expect(scorePopularity({ reputation_score: null, total_calls: 0 })).toBe(20);
  });
});

// ─── DEFAULT_SCENARIOS ───

describe("DEFAULT_SCENARIOS", () => {
  it("has 10 scenarios", () => {
    expect(DEFAULT_SCENARIOS).toHaveLength(10);
  });

  it("all scenarios have valid weights summing to 1", () => {
    for (const s of DEFAULT_SCENARIOS) {
      const w = s.eval_weights;
      const sum = w.availability + w.installability + w.responsiveness + w.freshness + w.popularity;
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it("all scenarios have unique ids", () => {
    const ids = DEFAULT_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all scenarios have non-empty tags_match", () => {
    for (const s of DEFAULT_SCENARIOS) {
      expect(s.tags_match.length).toBeGreaterThan(0);
    }
  });
});

// ─── matchScenarioFromQuery ───

describe("matchScenarioFromQuery", () => {
  it("matches web search queries", () => {
    const result = matchScenarioFromQuery("I need to search the web");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("web-search");
  });

  it("matches database queries", () => {
    const result = matchScenarioFromQuery("query a postgres database");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("database");
  });

  it("matches email queries", () => {
    const result = matchScenarioFromQuery("send an email notification");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("email");
  });

  it("matches image generation queries", () => {
    const result = matchScenarioFromQuery("generate an image from prompt");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("image-generation");
  });

  it("returns null for unmatched queries", () => {
    expect(matchScenarioFromQuery("something completely random xyz")).toBeNull();
  });

  it("is case insensitive", () => {
    const result = matchScenarioFromQuery("SEARCH THE WEB");
    expect(result).not.toBeNull();
  });
});

// ─── BenchmarkScenario type ───

describe("BenchmarkScenario type structure", () => {
  it("has required fields", () => {
    const scenario = DEFAULT_SCENARIOS[0];
    expect(scenario).toHaveProperty("id");
    expect(scenario).toHaveProperty("name");
    expect(scenario).toHaveProperty("description");
    expect(scenario).toHaveProperty("category_match");
    expect(scenario).toHaveProperty("tags_match");
    expect(scenario).toHaveProperty("eval_weights");
  });

  it("eval_weights has all five dimensions", () => {
    const w = DEFAULT_SCENARIOS[0].eval_weights;
    expect(w).toHaveProperty("availability");
    expect(w).toHaveProperty("installability");
    expect(w).toHaveProperty("responsiveness");
    expect(w).toHaveProperty("freshness");
    expect(w).toHaveProperty("popularity");
  });
});
