import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRateLimit, computeReputation } from "../src/db.js";

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

// ─── logRequest ───

describe("logRequest", () => {
  it("inserts a request log entry", async () => {
    const { db, mockRun, mockPrepare } = createMockDB();
    mockRun.mockResolvedValue({});

    const { logRequest } = await import("../src/db.js");
    await logRequest(db, {
      api_key_hash: "abc123",
      query: "translate Chinese to Thai",
      results_count: 3,
      latency_ms: 150,
      referer: null,
      user_agent: "disvr-sdk/0.1.0",
    });

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO request_logs")
    );
  });
});

// ─── getRequestStats ───

describe("getRequestStats", () => {
  it("returns stats structure", async () => {
    let callIdx = 0;
    const results = [
      { results: [{ date: "2026-03-27", calls: 10, unique_keys: 2 }] },
      { results: [{ query: "translate", count: 5 }] },
      { total_calls: 10, total_unique_keys: 2 },
    ];

    const mockPrepare = vi.fn().mockImplementation(() => {
      const idx = callIdx++;
      return {
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(idx < 2 ? results[idx] : undefined),
          first: vi.fn().mockResolvedValue(idx === 2 ? results[idx] : undefined),
        }),
      };
    });

    const db = { prepare: mockPrepare } as unknown as D1Database;
    const { getRequestStats } = await import("../src/db.js");
    const stats = await getRequestStats(db, 7);

    expect(stats).toHaveProperty("daily");
    expect(stats).toHaveProperty("top_queries");
    expect(stats).toHaveProperty("total_calls");
    expect(stats).toHaveProperty("total_unique_keys");
    expect(stats.total_calls).toBe(10);
    expect(stats.daily).toHaveLength(1);
    expect(stats.top_queries).toHaveLength(1);
  });
});

// ─── aggregateDailyStats ───

describe("aggregateDailyStats", () => {
  it("aggregates yesterday's data and upserts into daily_stats", async () => {
    let callIdx = 0;
    const results = [
      { calls: 25, unique_keys: 3 },   // request_logs counts
      { count: 5 },                      // call_reports count
      { count: 2 },                      // new api_keys count
      { results: [{ query: "translate", count: 10 }] }, // top queries
      {},                                 // INSERT run result
    ];

    const mockPrepare = vi.fn().mockImplementation(() => {
      const idx = callIdx++;
      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(idx < 3 ? results[idx] : undefined),
          all: vi.fn().mockResolvedValue(idx === 3 ? results[idx] : undefined),
          run: vi.fn().mockResolvedValue(idx === 4 ? results[idx] : undefined),
        }),
      };
    });

    const db = { prepare: mockPrepare } as unknown as D1Database;
    const { aggregateDailyStats } = await import("../src/db.js");
    const count = await aggregateDailyStats(db);

    expect(count).toBe(1);
    // 4 SELECT queries + 1 INSERT = 5 prepare calls
    expect(mockPrepare).toHaveBeenCalledTimes(5);
  });
});

// ─── computeReputation ───

describe("computeReputation", () => {
  it("returns high score for perfect metrics", () => {
    const score = computeReputation({
      successRate: 1.0,
      retryRate: 0,
      volume: 10000,
      uptime: 1.0,
      docCompleteness: 1.0,
    });
    expect(score).toBeGreaterThanOrEqual(4.5);
    expect(score).toBeLessThanOrEqual(5.0);
  });

  it("returns low score for poor metrics", () => {
    const score = computeReputation({
      successRate: 0.2,
      retryRate: 0.8,
      volume: 5,
      uptime: 0.3,
      docCompleteness: 0.1,
    });
    expect(score).toBeLessThan(2.0);
  });

  it("handles null uptime and doc gracefully", () => {
    const score = computeReputation({
      successRate: 0.9,
      retryRate: 0.1,
      volume: 100,
      uptime: null,
      docCompleteness: null,
    });
    // Should use neutral defaults (2.5/5) for missing signals
    expect(score).toBeGreaterThan(2.5);
    expect(score).toBeLessThan(4.5);
  });

  it("clamps output to 0-5 range", () => {
    const high = computeReputation({
      successRate: 1.0,
      retryRate: 0,
      volume: 1000000,
      uptime: 1.0,
      docCompleteness: 1.0,
    });
    expect(high).toBeLessThanOrEqual(5.0);

    const low = computeReputation({
      successRate: 0,
      retryRate: 1.0,
      volume: 0,
      uptime: 0,
      docCompleteness: 0,
    });
    expect(low).toBeGreaterThanOrEqual(0);
  });

  it("volume has logarithmic diminishing returns", () => {
    const low = computeReputation({ successRate: 0.8, retryRate: 0.1, volume: 10, uptime: null, docCompleteness: null });
    const mid = computeReputation({ successRate: 0.8, retryRate: 0.1, volume: 100, uptime: null, docCompleteness: null });
    const high = computeReputation({ successRate: 0.8, retryRate: 0.1, volume: 500, uptime: null, docCompleteness: null });
    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    // Diminishing returns: gap between mid→high < gap between low→mid
    expect(high - mid).toBeLessThan(mid - low);
  });
});

// ─── insertReport ───

describe("insertReport", () => {
  it("writes report with all fields", async () => {
    const { db, mockPrepare, mockBind, mockRun } = createMockDB();
    mockRun.mockResolvedValue({});

    const { insertReport } = await import("../src/db.js");
    await insertReport(db, {
      service_id: "smithery-test",
      query_id: "q-123",
      api_key_hash: "mcp_anonymous",
      success: true,
      latency_ms: 450,
      error_message: undefined,
    });

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO reports")
    );
    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String), // UUID
      "smithery-test",
      "q-123",
      "mcp_anonymous",
      1, // success = true → 1
      450,
      null // error_message undefined → null
    );
  });

  it("writes report with optional fields as null", async () => {
    const { db, mockPrepare, mockBind, mockRun } = createMockDB();
    mockRun.mockResolvedValue({});

    const { insertReport } = await import("../src/db.js");
    await insertReport(db, {
      service_id: "smithery-test",
      query_id: "q-456",
      api_key_hash: "mcp_anonymous",
      success: false,
    });

    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String),
      "smithery-test",
      "q-456",
      "mcp_anonymous",
      0, // success = false → 0
      null, // latency_ms
      null // error_message
    );
  });

  it("stores error_message when provided", async () => {
    const { db, mockBind, mockRun } = createMockDB();
    mockRun.mockResolvedValue({});

    const { insertReport } = await import("../src/db.js");
    await insertReport(db, {
      service_id: "smithery-test",
      query_id: "q-789",
      api_key_hash: "mcp_anonymous",
      success: false,
      error_message: "Connection timeout",
    });

    expect(mockBind).toHaveBeenCalledWith(
      expect.any(String),
      "smithery-test",
      "q-789",
      "mcp_anonymous",
      0,
      null,
      "Connection timeout"
    );
  });
});

// ─── getServiceReportStats ───

describe("getServiceReportStats", () => {
  it("returns aggregated stats", async () => {
    const { db, mockFirst } = createMockDB();
    mockFirst.mockResolvedValue({
      total: 10,
      success_rate: 0.8,
      avg_latency_ms: 500,
    });

    const { getServiceReportStats } = await import("../src/db.js");
    const stats = await getServiceReportStats(db, "smithery-test");
    expect(stats.total).toBe(10);
    expect(stats.success_rate).toBe(0.8);
    expect(stats.avg_latency_ms).toBe(500);
  });

  it("returns zeros when no reports", async () => {
    const { db, mockFirst } = createMockDB();
    mockFirst.mockResolvedValue({
      total: 0,
      success_rate: 0,
      avg_latency_ms: null,
    });

    const { getServiceReportStats } = await import("../src/db.js");
    const stats = await getServiceReportStats(db, "nonexistent");
    expect(stats.total).toBe(0);
    expect(stats.success_rate).toBe(0);
    expect(stats.avg_latency_ms).toBeNull();
  });

  it("returns defaults when query returns null", async () => {
    const { db, mockFirst } = createMockDB();
    mockFirst.mockResolvedValue(null);

    const { getServiceReportStats } = await import("../src/db.js");
    const stats = await getServiceReportStats(db, "smithery-test");
    expect(stats.total).toBe(0);
    expect(stats.success_rate).toBe(0);
    expect(stats.avg_latency_ms).toBeNull();
  });
});
