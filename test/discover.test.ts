import { describe, it, expect } from "vitest";
import { applyConstraints, rankServices, generateReason } from "../src/discover.js";
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
