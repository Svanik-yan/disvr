import { describe, it, expect } from "vitest";
import { applyConstraints, rankServices, generateReason, detectWeights, applyEliminationFilters, truncate } from "../src/discover.js";
import type { Service } from "../src/types.js";

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "test-001",
    name: "Test Service",
    description: "A test service for unit testing",
    capabilities: ["test", "mock"],
    platform: "smithery",
    protocols: { mcp: "mcp://test/service" },
    pricing: { model: "per_call", price_usd: 0.05 },
    reputation_score: 4.0,
    success_rate: 0.95,
    uptime_30d: 0.99,
    latency_p95_ms: 500,
    total_calls: 1000,
    successful_calls: 950,
    failed_calls: 50,
    retry_rate: 0.05,
    avg_cost_per_success: 0.053,
    doc_completeness: 0.8,
    verified: true,
    source_url: "https://example.com",
    ...overrides,
  };
}

describe("applyConstraints", () => {
  const candidates = [
    { service: makeService({ id: "cheap", pricing: { model: "per_call", price_usd: 0.01 } }), similarity: 0.9 },
    { service: makeService({ id: "expensive", pricing: { model: "per_call", price_usd: 0.50 } }), similarity: 0.85 },
    { service: makeService({ id: "free", pricing: { model: "free", price_usd: 0 } }), similarity: 0.8 },
  ];

  it("filters by max_price_per_call", () => {
    const result = applyConstraints(candidates, { need: "test", max_price_per_call: 0.05 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.service.id)).toContain("cheap");
    expect(result.map((r) => r.service.id)).toContain("free");
  });

  it("filters by max_latency_ms", () => {
    const items = [
      { service: makeService({ id: "fast", latency_p95_ms: 100 }), similarity: 0.9 },
      { service: makeService({ id: "slow", latency_p95_ms: 5000 }), similarity: 0.85 },
      { service: makeService({ id: "unknown", latency_p95_ms: null }), similarity: 0.8 },
    ];
    const result = applyConstraints(items, { need: "test", max_latency_ms: 1000 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.service.id)).toContain("fast");
    expect(result.map((r) => r.service.id)).toContain("unknown");
  });

  it("filters by min_reputation", () => {
    const items = [
      { service: makeService({ id: "good", reputation_score: 4.5 }), similarity: 0.9 },
      { service: makeService({ id: "bad", reputation_score: 2.0 }), similarity: 0.85 },
      { service: makeService({ id: "none", reputation_score: null }), similarity: 0.8 },
    ];
    const result = applyConstraints(items, { need: "test", min_reputation: 3.0 });
    expect(result).toHaveLength(1);
    expect(result[0].service.id).toBe("good");
  });

  it("filters by min_success_rate", () => {
    const items = [
      { service: makeService({ id: "reliable", success_rate: 0.98 }), similarity: 0.9 },
      { service: makeService({ id: "flaky", success_rate: 0.60 }), similarity: 0.85 },
    ];
    const result = applyConstraints(items, { need: "test", min_success_rate: 0.90 });
    expect(result).toHaveLength(1);
    expect(result[0].service.id).toBe("reliable");
  });

  it("returns all when no constraints", () => {
    const result = applyConstraints(candidates, { need: "test" });
    expect(result).toHaveLength(3);
  });
});

describe("rankServices", () => {
  it("ranks by value score (cost efficiency matters)", () => {
    const candidates = [
      {
        service: makeService({
          id: "cheap-good",
          success_rate: 0.95,
          avg_cost_per_success: 0.01,
          reputation_score: 4.0,
        }),
        similarity: 0.8,
      },
      {
        service: makeService({
          id: "expensive-great",
          success_rate: 0.99,
          avg_cost_per_success: 0.50,
          reputation_score: 4.8,
        }),
        similarity: 0.85,
      },
    ];

    const result = rankServices(candidates);
    // cheap-good should rank higher due to much better cost efficiency
    expect(result[0].service.id).toBe("cheap-good");
  });

  it("ranks free services highly on cost efficiency", () => {
    const candidates = [
      {
        service: makeService({
          id: "free-decent",
          pricing: { model: "free", price_usd: 0 },
          avg_cost_per_success: 0,
          success_rate: 0.85,
        }),
        similarity: 0.8,
      },
      {
        service: makeService({
          id: "paid-great",
          pricing: { model: "per_call", price_usd: 0.10 },
          avg_cost_per_success: 0.12,
          success_rate: 0.98,
        }),
        similarity: 0.8,
      },
    ];

    const result = rankServices(candidates);
    // Both should have valid scores
    expect(result[0].valueScore).toBeGreaterThan(0);
    expect(result[1].valueScore).toBeGreaterThan(0);
  });

  it("penalizes high retry rate", () => {
    const candidates = [
      {
        service: makeService({ id: "reliable", retry_rate: 0.02, success_rate: 0.98 }),
        similarity: 0.85,
      },
      {
        service: makeService({ id: "flaky", retry_rate: 0.40, success_rate: 0.60 }),
        similarity: 0.85,
      },
    ];

    const result = rankServices(candidates);
    expect(result[0].service.id).toBe("reliable");
  });

  it("returns results sorted by valueScore descending", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      service: makeService({
        id: `svc-${i}`,
        success_rate: Math.random(),
        avg_cost_per_success: Math.random() * 0.5,
      }),
      similarity: Math.random(),
    }));

    const result = rankServices(candidates);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].valueScore).toBeGreaterThanOrEqual(result[i].valueScore);
    }
  });
});

describe("generateReason", () => {
  it("includes cost per success for paid services", () => {
    const service = makeService({ avg_cost_per_success: 0.053 });
    const reason = generateReason(service, 0.85, 0.9);
    expect(reason).toContain("$0.0530/success");
  });

  it("marks free services", () => {
    const service = makeService({
      pricing: { model: "free", price_usd: 0 },
      avg_cost_per_success: 0,
    });
    const reason = generateReason(service, 0.7, 0.8);
    expect(reason).toContain("free");
  });

  it("flags high retry rate", () => {
    const service = makeService({ retry_rate: 0.25 });
    const reason = generateReason(service, 0.7, 0.8);
    expect(reason).toContain("retry rate");
  });

  it("includes best value for high score", () => {
    const service = makeService();
    const reason = generateReason(service, 0.85, 0.9);
    expect(reason).toContain("best value");
  });

  it("includes call volume", () => {
    const service = makeService({ total_calls: 50000 });
    const reason = generateReason(service, 0.7, 0.8);
    expect(reason).toContain("50k+ calls");
  });
});

// ─── detectWeights ───

describe("detectWeights", () => {
  it("returns default weights for generic query", () => {
    const w = detectWeights("translate document to French");
    expect(w.semantic).toBe(0.30);
    expect(w.quality).toBe(0.25);
    expect(w.cost_efficiency).toBe(0.25);
    expect(w.reliability).toBe(0.20);
  });

  it("boosts cost_efficiency for cost-sensitive query", () => {
    const w = detectWeights("find a free email sending tool");
    expect(w.cost_efficiency).toBe(0.45);
    expect(w.quality).toBe(0.15);
  });

  it("boosts reliability for reliability-sensitive query", () => {
    const w = detectWeights("need a reliable production-ready OCR");
    expect(w.reliability).toBe(0.40);
  });

  it("boosts quality for quality-sensitive query", () => {
    const w = detectWeights("find the best translation API");
    expect(w.quality).toBe(0.40);
  });

  it("boosts reliability for speed-sensitive query", () => {
    const w = detectWeights("need a fast image processing tool");
    expect(w.reliability).toBe(0.35);
  });

  it("handles low latency with underscore/space", () => {
    const w = detectWeights("need low latency voice recognition");
    expect(w.reliability).toBe(0.35);
  });

  it("matches first keyword only (no double-apply)", () => {
    const w = detectWeights("cheap and reliable tool");
    // "cheap" comes first in INTENT_KEYWORDS
    expect(w.cost_efficiency).toBe(0.45);
  });
});

// ─── applyEliminationFilters ───

describe("applyEliminationFilters", () => {
  it("eliminates services with uptime < 0.3", () => {
    const candidates = [
      { service: makeService({ id: "low", uptime_30d: 0.2 }), similarity: 0.9 },
      { service: makeService({ id: "ok", uptime_30d: 0.8 }), similarity: 0.85 },
    ];
    const result = applyEliminationFilters(candidates);
    expect(result).toHaveLength(1);
    expect(result[0].service.id).toBe("ok");
  });

  it("penalizes stale services (>180 days)", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const service = makeService({ id: "stale", reputation_score: 4.0 }) as any;
    service.updated_at = oldDate;
    const candidates = [{ service, similarity: 0.9 }];
    const result = applyEliminationFilters(candidates);
    expect(result[0].service.reputation_score).toBe(2.0); // 4.0 * 0.5
  });

  it("does not penalize recently updated services", () => {
    const recentDate = new Date().toISOString();
    const service = makeService({ id: "fresh", reputation_score: 4.0 }) as any;
    service.updated_at = recentDate;
    const candidates = [{ service, similarity: 0.9 }];
    const result = applyEliminationFilters(candidates);
    expect(result[0].service.reputation_score).toBe(4.0);
  });

  it("keeps services with null uptime (assumes good)", () => {
    const candidates = [
      { service: makeService({ id: "unknown", uptime_30d: null }), similarity: 0.9 },
    ];
    const result = applyEliminationFilters(candidates);
    expect(result).toHaveLength(1);
  });
});

// ─── Agent-Friendly Response Format ───

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("hello", 120)).toBe("hello");
  });

  it("truncates long text with ellipsis", () => {
    const long = "a".repeat(200);
    const result = truncate(long, 120);
    expect(result.length).toBe(120);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns exact-length text unchanged", () => {
    const exact = "a".repeat(120);
    expect(truncate(exact, 120)).toBe(exact);
  });
});

describe("agent-friendly recommendation format", () => {
  it("includes service_id, summary, and type in ranked output", () => {
    const service = makeService({
      id: "test-agent",
      name: "Test Agent Service",
      description: "A long description that helps agents understand what this service does in detail",
      service_type: "mcp_server",
      install: { command: "npx test-mcp", runtime: "node" },
    });
    const candidates = [{ service, similarity: 0.9 }];
    const ranked = rankServices(candidates, "translate document");
    expect(ranked).toHaveLength(1);
    expect(ranked[0].service.id).toBe("test-agent");
    expect(ranked[0].service.install).toEqual({ command: "npx test-mcp", runtime: "node" });
  });

  it("handles service without install info", () => {
    const service = makeService({
      id: "no-install",
      install: null,
    });
    const candidates = [{ service, similarity: 0.9 }];
    const ranked = rankServices(candidates, "test query");
    expect(ranked[0].service.install).toBeNull();
  });
});
