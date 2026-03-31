import { describe, it, expect, vi } from "vitest";
import { buildContextFilter, applyContextBoost, generateContextReason } from "../src/context-aware.js";

// ─── buildContextFilter ───

describe("buildContextFilter", () => {
  it("returns empty arrays when no args", () => {
    const result = buildContextFilter();
    expect(result.current_tools).toEqual([]);
    expect(result.exclude).toEqual([]);
  });

  it("merges current_tools into exclude", () => {
    const result = buildContextFilter(["tool-a", "tool-b"]);
    expect(result.current_tools).toEqual(["tool-a", "tool-b"]);
    expect(result.exclude).toContain("tool-a");
    expect(result.exclude).toContain("tool-b");
  });

  it("merges explicit exclude with current_tools", () => {
    const result = buildContextFilter(["tool-a"], ["tool-c"]);
    expect(result.exclude).toContain("tool-a");
    expect(result.exclude).toContain("tool-c");
    expect(result.exclude.length).toBe(2);
  });

  it("deduplicates overlapping tools", () => {
    const result = buildContextFilter(["tool-a", "tool-b"], ["tool-b", "tool-c"]);
    expect(result.exclude.length).toBe(3);
    expect(new Set(result.exclude).size).toBe(3);
  });

  it("does not mutate input arrays", () => {
    const current = ["tool-a"];
    const exclude = ["tool-b"];
    buildContextFilter(current, exclude);
    expect(current).toEqual(["tool-a"]);
    expect(exclude).toEqual(["tool-b"]);
  });
});

// ─── generateContextReason ───

describe("generateContextReason", () => {
  it("returns null when no co-occurring tools", () => {
    expect(generateContextReason("test-tool", [])).toBeNull();
  });

  it("returns reason for single co-occurring tool", () => {
    const reason = generateContextReason("test-tool", ["github-mcp"]);
    expect(reason).toBe("Commonly used alongside github-mcp");
  });

  it("returns reason for two co-occurring tools", () => {
    const reason = generateContextReason("test-tool", ["github-mcp", "slack-mcp"]);
    expect(reason).toBe("Commonly used alongside github-mcp and slack-mcp");
  });

  it("returns reason for three+ co-occurring tools", () => {
    const reason = generateContextReason("test-tool", ["a", "b", "c"]);
    expect(reason).toBe("Commonly used alongside a, b and c");
  });
});

// ─── applyContextBoost ───

describe("applyContextBoost", () => {
  function mockDb(rows: Array<{ service_id_a: string; service_id_b: string; co_count: number }>) {
    return {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: rows }),
        }),
      }),
    } as unknown as D1Database;
  }

  it("returns zero boost when currentTools is empty", async () => {
    const db = mockDb([]);
    const recs = [{ id: "svc-1", value_score: 0.7 }];
    const result = await applyContextBoost(db, recs, []);
    expect(result[0].context_boost).toBe(0);
    expect(result[0].cooccurring_tools).toEqual([]);
    expect(result[0].value_score).toBe(0.7);
  });

  it("returns zero boost when recommendations is empty", async () => {
    const db = mockDb([]);
    const result = await applyContextBoost(db, [], ["tool-a"]);
    expect(result).toEqual([]);
  });

  it("applies boost from co-occurrence data (a→b direction)", async () => {
    const db = mockDb([
      { service_id_a: "svc-1", service_id_b: "tool-a", co_count: 3 },
    ]);
    const recs = [{ id: "svc-1", value_score: 0.7 }];
    const result = await applyContextBoost(db, recs, ["tool-a"]);
    expect(result[0].context_boost).toBe(0.03);
    expect(result[0].value_score).toBe(0.73);
    expect(result[0].cooccurring_tools).toEqual(["tool-a"]);
  });

  it("applies boost from co-occurrence data (b→a direction)", async () => {
    const db = mockDb([
      { service_id_a: "tool-a", service_id_b: "svc-1", co_count: 2 },
    ]);
    const recs = [{ id: "svc-1", value_score: 0.5 }];
    const result = await applyContextBoost(db, recs, ["tool-a"]);
    expect(result[0].context_boost).toBe(0.02);
    expect(result[0].value_score).toBe(0.52);
    expect(result[0].cooccurring_tools).toEqual(["tool-a"]);
  });

  it("caps boost at 0.05", async () => {
    const db = mockDb([
      { service_id_a: "svc-1", service_id_b: "tool-a", co_count: 10 },
    ]);
    const recs = [{ id: "svc-1", value_score: 0.7 }];
    const result = await applyContextBoost(db, recs, ["tool-a"]);
    expect(result[0].context_boost).toBe(0.05);
    expect(result[0].value_score).toBe(0.75);
  });

  it("caps value_score at 1.0", async () => {
    const db = mockDb([
      { service_id_a: "svc-1", service_id_b: "tool-a", co_count: 5 },
    ]);
    const recs = [{ id: "svc-1", value_score: 0.98 }];
    const result = await applyContextBoost(db, recs, ["tool-a"]);
    expect(result[0].value_score).toBe(1);
  });

  it("aggregates co-occurrence across multiple current tools", async () => {
    const db = mockDb([
      { service_id_a: "svc-1", service_id_b: "tool-a", co_count: 2 },
      { service_id_a: "svc-1", service_id_b: "tool-b", co_count: 1 },
    ]);
    const recs = [{ id: "svc-1", value_score: 0.6 }];
    const result = await applyContextBoost(db, recs, ["tool-a", "tool-b"]);
    expect(result[0].context_boost).toBe(0.03); // (2+1)*0.01 = 0.03
    expect(result[0].cooccurring_tools).toContain("tool-a");
    expect(result[0].cooccurring_tools).toContain("tool-b");
  });

  it("handles candidates with no co-occurrence data", async () => {
    const db = mockDb([
      { service_id_a: "svc-1", service_id_b: "tool-a", co_count: 3 },
    ]);
    const recs = [
      { id: "svc-1", value_score: 0.7 },
      { id: "svc-2", value_score: 0.6 },
    ];
    const result = await applyContextBoost(db, recs, ["tool-a"]);
    expect(result[0].context_boost).toBe(0.03);
    expect(result[1].context_boost).toBe(0);
    expect(result[1].value_score).toBe(0.6);
  });
});
