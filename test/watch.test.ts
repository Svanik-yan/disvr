import { describe, it, expect, vi } from "vitest";
import {
  addWatch,
  removeWatch,
  getWatchList,
  generateAlerts,
  getAlerts,
  getAlertSummary,
  cleanupOldAlerts,
  shouldSuggestWatch,
} from "../src/watch.js";

// ─── Mock DB Helper ───

function createMockDb(overrides: {
  prepareResults?: Map<string, any>;
  firstResults?: Map<string, any>;
  allResults?: Map<string, any>;
} = {}) {
  const runResult = { meta: { changes: 0 } };
  let callIndex = 0;
  const prepareCalls: string[] = [];

  const db = {
    prepare: (sql: string) => {
      prepareCalls.push(sql);
      callIndex++;
      return {
        bind: (...args: any[]) => ({
          run: async () => runResult,
          first: async <T>() => {
            // Match by sql substring for flexible mocking
            for (const [key, val] of overrides.firstResults ?? new Map()) {
              if (sql.includes(key)) return val as T;
            }
            return null as T;
          },
          all: async () => {
            for (const [key, val] of overrides.allResults ?? new Map()) {
              if (sql.includes(key)) return { results: val };
            }
            return { results: [] };
          },
        }),
        run: async () => runResult,
        first: async <T>() => null as T,
        all: async () => ({ results: [] }),
      };
    },
    _prepareCalls: prepareCalls,
  };

  return db as unknown as D1Database & { _prepareCalls: string[] };
}

// ─── addWatch ───

describe("addWatch", () => {
  it("succeeds when under limit", async () => {
    const db = createMockDb({
      firstResults: new Map([["COUNT(*)", { cnt: 5 }]]),
    });
    const result = await addWatch(db, "hash-1", "svc-1");
    expect(result.success).toBe(true);
  });

  it("succeeds silently on duplicate (INSERT OR IGNORE)", async () => {
    const db = createMockDb({
      firstResults: new Map([["COUNT(*)", { cnt: 1 }]]),
    });
    const result = await addWatch(db, "hash-1", "svc-1");
    expect(result.success).toBe(true);
  });

  it("rejects when at 50 watch limit", async () => {
    const db = createMockDb({
      firstResults: new Map([["COUNT(*)", { cnt: 50 }]]),
    });
    const result = await addWatch(db, "hash-1", "svc-51");
    expect(result.success).toBe(false);
    expect(result.error).toContain("max 50");
  });
});

// ─── removeWatch ───

describe("removeWatch", () => {
  it("executes DELETE without error", async () => {
    const db = createMockDb();
    await expect(removeWatch(db, "hash-1", "svc-1")).resolves.toBeUndefined();
  });
});

// ─── getWatchList ───

describe("getWatchList", () => {
  it("returns list with service_name and health_status", async () => {
    const db = createMockDb({
      allResults: new Map([
        ["tool_watches tw", [
          { service_id: "svc-1", service_name: "Exa Search", health_status: "healthy", created_at: "2025-01-01" },
          { service_id: "svc-2", service_name: "Brave API", health_status: "degraded", created_at: "2025-01-02" },
        ]],
      ]),
    });
    const list = await getWatchList(db, "hash-1");
    expect(list).toHaveLength(2);
    expect(list[0].service_name).toBe("Exa Search");
    expect(list[0].health_status).toBe("healthy");
    expect(list[1].service_name).toBe("Brave API");
  });
});

// ─── generateAlerts ───

describe("generateAlerts", () => {
  function alertGenDb(opts: {
    watchedIds: string[];
    healthMap: Record<string, any>;
    nameMap: Record<string, string>;
    existingAlerts?: Record<string, { alert_type: string } | null>;
    recentAlertExists?: Record<string, boolean>;
  }) {
    return {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          run: async () => ({ meta: { changes: 0 } }),
          first: async () => {
            // hasRecentAlert check
            if (sql.includes("watch_alerts") && sql.includes("alert_type IN")) {
              // checkHealthChange: last health alert
              const serviceId = args[0];
              return opts.existingAlerts?.[serviceId] ?? null;
            }
            if (sql.includes("watch_alerts") && sql.includes("LIMIT 1")) {
              // hasRecentAlert dedup check
              const serviceId = args[0];
              const alertType = args[1];
              if (opts.recentAlertExists?.[`${serviceId}:${alertType}`]) {
                return { x: 1 };
              }
              return null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("DISTINCT service_id")) {
              return { results: opts.watchedIds.map((id) => ({ service_id: id })) };
            }
            if (sql.includes("health_summary")) {
              return {
                results: Object.entries(opts.healthMap).map(([id, h]) => ({
                  service_id: id,
                  ...h,
                })),
              };
            }
            if (sql.includes("services WHERE id IN")) {
              return {
                results: Object.entries(opts.nameMap).map(([id, name]) => ({ id, name })),
              };
            }
            return { results: [] };
          },
        }),
        all: async () => {
          if (sql.includes("DISTINCT service_id")) {
            return { results: opts.watchedIds.map((id) => ({ service_id: id })) };
          }
          return { results: [] };
        },
      }),
    } as unknown as D1Database;
  }

  it("returns 0 when no watches exist", async () => {
    const db = alertGenDb({ watchedIds: [], healthMap: {}, nameMap: {} });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(0);
  });

  it("generates warning when first seen as degraded (no history)", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "degraded" } },
      nameMap: { "svc-1": "Exa Search" },
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(1);
  });

  it("generates critical when first seen as dead (no history)", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "dead" } },
      nameMap: { "svc-1": "Exa Search" },
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(1);
  });

  it("generates no alert when first seen as healthy (no history)", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "healthy" } },
      nameMap: { "svc-1": "Exa Search" },
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(0);
  });

  it("generates alert on health change from healthy to degraded", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "degraded" } },
      nameMap: { "svc-1": "Exa Search" },
      existingAlerts: { "svc-1": { alert_type: "health_recovered" } }, // was healthy
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(1);
  });

  it("generates alert on recovery from dead to healthy", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "healthy" } },
      nameMap: { "svc-1": "Exa Search" },
      existingAlerts: { "svc-1": { alert_type: "health_dead" } }, // was dead
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(1);
  });

  it("no alert when health unchanged", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "healthy" } },
      nameMap: { "svc-1": "Exa Search" },
      existingAlerts: { "svc-1": { alert_type: "health_recovered" } }, // was already healthy
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(0);
  });

  it("generates breaking_change alert", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "healthy", recent_breaking_change: 1, current_version: "2.0.0" } },
      nameMap: { "svc-1": "Exa Search" },
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(1);
  });

  it("skips breaking_change if recent alert exists (7 day dedup)", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "healthy", recent_breaking_change: 1 } },
      nameMap: { "svc-1": "Exa Search" },
      recentAlertExists: { "svc-1:breaking_change": true },
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(0);
  });

  it("generates deprecated alert", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "dead", primary_error_type: "deprecated" } },
      nameMap: { "svc-1": "Old Tool" },
    });
    const result = await generateAlerts(db);
    // 1 for deprecated + 1 for first-seen dead
    expect(result.alerts_created).toBeGreaterThanOrEqual(1);
  });

  it("generates install_broken alert", async () => {
    const db = alertGenDb({
      watchedIds: ["svc-1"],
      healthMap: { "svc-1": { overall_status: "healthy", install_difficulty: "broken" } },
      nameMap: { "svc-1": "Broken Tool" },
    });
    const result = await generateAlerts(db);
    expect(result.alerts_created).toBe(1);
  });
});

// ─── getAlerts ───

describe("getAlerts", () => {
  it("returns only alerts for watched tools", async () => {
    const db = createMockDb({
      allResults: new Map([
        ["watch_alerts wa", [
          { id: 1, service_id: "svc-1", service_name: "Exa", alert_type: "health_degraded", severity: "warning", title: "Exa is degraded", details: null, created_at: "2025-01-01" },
        ]],
      ]),
    });
    const alerts = await getAlerts(db, "hash-1");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alert_type).toBe("health_degraded");
    expect(alerts[0].service_name).toBe("Exa");
  });

  it("respects since parameter", async () => {
    const db = createMockDb({
      allResults: new Map([
        ["watch_alerts wa", [
          { id: 2, service_id: "svc-1", service_name: "Exa", alert_type: "health_recovered", severity: "info", title: "Recovered", details: null, created_at: "2025-02-01" },
        ]],
      ]),
    });
    const alerts = await getAlerts(db, "hash-1", { since: "2025-01-15" });
    expect(alerts).toHaveLength(1);
    // Verify SQL includes since filter
    expect((db as any)._prepareCalls?.[0] ?? "").toContain("created_at");
  });

  it("respects severity parameter", async () => {
    const db = createMockDb({
      allResults: new Map([
        ["watch_alerts wa", []],
      ]),
    });
    const alerts = await getAlerts(db, "hash-1", { severity: "critical" });
    expect(alerts).toHaveLength(0);
  });
});

// ─── getAlertSummary ───

describe("getAlertSummary", () => {
  it("returns correct counts", async () => {
    const db = createMockDb({
      firstResults: new Map([
        ["COUNT(*) as cnt FROM tool_watches", { cnt: 5 }],
        ["COUNT(*) as cnt\n       FROM tool_watches tw\n       JOIN health_summary", { cnt: 2 }],
      ]),
      allResults: new Map([
        ["wa.severity", [
          { severity: "critical", cnt: 1 },
          { severity: "warning", cnt: 3 },
          { severity: "info", cnt: 2 },
        ]],
      ]),
    });
    const summary = await getAlertSummary(db, "hash-1");
    expect(summary.total_watches).toBe(5);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(3);
    expect(summary.info).toBe(2);
    expect(summary.unread_alerts).toBe(6);
    expect(summary.tools_at_risk).toBe(2);
  });
});

// ─── cleanupOldAlerts ───

describe("cleanupOldAlerts", () => {
  it("deletes old alerts", async () => {
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          run: async () => ({ meta: { changes: 5 } }),
        }),
      }),
    } as unknown as D1Database;
    const deleted = await cleanupOldAlerts(db, 30);
    expect(deleted).toBe(5);
  });
});

// ─── shouldSuggestWatch ───

describe("shouldSuggestWatch", () => {
  it("returns true for degraded tool", () => {
    expect(shouldSuggestWatch("degraded")).toBe(true);
  });

  it("returns true for dead tool", () => {
    expect(shouldSuggestWatch("dead")).toBe(true);
  });

  it("returns true for recent breaking change", () => {
    expect(shouldSuggestWatch("healthy", true)).toBe(true);
  });

  it("returns true for high error count", () => {
    expect(shouldSuggestWatch("healthy", false, 15)).toBe(true);
  });

  it("returns false for healthy tool with no issues", () => {
    expect(shouldSuggestWatch("healthy", false, 2)).toBe(false);
  });

  it("returns false when no args", () => {
    expect(shouldSuggestWatch()).toBe(false);
  });
});
