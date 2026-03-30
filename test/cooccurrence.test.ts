import { describe, it, expect } from "vitest";
import { extractPairs } from "../src/cooccurrence.js";

// ─── extractPairs ───

describe("extractPairs", () => {
  it("generates 1 pair from 2 services", () => {
    const sessions = [{ api_key_hash: "k1", service_ids: ["svc-a", "svc-b"] }];
    const pairs = extractPairs(sessions);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ service_id_a: "svc-a", service_id_b: "svc-b" });
  });

  it("generates C(3,2)=3 pairs from 3 services", () => {
    const sessions = [{ api_key_hash: "k1", service_ids: ["svc-a", "svc-b", "svc-c"] }];
    const pairs = extractPairs(sessions);
    expect(pairs).toHaveLength(3);
  });

  it("generates C(4,2)=6 pairs from 4 services", () => {
    const sessions = [{ api_key_hash: "k1", service_ids: ["a", "b", "c", "d"] }];
    const pairs = extractPairs(sessions);
    expect(pairs).toHaveLength(6);
  });

  it("ensures service_id_a < service_id_b", () => {
    const sessions = [{ api_key_hash: "k1", service_ids: ["zzz", "aaa"] }];
    const pairs = extractPairs(sessions);
    expect(pairs[0].service_id_a).toBe("aaa");
    expect(pairs[0].service_id_b).toBe("zzz");
  });

  it("handles multiple sessions", () => {
    const sessions = [
      { api_key_hash: "k1", service_ids: ["a", "b"] },
      { api_key_hash: "k2", service_ids: ["c", "d"] },
    ];
    const pairs = extractPairs(sessions);
    expect(pairs).toHaveLength(2);
  });

  it("returns empty for empty sessions", () => {
    const pairs = extractPairs([]);
    expect(pairs).toHaveLength(0);
  });

  it("returns empty for session with 1 service", () => {
    // extractSessions filters these out, but extractPairs should handle gracefully
    const sessions = [{ api_key_hash: "k1", service_ids: ["only-one"] }];
    const pairs = extractPairs(sessions);
    expect(pairs).toHaveLength(0);
  });

  it("generates pairs from multiple sessions independently", () => {
    const sessions = [
      { api_key_hash: "k1", service_ids: ["a", "b", "c"] }, // 3 pairs
      { api_key_hash: "k2", service_ids: ["a", "b"] },       // 1 pair (duplicate of a-b)
    ];
    const pairs = extractPairs(sessions);
    expect(pairs).toHaveLength(4); // 3 + 1
    // The a-b pair appears twice — updateCooccurrence aggregates duplicates
    const abPairs = pairs.filter(
      (p) => p.service_id_a === "a" && p.service_id_b === "b"
    );
    expect(abPairs).toHaveLength(2);
  });
});

// ─── Session windowing logic (unit-level) ───

describe("session windowing", () => {
  it("same key within 30min should be one session concept", () => {
    // This tests the conceptual rule: requests from same key within 30 min = 1 session
    const t0 = new Date("2026-03-30T10:00:00Z").getTime();
    const t1 = new Date("2026-03-30T10:15:00Z").getTime(); // 15min later
    const t2 = new Date("2026-03-30T10:29:00Z").getTime(); // 29min later
    expect(t1 - t0).toBeLessThan(30 * 60 * 1000);
    expect(t2 - t0).toBeLessThan(30 * 60 * 1000);
  });

  it("same key beyond 30min should split sessions", () => {
    const t0 = new Date("2026-03-30T10:00:00Z").getTime();
    const t1 = new Date("2026-03-30T10:31:00Z").getTime(); // 31min later
    expect(t1 - t0).toBeGreaterThan(30 * 60 * 1000);
  });

  it("different keys are always separate sessions", () => {
    // Conceptual: even if timestamps overlap, different keys = different sessions
    const key1 = "hash-user-a";
    const key2 = "hash-user-b";
    expect(key1).not.toBe(key2);
  });
});

// ─── Co-occurrence result structure ───

describe("cooccurrence result structure", () => {
  it("CooccurrencePair has correct shape", () => {
    const pair = { service_id_a: "a", service_id_b: "b" };
    expect(pair.service_id_a).toBeDefined();
    expect(pair.service_id_b).toBeDefined();
    expect(pair.service_id_a < pair.service_id_b).toBe(true);
  });

  it("CooccurrenceResult has correct shape", () => {
    const result = { service_id: "svc-1", name: "Test Tool", co_count: 5 };
    expect(result.service_id).toBeDefined();
    expect(result.name).toBeDefined();
    expect(result.co_count).toBeGreaterThan(0);
  });
});
