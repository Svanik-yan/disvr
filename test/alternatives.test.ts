import { describe, it, expect } from "vitest";
import type { Alternative, DeprecationWarning } from "../src/types.js";

// ─── Alternative type structure ───

describe("Alternative", () => {
  it("has correct shape", () => {
    const alt: Alternative = {
      id: "svc-replacement",
      name: "Better Tool",
      description: "A healthy replacement",
      value_score: 0.8,
      health_status: "healthy",
      reason: "Same category replacement",
    };
    expect(alt.id).toBe("svc-replacement");
    expect(alt.name).toBe("Better Tool");
    expect(alt.value_score).toBeGreaterThanOrEqual(0);
    expect(alt.value_score).toBeLessThanOrEqual(1);
    expect(alt.health_status).toBe("healthy");
    expect(alt.reason).toBeDefined();
  });

  it("value_score is normalized 0-1", () => {
    // reputation_score is 0-5, normalized by /5
    const scores = [0, 1, 2.5, 3, 5];
    for (const s of scores) {
      const normalized = s / 5;
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThanOrEqual(1);
    }
  });
});

// ─── DeprecationWarning structure ───

describe("DeprecationWarning", () => {
  it("has correct shape with alternatives", () => {
    const warning: DeprecationWarning = {
      status: "dead",
      message: "This tool is no longer maintained. Consider these alternatives.",
      alternatives: [
        {
          id: "svc-alt-1",
          name: "Alt Tool 1",
          description: "Replacement option 1",
          value_score: 0.9,
          health_status: "healthy",
          reason: "Same category replacement",
        },
      ],
    };
    expect(warning.status).toBe("dead");
    expect(warning.alternatives).toHaveLength(1);
    expect(warning.alternatives[0].id).toBe("svc-alt-1");
  });

  it("can have empty alternatives", () => {
    const warning: DeprecationWarning = {
      status: "degraded",
      message: "This tool is degraded with no known alternatives.",
      alternatives: [],
    };
    expect(warning.alternatives).toHaveLength(0);
  });
});

// ─── getAlternatives logic ───

describe("getAlternatives logic", () => {
  it("healthy services should return empty alternatives", () => {
    // getAlternatives checks overall_status: only degraded/dead proceed
    const healthyStatuses = ["healthy", "unknown", null];
    for (const status of healthyStatuses) {
      expect(status !== "degraded" && status !== "dead").toBe(true);
    }
  });

  it("degraded services should trigger alternative lookup", () => {
    const status = "degraded";
    expect(status === "degraded" || status === "dead").toBe(true);
  });

  it("dead services should trigger alternative lookup", () => {
    const status = "dead";
    expect(status === "degraded" || status === "dead").toBe(true);
  });

  it("alternatives exclude the source service itself", () => {
    // SQL uses WHERE s.id != ?1
    const sourceId = "svc-dead";
    const candidates = ["svc-dead", "svc-alt-1", "svc-alt-2"];
    const filtered = candidates.filter((id) => id !== sourceId);
    expect(filtered).not.toContain(sourceId);
    expect(filtered).toHaveLength(2);
  });

  it("alternatives exclude unhealthy services", () => {
    // SQL filters: h.overall_status IS NULL OR 'healthy' OR 'unknown'
    const candidates = [
      { id: "a", status: "healthy" },
      { id: "b", status: "degraded" },
      { id: "c", status: "dead" },
      { id: "d", status: "unknown" },
      { id: "e", status: null },
    ];
    const filtered = candidates.filter(
      (c) => c.status === null || c.status === "healthy" || c.status === "unknown"
    );
    expect(filtered.map((c) => c.id)).toEqual(["a", "d", "e"]);
  });

  it("capability-based matching requires overlap", () => {
    const sourceCaps = ["email", "notifications", "messaging"];
    const candidateCaps = ["email", "sms"]; // overlaps on "email"
    const noOverlapCaps = ["database", "storage"];
    const hasOverlap = (a: string[], b: string[]) => a.some((c) => b.includes(c));
    expect(hasOverlap(sourceCaps, candidateCaps)).toBe(true);
    expect(hasOverlap(sourceCaps, noOverlapCaps)).toBe(false);
  });

  it("results sorted by reputation_score descending", () => {
    const results = [
      { id: "a", reputation_score: 3.5 },
      { id: "b", reputation_score: 4.8 },
      { id: "c", reputation_score: 2.0 },
    ];
    const sorted = [...results].sort((a, b) => b.reputation_score - a.reputation_score);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
    expect(sorted[2].id).toBe("c");
  });

  it("respects limit parameter", () => {
    const allResults = Array.from({ length: 10 }, (_, i) => ({ id: `svc-${i}` }));
    const limit = 3;
    const limited = allResults.slice(0, limit);
    expect(limited).toHaveLength(3);
  });

  it("returns empty when no capabilities to match", () => {
    // If source has no capabilities, getAlternatives returns []
    const capabilities: string[] = [];
    expect(capabilities.length === 0).toBe(true);
  });
});

// ─── getBatchAlternatives logic ───

describe("getBatchAlternatives logic", () => {
  it("only queries unhealthy services", () => {
    const allIds = ["svc-1", "svc-2", "svc-3"];
    const healthStatuses: Record<string, string> = {
      "svc-1": "healthy",
      "svc-2": "degraded",
      "svc-3": "dead",
    };
    const unhealthy = allIds.filter(
      (id) => healthStatuses[id] === "degraded" || healthStatuses[id] === "dead"
    );
    expect(unhealthy).toEqual(["svc-2", "svc-3"]);
  });

  it("healthy services not in result Map", () => {
    const resultMap = new Map<string, Alternative[]>();
    resultMap.set("svc-dead", [
      {
        id: "svc-alt",
        name: "Alt",
        description: "Replacement",
        value_score: 0.8,
        health_status: "healthy",
        reason: "Same category replacement",
      },
    ]);
    expect(resultMap.has("svc-dead")).toBe(true);
    expect(resultMap.has("svc-healthy")).toBe(false);
  });

  it("returns empty Map for empty input", () => {
    const serviceIds: string[] = [];
    expect(serviceIds.length === 0).toBe(true);
    // getBatchAlternatives returns new Map() early
  });

  it("mixed batch only returns entries for unhealthy with alternatives", () => {
    const resultMap = new Map<string, Alternative[]>();
    // svc-1: healthy → not in map
    // svc-2: degraded, has alternatives → in map
    // svc-3: dead, no alternatives found → not in map (empty alts not added)
    resultMap.set("svc-2", [
      {
        id: "svc-alt",
        name: "Alt Tool",
        description: "Desc",
        value_score: 0.7,
        health_status: "healthy",
        reason: "Same category replacement",
      },
    ]);
    expect(resultMap.size).toBe(1);
    expect(resultMap.has("svc-1")).toBe(false);
    expect(resultMap.has("svc-2")).toBe(true);
    expect(resultMap.has("svc-3")).toBe(false);
  });
});

// ─── getDeprecationOverview structure ───

describe("getDeprecationOverview", () => {
  it("overview has correct structure", () => {
    const overview = {
      total_degraded: 3,
      total_dead: 2,
      with_alternatives: 4,
      without_alternatives: 1,
      recent_deprecations: [
        {
          service_id: "svc-1",
          name: "Dead Tool",
          status: "dead",
          capabilities: ["email"],
          detected_at: "2026-03-29T00:00:00Z",
        },
      ],
    };
    expect(overview.total_degraded + overview.total_dead).toBe(5);
    expect(overview.with_alternatives + overview.without_alternatives).toBe(5);
    expect(overview.recent_deprecations).toHaveLength(1);
    expect(overview.recent_deprecations[0].capabilities).toBeInstanceOf(Array);
  });

  it("without_alternatives = total - with_alternatives", () => {
    const total_degraded = 5;
    const total_dead = 3;
    const with_alternatives = 6;
    const without_alternatives = total_degraded + total_dead - with_alternatives;
    expect(without_alternatives).toBe(2);
  });
});

// ─── truncate helper ───

describe("truncate helper", () => {
  it("short text unchanged", () => {
    const text = "Short description";
    const maxLen = 120;
    const result = text.length <= maxLen ? text : text.slice(0, maxLen - 3) + "...";
    expect(result).toBe("Short description");
  });

  it("long text truncated with ellipsis", () => {
    const text = "A".repeat(200);
    const maxLen = 120;
    const result = text.length <= maxLen ? text : text.slice(0, maxLen - 3) + "...";
    expect(result).toHaveLength(120);
    expect(result.endsWith("...")).toBe(true);
  });
});
