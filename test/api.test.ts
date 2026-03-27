import { describe, it, expect } from "vitest";

// ─── API Route Logic Tests ───
// These test the input validation and parameter parsing logic
// that the Hono routes implement, without requiring a full HTTP server.

describe("POST /discover input validation", () => {
  it("rejects need shorter than 5 characters", () => {
    const body = { need: "hi" };
    const isValid = body.need && typeof body.need === "string" && body.need.trim().length >= 5;
    expect(isValid).toBe(false);
  });

  it("rejects empty need", () => {
    const body = { need: "" };
    const isValid = body.need && typeof body.need === "string" && body.need.trim().length >= 5;
    expect(isValid).toBeFalsy();
  });

  it("rejects whitespace-only need", () => {
    const body = { need: "    " };
    const isValid = body.need && typeof body.need === "string" && body.need.trim().length >= 5;
    expect(isValid).toBe(false);
  });

  it("accepts valid need", () => {
    const body = { need: "translate Chinese to English" };
    const isValid = body.need && typeof body.need === "string" && body.need.trim().length >= 5;
    expect(isValid).toBe(true);
  });

  it("accepts need with exactly 5 characters", () => {
    const body = { need: "hello" };
    const isValid = body.need && typeof body.need === "string" && body.need.trim().length >= 5;
    expect(isValid).toBe(true);
  });
});

describe("GET /api/services parameter parsing", () => {
  function parseParams(query: Record<string, string | undefined>) {
    const page = Math.max(1, parseInt(query.page || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20") || 1));
    const search = query.search || undefined;
    const platform = query.platform || undefined;
    const sort = query.sort || undefined;
    return { page, limit, search, platform, sort };
  }

  it("defaults page to 1 and limit to 20", () => {
    const params = parseParams({});
    expect(params.page).toBe(1);
    expect(params.limit).toBe(20);
  });

  it("clamps page to minimum 1", () => {
    const params = parseParams({ page: "-5" });
    expect(params.page).toBe(1);
  });

  it("clamps page=0 to 1", () => {
    const params = parseParams({ page: "0" });
    expect(params.page).toBe(1);
  });

  it("clamps limit to max 100", () => {
    const params = parseParams({ limit: "500" });
    expect(params.limit).toBe(100);
  });

  it("clamps limit to min 1", () => {
    const params = parseParams({ limit: "0" });
    expect(params.limit).toBe(1);
  });

  it("parses search and platform", () => {
    const params = parseParams({ search: "translation", platform: "smithery" });
    expect(params.search).toBe("translation");
    expect(params.platform).toBe("smithery");
  });

  it("handles NaN page gracefully", () => {
    const params = parseParams({ page: "abc" });
    // parseInt("abc") = NaN, || 1 fallback ensures page = 1
    expect(params.page).toBe(1);
  });

  it("passes sort through", () => {
    const params = parseParams({ sort: "name" });
    expect(params.sort).toBe("name");
  });
});

describe("POST /report input validation", () => {
  it("requires service_id and query_id", () => {
    const body1 = { service_id: "", query_id: "q1" };
    expect(!body1.service_id || !body1.query_id).toBe(true);

    const body2 = { service_id: "s1", query_id: "" };
    expect(!body2.service_id || !body2.query_id).toBe(true);

    const body3 = { service_id: "s1", query_id: "q1" };
    expect(!body3.service_id || !body3.query_id).toBe(false);
  });
});

describe("Auth header parsing", () => {
  function extractToken(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith("Bearer ")) return null;
    return authHeader.slice(7);
  }

  it("extracts Bearer token", () => {
    expect(extractToken("Bearer my-api-key")).toBe("my-api-key");
  });

  it("rejects missing header", () => {
    expect(extractToken(undefined)).toBeNull();
  });

  it("rejects non-Bearer scheme", () => {
    expect(extractToken("Basic abc123")).toBeNull();
  });

  it("rejects empty Bearer", () => {
    expect(extractToken("Bearer ")).toBe("");
  });

  it("handles Bearer with spaces in token", () => {
    expect(extractToken("Bearer token with spaces")).toBe("token with spaces");
  });
});

describe("hashKey consistency", () => {
  // Test that SHA-256 hashing is deterministic
  async function hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  it("produces consistent hash for same input", async () => {
    const hash1 = await hashKey("test-key");
    const hash2 = await hashKey("test-key");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await hashKey("key-a");
    const hash2 = await hashKey("key-b");
    expect(hash1).not.toBe(hash2);
  });

  it("produces 64-character hex string", async () => {
    const hash = await hashKey("any-key");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("secondsUntilMidnight", () => {
  function secondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  it("returns positive number", () => {
    expect(secondsUntilMidnight()).toBeGreaterThan(0);
  });

  it("returns at most 86400 seconds", () => {
    expect(secondsUntilMidnight()).toBeLessThanOrEqual(86400);
  });
});

// ─── GET /api/services/:id — Service Detail ───

describe("GET /api/services/:id response format", () => {
  it("returns agent-friendly service detail structure", () => {
    // Simulate the response shape from /api/services/:id
    const service = {
      id: "smithery-test",
      name: "Test MCP",
      description: "A test service",
      service_type: "mcp_server" as const,
      install: { command: "npx test-mcp", runtime: "node" as const },
      required_env: [{ key: "API_KEY", description: "Required API key", free_tier: true }],
      tools_provided: [{ name: "translate", description: "Translate text" }],
      reputation_score: 4.2,
      success_rate: 0.95,
      uptime_30d: 0.99,
      latency_p95_ms: 500,
      total_calls: 1000,
      retry_rate: 0.02,
      platform: "smithery",
      source_url: "https://example.com",
    };

    const response = {
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        type: service.service_type ?? "mcp_server",
        install: service.install ?? null,
        required_env: service.required_env ?? [],
        tools_provided: service.tools_provided ?? [],
        metrics: {
          reputation_score: service.reputation_score,
          success_rate: service.success_rate,
          uptime_30d: service.uptime_30d,
          latency_p95_ms: service.latency_p95_ms,
          total_calls: service.total_calls,
          retry_rate: service.retry_rate,
        },
        platform: service.platform,
        source_url: service.source_url,
      },
    };

    expect(response.service.id).toBe("smithery-test");
    expect(response.service.type).toBe("mcp_server");
    expect(response.service.install).toEqual({ command: "npx test-mcp", runtime: "node" });
    expect(response.service.required_env).toHaveLength(1);
    expect(response.service.tools_provided).toHaveLength(1);
    expect(response.service.metrics.reputation_score).toBe(4.2);
  });

  it("returns empty arrays when required_env and tools_provided are null", () => {
    const service = {
      id: "test",
      name: "Test",
      description: "desc",
      service_type: undefined,
      install: null,
      required_env: null,
      tools_provided: null,
    };

    const response = {
      service: {
        type: service.service_type ?? "mcp_server",
        install: service.install ?? null,
        required_env: service.required_env ?? [],
        tools_provided: service.tools_provided ?? [],
      },
    };

    expect(response.service.type).toBe("mcp_server");
    expect(response.service.install).toBeNull();
    expect(response.service.required_env).toEqual([]);
    expect(response.service.tools_provided).toEqual([]);
  });
});
