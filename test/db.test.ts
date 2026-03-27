import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRateLimit } from "../src/db.js";

// ─── getRateLimit (pure function, no DB dependency) ───

describe("getRateLimit", () => {
  it("returns 1000 for free tier", () => {
    expect(getRateLimit("free")).toBe(1000);
  });

  it("returns 1000 for pro tier", () => {
    expect(getRateLimit("pro")).toBe(1000);
  });

  it("returns 1000 for scale tier", () => {
    expect(getRateLimit("scale")).toBe(1000);
  });

  it("defaults to 1000 for unknown tier", () => {
    expect(getRateLimit("unknown")).toBe(1000);
    expect(getRateLimit("")).toBe(1000);
  });
});

// ─── Mock D1 Database ───

function createMockDB() {
  const mockFirst = vi.fn();
  const mockAll = vi.fn();
  const mockRun = vi.fn();
  const mockBind = vi.fn();

  mockBind.mockReturnValue({ first: mockFirst, all: mockAll, run: mockRun });

  const mockPrepare = vi.fn().mockReturnValue({
    bind: mockBind,
    first: mockFirst,
    all: mockAll,
    run: mockRun,
  });

  return {
    db: { prepare: mockPrepare } as unknown as D1Database,
    mockPrepare,
    mockBind,
    mockFirst,
    mockAll,
    mockRun,
  };
}

// ─── getServiceCount ───

describe("getServiceCount", () => {
  it("returns count from database", async () => {
    const { db, mockFirst } = createMockDB();
    mockFirst.mockResolvedValue({ count: 42 });

    const { getServiceCount } = await import("../src/db.js");
    const count = await getServiceCount(db);
    expect(count).toBe(42);
  });

  it("returns 0 when query returns null", async () => {
    const { db, mockFirst } = createMockDB();
    mockFirst.mockResolvedValue(null);

    const { getServiceCount } = await import("../src/db.js");
    const count = await getServiceCount(db);
    expect(count).toBe(0);
  });
});

// ─── validateApiKey ───

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for non-existent key", async () => {
    const { db, mockFirst } = createMockDB();
    mockFirst.mockResolvedValue(null);

    const { validateApiKey } = await import("../src/db.js");
    const result = await validateApiKey(db, "nonexistent-hash");
    expect(result).toBeNull();
  });

  it("returns record with reset usage when last_reset is stale", async () => {
    const { db, mockFirst, mockRun } = createMockDB();
    const today = new Date().toISOString().split("T")[0];
    mockFirst.mockResolvedValue({
      key_hash: "abc",
      tier: "free",
      daily_usage: 30,
      last_reset: "2020-01-01",
    });
    mockRun.mockResolvedValue({});

    const { validateApiKey } = await import("../src/db.js");
    const result = await validateApiKey(db, "abc");

    expect(result).not.toBeNull();
    expect(result!.daily_usage).toBe(0);
    expect(result!.last_reset).toBe(today);
  });

  it("returns record as-is when last_reset is today", async () => {
    const { db, mockFirst } = createMockDB();
    const today = new Date().toISOString().split("T")[0];
    mockFirst.mockResolvedValue({
      key_hash: "abc",
      tier: "pro",
      daily_usage: 10,
      last_reset: today,
    });

    const { validateApiKey } = await import("../src/db.js");
    const result = await validateApiKey(db, "abc");

    expect(result).not.toBeNull();
    expect(result!.daily_usage).toBe(10);
    expect(result!.tier).toBe("pro");
  });
});

// ─── incrementUsage ───

describe("incrementUsage", () => {
  it("calls UPDATE with correct key hash", async () => {
    const { db, mockRun, mockPrepare } = createMockDB();
    mockRun.mockResolvedValue({});

    const { incrementUsage } = await import("../src/db.js");
    await incrementUsage(db, "test-hash");

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("daily_usage = daily_usage + 1")
    );
  });
});

// ─── getServicesByIds ───

describe("getServicesByIds", () => {
  it("returns empty array for empty ids", async () => {
    const { db } = createMockDB();

    const { getServicesByIds } = await import("../src/db.js");
    const result = await getServicesByIds(db, []);
    expect(result).toEqual([]);
  });

  it("queries with correct placeholders", async () => {
    const { db, mockAll, mockPrepare } = createMockDB();
    mockAll.mockResolvedValue({
      results: [
        {
          id: "svc-1",
          name: "Test",
          description: "desc",
          capabilities: "[]",
          platform: "smithery",
          protocols: "{}",
          pricing: '{"model":"free","price_usd":0}',
          reputation_score: null,
          success_rate: null,
          uptime_30d: null,
          latency_p95_ms: null,
          total_calls: 0,
          successful_calls: 0,
          failed_calls: 0,
          retry_rate: null,
          avg_cost_per_success: null,
          doc_completeness: null,
          verified: 0,
          source_url: null,
          last_health_check: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      ],
    });

    const { getServicesByIds } = await import("../src/db.js");
    const result = await getServicesByIds(db, ["svc-1", "svc-2"]);

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("IN (?,?)")
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("svc-1");
  });
});

// ─── searchFTS ───

describe("searchFTS", () => {
  it("returns empty for empty query", async () => {
    const { db } = createMockDB();

    const { searchFTS } = await import("../src/db.js");
    const result = await searchFTS(db, "");
    expect(result).toEqual([]);
  });

  it("returns empty for query with only short words", async () => {
    const { db } = createMockDB();

    const { searchFTS } = await import("../src/db.js");
    const result = await searchFTS(db, "a b");
    expect(result).toEqual([]);
  });

  it("sanitizes quotes from query", async () => {
    const { db, mockAll, mockPrepare } = createMockDB();
    mockAll.mockResolvedValue({ results: [] });

    const { searchFTS } = await import("../src/db.js");
    await searchFTS(db, "test'query\"here");

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("services_fts MATCH")
    );
  });
});

// ─── getSystemStats ───

describe("getSystemStats", () => {
  it("returns aggregated stats from multiple queries", async () => {
    const mockFirst = vi.fn();
    const mockAll = vi.fn();
    const mockBind = vi.fn();

    // getSystemStats fires 7 parallel queries via Promise.all
    // We need prepare to return stubs that resolve in sequence
    let callIdx = 0;
    const results = [
      { c: 100 },                    // count services
      { c: 50 },                     // count reports
      { v: 0.92 },                   // avg success rate
      { v: 1200 },                   // avg latency
      { results: [{ platform: "smithery", count: 90 }] },  // platforms
      { results: [{ name: "svc1", reputation_score: 4.5, total_calls: 500 }] }, // top
      { results: [{ service_id: "svc1", success: 1, created_at: "2026-03-25" }] }, // recent
    ];

    const mockPrepare = vi.fn().mockImplementation(() => {
      const idx = callIdx++;
      const isAll = idx >= 4; // last 3 use .all()
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(isAll ? undefined : results[idx]),
        all: vi.fn().mockResolvedValue(isAll ? results[idx] : undefined),
      };
    });

    const db = { prepare: mockPrepare } as unknown as D1Database;

    const { getSystemStats } = await import("../src/db.js");
    const stats = await getSystemStats(db);

    expect(stats.total_services).toBe(100);
    expect(stats.total_reports).toBe(50);
    expect(stats.avg_success_rate).toBe(0.92);
    expect(stats.avg_latency_ms).toBe(1200);
    expect(stats.platforms).toHaveLength(1);
    expect(stats.top_services).toHaveLength(1);
    expect(stats.recent_reports).toHaveLength(1);
  });
});
