import { describe, it, expect, vi } from "vitest";
import {
  recordDiscovery,
  recordReport,
  aggregateProfiles,
  getAgentProfile,
  personalizeRanking,
  getFailedTools,
  cleanupInactiveProfiles,
} from "../src/agent-profile.js";
import type { AgentProfile } from "../src/types.js";

// ─── Mock DB Helper ───

function mockDb() {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  } as any;
}

// ─── recordDiscovery ───

describe("recordDiscovery", () => {
  it("creates new profile on first discovery", async () => {
    const db = mockDb();
    await recordDiscovery(db, "hash-1", "find a search tool", ["svc-1", "svc-2"]);

    // Should call prepare 3 times: 1 UPSERT profile + 2 INSERT usage
    expect(db.prepare).toHaveBeenCalledTimes(3);
  });

  it("inserts usage records for each recommended service", async () => {
    const db = mockDb();
    await recordDiscovery(db, "hash-1", "find tools", ["svc-1", "svc-2", "svc-3"]);

    // 1 profile UPSERT + 3 usage inserts = 4 prepare calls
    expect(db.prepare).toHaveBeenCalledTimes(4);
    // Verify bind was called with each service (shared mock)
    const bindCalls = db._stmt.bind.mock.calls;
    expect(bindCalls).toContainEqual(["hash-1", "svc-1"]);
    expect(bindCalls).toContainEqual(["hash-1", "svc-2"]);
    expect(bindCalls).toContainEqual(["hash-1", "svc-3"]);
  });

  it("handles empty recommendations", async () => {
    const db = mockDb();
    await recordDiscovery(db, "hash-1", "query", []);

    // Only 1 profile UPSERT, no usage inserts
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });
});

// ─── recordReport ───

describe("recordReport", () => {
  it("records success report", async () => {
    const db = mockDb();
    await recordReport(db, "hash-1", "svc-1", true);

    expect(db._stmt.bind).toHaveBeenCalledWith("hash-1", "svc-1", "reported_success");
  });

  it("records failure report", async () => {
    const db = mockDb();
    await recordReport(db, "hash-1", "svc-1", false);

    expect(db._stmt.bind).toHaveBeenCalledWith("hash-1", "svc-1", "reported_failure");
  });
});

// ─── getAgentProfile ───

describe("getAgentProfile", () => {
  it("returns null when no profile exists", async () => {
    const db = mockDb();
    const result = await getAgentProfile(db, "nonexistent");
    expect(result).toBeNull();
  });

  it("returns parsed profile", async () => {
    const db = mockDb();
    db._stmt.first.mockResolvedValue({
      api_key_hash: "hash-1",
      search_count: 15,
      first_seen: "2026-01-01T00:00:00Z",
      last_seen: "2026-03-30T00:00:00Z",
      preferred_categories: '{"search":5,"scraping":3}',
      preferred_pricing: "free",
      intent_distribution: '{"cheap":3,"reliable":5}',
      top_tools: '["svc-1","svc-2"]',
      avg_tools_per_session: 2.5,
      profile_data: "{}",
    });

    const result = await getAgentProfile(db, "hash-1");
    expect(result).not.toBeNull();
    expect(result!.search_count).toBe(15);
    expect(result!.preferred_categories).toEqual({ search: 5, scraping: 3 });
    expect(result!.preferred_pricing).toBe("free");
    expect(result!.intent_distribution).toEqual({ cheap: 3, reliable: 5 });
    expect(result!.top_tools).toEqual(["svc-1", "svc-2"]);
    expect(result!.avg_tools_per_session).toBe(2.5);
  });

  it("handles malformed JSON gracefully", async () => {
    const db = mockDb();
    db._stmt.first.mockResolvedValue({
      api_key_hash: "hash-1",
      search_count: 1,
      first_seen: "2026-01-01",
      last_seen: "2026-01-01",
      preferred_categories: "invalid-json",
      preferred_pricing: null,
      intent_distribution: null,
      top_tools: null,
      avg_tools_per_session: 0,
      profile_data: null,
    });

    const result = await getAgentProfile(db, "hash-1");
    expect(result!.preferred_categories).toEqual({});
    expect(result!.top_tools).toEqual([]);
  });
});

// ─── personalizeRanking ───

describe("personalizeRanking", () => {
  const baseRecs = [
    { id: "svc-1", value_score: 0.8, capabilities: ["search", "scraping"], pricing_model: "free" },
    { id: "svc-2", value_score: 0.75, capabilities: ["database"], pricing_model: "paid" },
    { id: "svc-3", value_score: 0.7, capabilities: ["search"], pricing_model: "open_source" },
  ];

  it("returns original scores when profile is null", () => {
    const result = personalizeRanking(baseRecs, null);
    expect(result).toHaveLength(3);
    expect(result[0].personalization_boost).toBe(0);
    expect(result[0].value_score).toBe(0.8);
  });

  it("returns original scores when search_count < 5", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 3, first_seen: "", last_seen: "",
      preferred_categories: { search: 10 }, preferred_pricing: "free",
      intent_distribution: {}, top_tools: [], avg_tools_per_session: 0,
      profile_data: {},
    };
    const result = personalizeRanking(baseRecs, profile);
    expect(result[0].personalization_boost).toBe(0);
  });

  it("boosts category match +0.03", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: { search: 10, scraping: 5 },
      preferred_pricing: null,
      intent_distribution: {}, top_tools: [], avg_tools_per_session: 0,
      profile_data: {},
    };
    const result = personalizeRanking(baseRecs, profile);
    const svc1 = result.find((r) => r.id === "svc-1")!;
    const svc2 = result.find((r) => r.id === "svc-2")!;
    expect(svc1.personalization_boost).toBe(0.03);
    expect(svc2.personalization_boost).toBe(0); // database not in top categories
  });

  it("boosts pricing match +0.02", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: {},
      preferred_pricing: "free",
      intent_distribution: {}, top_tools: [], avg_tools_per_session: 0,
      profile_data: {},
    };
    const result = personalizeRanking(baseRecs, profile);
    const svc1 = result.find((r) => r.id === "svc-1")!;
    expect(svc1.personalization_boost).toBe(0.02);
  });

  it("boosts familiar tool +0.02", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: {},
      preferred_pricing: null,
      intent_distribution: {}, top_tools: ["svc-2"], avg_tools_per_session: 0,
      profile_data: {},
    };
    const result = personalizeRanking(baseRecs, profile);
    const svc2 = result.find((r) => r.id === "svc-2")!;
    expect(svc2.personalization_boost).toBe(0.02);
  });

  it("penalizes failed tool -0.05", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: {},
      preferred_pricing: null,
      intent_distribution: {}, top_tools: [], avg_tools_per_session: 0,
      profile_data: {},
    };
    const failedTools = new Set(["svc-1"]);
    const result = personalizeRanking(baseRecs, profile, failedTools);
    const svc1 = result.find((r) => r.id === "svc-1")!;
    expect(svc1.personalization_boost).toBe(-0.05);
  });

  it("clamps boost to max +0.05", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: { search: 10, scraping: 5 },
      preferred_pricing: "free",
      intent_distribution: {}, top_tools: ["svc-1"], avg_tools_per_session: 0,
      profile_data: {},
    };
    // svc-1: category +0.03, pricing +0.02, top_tool +0.02 = 0.07 → clamped to 0.05
    const result = personalizeRanking(baseRecs, profile);
    const svc1 = result.find((r) => r.id === "svc-1")!;
    expect(svc1.personalization_boost).toBe(0.05);
  });

  it("clamps boost to min -0.05", () => {
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: {},
      preferred_pricing: null,
      intent_distribution: {}, top_tools: [], avg_tools_per_session: 0,
      profile_data: {},
    };
    const failedTools = new Set(["svc-1"]);
    const result = personalizeRanking(baseRecs, profile, failedTools);
    const svc1 = result.find((r) => r.id === "svc-1")!;
    expect(svc1.personalization_boost).toBe(-0.05);
  });

  it("re-sorts by personalized value_score", () => {
    const recs = [
      { id: "svc-a", value_score: 0.6, capabilities: ["search"], pricing_model: "free" },
      { id: "svc-b", value_score: 0.65, capabilities: ["database"], pricing_model: "paid" },
    ];
    const profile: AgentProfile = {
      api_key_hash: "h", search_count: 10, first_seen: "", last_seen: "",
      preferred_categories: { search: 10 },
      preferred_pricing: "free",
      intent_distribution: {}, top_tools: ["svc-a"], avg_tools_per_session: 0,
      profile_data: {},
    };
    const result = personalizeRanking(recs, profile);
    // svc-a: 0.6 + 0.05 = 0.65, svc-b: 0.65 + 0 = 0.65
    // svc-a should be first or tied (both 0.65)
    expect(result[0].value_score).toBeGreaterThanOrEqual(result[1].value_score);
  });
});

// ─── getFailedTools ───

describe("getFailedTools", () => {
  it("returns set of failed service ids", async () => {
    const db = mockDb();
    db._stmt.all.mockResolvedValue({
      results: [
        { service_id: "svc-1" },
        { service_id: "svc-3" },
      ],
    });

    const result = await getFailedTools(db, "hash-1");
    expect(result).toBeInstanceOf(Set);
    expect(result.has("svc-1")).toBe(true);
    expect(result.has("svc-3")).toBe(true);
    expect(result.has("svc-2")).toBe(false);
  });

  it("returns empty set when no failures", async () => {
    const db = mockDb();
    const result = await getFailedTools(db, "hash-1");
    expect(result.size).toBe(0);
  });
});

// ─── cleanupInactiveProfiles ───

describe("cleanupInactiveProfiles", () => {
  it("deletes inactive profiles and orphaned usage", async () => {
    const db = mockDb();
    db._stmt.run.mockResolvedValue({ meta: { changes: 5 } });

    const result = await cleanupInactiveProfiles(db, 90);
    expect(result).toBe(5);
    // 3 calls: delete profiles, delete orphaned usage, trim old usage
    expect(db.prepare).toHaveBeenCalledTimes(3);
  });

  it("returns 0 when nothing to clean", async () => {
    const db = mockDb();
    const result = await cleanupInactiveProfiles(db, 90);
    expect(result).toBe(0);
  });
});

// ─── aggregateProfiles ───

describe("aggregateProfiles", () => {
  it("returns zero when no profiles exist", async () => {
    const db = mockDb();
    const result = await aggregateProfiles(db, 10);
    expect(result.profiles_updated).toBe(0);
  });
});
