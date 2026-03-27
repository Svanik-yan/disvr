import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("../src/db.js", () => ({
  getRepeatSearchSignals: vi.fn(),
  getSatisfiedSearchSignals: vi.fn(),
  getLowConfidenceSignals: vi.fn(),
  upsertServiceSignal: vi.fn(),
  aggregateDailyStats: vi.fn(),
}));

import {
  getRepeatSearchSignals,
  getSatisfiedSearchSignals,
  getLowConfidenceSignals,
  upsertServiceSignal,
  aggregateDailyStats,
} from "../src/db.js";
import { runSignalAggregation } from "../src/signals.js";

const mockGetRepeat = vi.mocked(getRepeatSearchSignals);
const mockGetSatisfied = vi.mocked(getSatisfiedSearchSignals);
const mockGetLowConf = vi.mocked(getLowConfidenceSignals);
const mockUpsert = vi.mocked(upsertServiceSignal);
const mockAggregate = vi.mocked(aggregateDailyStats);

describe("runSignalAggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue(undefined);
    mockAggregate.mockResolvedValue(1);
  });

  it("processes repeat search signals with penalty cap at -0.3", async () => {
    mockGetRepeat.mockResolvedValue([
      { service_ids: '["svc-1","svc-2"]', repeat_count: 10 },
    ]);
    mockGetSatisfied.mockResolvedValue([]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    const result = await runSignalAggregation(db);

    expect(result.repeat).toBe(2); // 2 services
    // Penalty should be capped at -0.3 (not -0.5)
    expect(mockUpsert).toHaveBeenCalledWith(db, {
      service_id: "svc-1",
      signal_type: "repeat_search",
      signal_value: -0.3,
      sample_count: 10,
    });
    expect(mockUpsert).toHaveBeenCalledWith(db, {
      service_id: "svc-2",
      signal_type: "repeat_search",
      signal_value: -0.3,
      sample_count: 10,
    });
  });

  it("applies -0.05 per repeat for small counts", async () => {
    mockGetRepeat.mockResolvedValue([
      { service_ids: '["svc-1"]', repeat_count: 2 },
    ]);
    mockGetSatisfied.mockResolvedValue([]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    await runSignalAggregation(db);

    expect(mockUpsert).toHaveBeenCalledWith(db, {
      service_id: "svc-1",
      signal_type: "repeat_search",
      signal_value: -0.1,
      sample_count: 2,
    });
  });

  it("processes satisfied signals with bonus cap at +0.2", async () => {
    mockGetRepeat.mockResolvedValue([]);
    mockGetSatisfied.mockResolvedValue([
      { service_ids: '["svc-a"]', satisfied_count: 20 },
    ]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    const result = await runSignalAggregation(db);

    expect(result.satisfied).toBe(1);
    // Bonus capped at +0.2 (not 0.4)
    expect(mockUpsert).toHaveBeenCalledWith(db, {
      service_id: "svc-a",
      signal_type: "satisfied",
      signal_value: 0.2,
      sample_count: 20,
    });
  });

  it("applies +0.02 per satisfied search for small counts", async () => {
    mockGetRepeat.mockResolvedValue([]);
    mockGetSatisfied.mockResolvedValue([
      { service_ids: '["svc-b"]', satisfied_count: 3 },
    ]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    await runSignalAggregation(db);

    expect(mockUpsert).toHaveBeenCalledWith(db, {
      service_id: "svc-b",
      signal_type: "satisfied",
      signal_value: 0.06,
      sample_count: 3,
    });
  });

  it("processes low confidence signals with multiplier 0.7–1.0", async () => {
    mockGetRepeat.mockResolvedValue([]);
    mockGetSatisfied.mockResolvedValue([]);
    mockGetLowConf.mockResolvedValue([
      { service_id: "svc-x", recommend_count: 50, report_count: 0 },
      { service_id: "svc-y", recommend_count: 15, report_count: 0 },
    ]);

    const db = {} as D1Database;
    const result = await runSignalAggregation(db);

    expect(result.low_confidence).toBe(2);
    // 50 recs → multiplier 0.7
    expect(mockUpsert).toHaveBeenCalledWith(db, {
      service_id: "svc-x",
      signal_type: "low_confidence",
      signal_value: 0.7,
      sample_count: 50,
    });
    // 15 recs → multiplier ~0.9625
    const call = mockUpsert.mock.calls.find(
      (c) => c[1].service_id === "svc-y" && c[1].signal_type === "low_confidence"
    );
    expect(call).toBeDefined();
    expect(call![1].signal_value).toBeGreaterThan(0.9);
    expect(call![1].signal_value).toBeLessThan(1.0);
  });

  it("handles empty signals gracefully", async () => {
    mockGetRepeat.mockResolvedValue([]);
    mockGetSatisfied.mockResolvedValue([]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    const result = await runSignalAggregation(db);

    expect(result.repeat).toBe(0);
    expect(result.satisfied).toBe(0);
    expect(result.low_confidence).toBe(0);
    expect(result.daily_stats).toBe(1);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockAggregate).toHaveBeenCalledWith(db);
  });

  it("handles invalid JSON in service_ids", async () => {
    mockGetRepeat.mockResolvedValue([
      { service_ids: "not-json", repeat_count: 3 },
    ]);
    mockGetSatisfied.mockResolvedValue([
      { service_ids: "", satisfied_count: 5 },
    ]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    const result = await runSignalAggregation(db);

    // Invalid JSON should be silently skipped
    expect(result.repeat).toBe(0);
    expect(result.satisfied).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("handles null service_ids", async () => {
    mockGetRepeat.mockResolvedValue([
      { service_ids: null as any, repeat_count: 3 },
    ]);
    mockGetSatisfied.mockResolvedValue([]);
    mockGetLowConf.mockResolvedValue([]);

    const db = {} as D1Database;
    const result = await runSignalAggregation(db);

    expect(result.repeat).toBe(0);
  });
});
