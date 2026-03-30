import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkGitHub,
  checkNpm,
  checkPyPI,
  checkEndpoint,
  checkService,
  computeOverallStatus,
  computeUptime30d,
} from "../src/health.js";
import type { Service } from "../src/types.js";

// ─── Mock fetch globally ───

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    return handler(url, init);
  }) as any;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ─── checkGitHub ───

describe("checkGitHub", () => {
  it("returns alive for active repo", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          archived: false,
          stargazers_count: 100,
          pushed_at: "2026-03-28T10:00:00Z",
        }),
        { status: 200 }
      )
    );

    const result = await checkGitHub("svc-1", "https://github.com/owner/repo");
    expect(result.status).toBe("alive");
    expect(result.check_type).toBe("github");
    expect(result.details.stars).toBe(100);
    expect(result.details.archived).toBe(false);
  });

  it("returns stale for archived repo", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          archived: true,
          stargazers_count: 50,
          pushed_at: "2024-01-01T00:00:00Z",
        }),
        { status: 200 }
      )
    );

    const result = await checkGitHub("svc-2", "https://github.com/owner/repo");
    expect(result.status).toBe("stale");
    expect(result.details.archived).toBe(true);
  });

  it("returns dead for 404", async () => {
    mockFetch(() => new Response("Not Found", { status: 404 }));

    const result = await checkGitHub("svc-3", "https://github.com/owner/repo");
    expect(result.status).toBe("dead");
  });

  it("returns timeout on abort", async () => {
    mockFetch(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });

    const result = await checkGitHub("svc-4", "https://github.com/owner/repo");
    expect(result.status).toBe("timeout");
  });

  it("returns error for unparseable URL", async () => {
    const result = await checkGitHub("svc-5", "https://example.com/not-github");
    expect(result.status).toBe("error");
  });
});

// ─── checkNpm ───

describe("checkNpm", () => {
  it("returns alive for recently updated package", async () => {
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "2.0.0" },
          time: { modified: recentDate },
        }),
        { status: 200 }
      )
    );

    const result = await checkNpm("svc-1", "some-package");
    expect(result.status).toBe("alive");
    expect(result.check_type).toBe("npm");
    expect(result.details.latest_version).toBe("2.0.0");
  });

  it("returns stale for package not updated in >180 days", async () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "1.0.0" },
          time: { modified: oldDate },
        }),
        { status: 200 }
      )
    );

    const result = await checkNpm("svc-2", "old-package");
    expect(result.status).toBe("stale");
  });

  it("returns dead for 404", async () => {
    mockFetch(() => new Response("Not Found", { status: 404 }));

    const result = await checkNpm("svc-3", "nonexistent-package");
    expect(result.status).toBe("dead");
  });
});

// ─── checkPyPI ───

describe("checkPyPI", () => {
  it("returns alive for active package", async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockFetch(() =>
      new Response(
        JSON.stringify({
          info: { version: "3.0.0" },
          releases: {
            "3.0.0": [{ upload_time_iso_8601: recentDate }],
          },
        }),
        { status: 200 }
      )
    );

    const result = await checkPyPI("svc-1", "my-package");
    expect(result.status).toBe("alive");
    expect(result.check_type).toBe("pypi");
    expect(result.details.latest_version).toBe("3.0.0");
  });

  it("returns dead for 404", async () => {
    mockFetch(() => new Response("Not Found", { status: 404 }));

    const result = await checkPyPI("svc-2", "nonexistent");
    expect(result.status).toBe("dead");
  });
});

// ─── checkEndpoint ───

describe("checkEndpoint", () => {
  it("returns alive for 200", async () => {
    mockFetch(() => new Response("OK", { status: 200 }));

    const result = await checkEndpoint("svc-1", "https://api.example.com/health");
    expect(result.status).toBe("alive");
    expect(result.check_type).toBe("endpoint");
  });

  it("returns error for 500", async () => {
    mockFetch(() => new Response("Error", { status: 500 }));

    const result = await checkEndpoint("svc-2", "https://api.example.com/health");
    expect(result.status).toBe("error");
  });

  it("returns timeout on abort", async () => {
    mockFetch(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });

    const result = await checkEndpoint("svc-3", "https://api.example.com/health");
    expect(result.status).toBe("timeout");
  });

  it("returns dead for 404", async () => {
    mockFetch(() => new Response("Not Found", { status: 404 }));

    const result = await checkEndpoint("svc-4", "https://api.example.com/gone");
    expect(result.status).toBe("dead");
  });
});

// ─── computeOverallStatus ───

describe("computeOverallStatus", () => {
  it("returns healthy with 1.0 when all alive and recently updated", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeOverallStatus(
      [
        { service_id: "s1", check_type: "github", status: "alive", response_time_ms: 100, details: {} },
        { service_id: "s1", check_type: "npm", status: "alive", response_time_ms: 80, details: {} },
      ],
      recent
    );
    expect(result.overall_status).toBe("healthy");
    expect(result.reliability).toBe(1.0);
  });

  it("returns healthy with 0.8 when all alive and updated 60 days ago", () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeOverallStatus(
      [{ service_id: "s1", check_type: "github", status: "alive", response_time_ms: 100, details: {} }],
      sixtyDaysAgo
    );
    expect(result.overall_status).toBe("healthy");
    expect(result.reliability).toBe(0.8);
  });

  it("returns degraded with 0.5 when has stale", () => {
    const result = computeOverallStatus([
      { service_id: "s1", check_type: "github", status: "alive", response_time_ms: 100, details: {} },
      { service_id: "s1", check_type: "npm", status: "stale", response_time_ms: 200, details: {} },
    ]);
    expect(result.overall_status).toBe("degraded");
    expect(result.reliability).toBe(0.5);
  });

  it("returns dead with 0.1 when github is dead", () => {
    const result = computeOverallStatus([
      { service_id: "s1", check_type: "github", status: "dead", response_time_ms: 50, details: {} },
      { service_id: "s1", check_type: "npm", status: "alive", response_time_ms: 80, details: {} },
    ]);
    expect(result.overall_status).toBe("dead");
    expect(result.reliability).toBe(0.1);
  });

  it("returns unknown with -1 when no results", () => {
    const result = computeOverallStatus([]);
    expect(result.overall_status).toBe("unknown");
    expect(result.reliability).toBe(-1);
  });

  it("returns degraded with 0.3 when all error/timeout", () => {
    const result = computeOverallStatus([
      { service_id: "s1", check_type: "github", status: "error", response_time_ms: 100, details: {} },
      { service_id: "s1", check_type: "endpoint", status: "timeout", response_time_ms: 5000, details: {} },
    ]);
    expect(result.overall_status).toBe("degraded");
    expect(result.reliability).toBe(0.3);
  });
});

// ─── computeUptime30d ───

describe("computeUptime30d", () => {
  it("returns 1.0 when all alive", () => {
    const checks = [{ status: "alive" }, { status: "alive" }, { status: "alive" }];
    expect(computeUptime30d(checks)).toBe(1.0);
  });

  it("returns 0 when none alive", () => {
    const checks = [{ status: "dead" }, { status: "error" }];
    expect(computeUptime30d(checks)).toBe(0);
  });

  it("returns correct ratio", () => {
    const checks = [
      { status: "alive" },
      { status: "alive" },
      { status: "dead" },
      { status: "alive" },
    ];
    expect(computeUptime30d(checks)).toBe(0.75);
  });

  it("returns 0 for empty array", () => {
    expect(computeUptime30d([])).toBe(0);
  });
});

// ─── checkService orchestration ───

describe("checkService", () => {
  function makeService(overrides: Partial<Service> = {}): Service {
    return {
      id: "test-001",
      name: "Test Service",
      description: "A test",
      capabilities: [],
      platform: "github",
      protocols: {},
      pricing: { model: "free", price_usd: 0 },
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
      verified: false,
      source_url: null,
      ...overrides,
    };
  }

  it("runs github check when source_url is github", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({ archived: false, stargazers_count: 10, pushed_at: "2026-03-28T10:00:00Z" }),
        { status: 200 }
      )
    );

    const service = makeService({ source_url: "https://github.com/owner/repo" });
    const results = await checkService(service);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.check_type === "github")).toBe(true);
  });

  it("runs npm check when install command uses npx", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "1.0.0" },
          time: { modified: new Date().toISOString() },
        }),
        { status: 200 }
      )
    );

    const service = makeService({
      install: { command: "npx @scope/my-tool", runtime: "node" },
    });
    const results = await checkService(service);
    expect(results.some((r) => r.check_type === "npm")).toBe(true);
  });

  it("runs endpoint check for HTTP protocols", async () => {
    mockFetch(() => new Response("OK", { status: 200 }));

    const service = makeService({
      protocols: { rest: "https://api.example.com/v1" },
    });
    const results = await checkService(service);
    expect(results.some((r) => r.check_type === "endpoint")).toBe(true);
  });

  it("returns empty array when no checks applicable", async () => {
    const service = makeService();
    const results = await checkService(service);
    expect(results).toHaveLength(0);
  });
});
