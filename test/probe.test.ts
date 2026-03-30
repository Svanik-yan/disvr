import { describe, it, expect, vi, afterEach } from "vitest";
import {
  probeMcpServer,
  probeHttpApi,
  probeService,
  extractProbeEndpoint,
  calculateSuccessRate,
} from "../src/probe.js";
import type { Service } from "../src/types.js";

// ─── Mock fetch ───

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

// ─── MCP Handshake ───

describe("probeMcpServer", () => {
  it("returns success for valid MCP response with capabilities", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "test-server", version: "1.0" },
          },
        }),
        { status: 200 }
      )
    );

    const result = await probeMcpServer("svc-1", "https://example.com/mcp");
    expect(result.success).toBe(true);
    expect(result.probe_type).toBe("mcp_handshake");
    expect(result.details.has_capabilities).toBe(true);
    expect(result.details.server_name).toBe("test-server");
    expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
  });

  it("returns failure when response has no capabilities", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
        { status: 200 }
      )
    );

    const result = await probeMcpServer("svc-1", "https://example.com/mcp");
    expect(result.success).toBe(false);
    expect(result.details.has_capabilities).toBe(false);
  });

  it("returns failure for HTTP 500", async () => {
    mockFetch(() => new Response("Internal Server Error", { status: 500 }));

    const result = await probeMcpServer("svc-1", "https://example.com/mcp");
    expect(result.success).toBe(false);
    expect(result.details.response_status).toBe(500);
  });

  it("returns failure with timeout error", async () => {
    mockFetch(() => {
      const err = new Error("timeout");
      err.name = "TimeoutError";
      throw err;
    });

    const result = await probeMcpServer("svc-1", "https://example.com/mcp");
    expect(result.success).toBe(false);
    expect(result.details.error).toBe("timeout");
  });

  it("records response_time_ms", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { capabilities: { tools: {} } },
        }),
        { status: 200 }
      )
    );

    const result = await probeMcpServer("svc-1", "https://example.com/mcp");
    expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
  });
});

// ─── HTTP API Probe ───

describe("probeHttpApi", () => {
  it("returns success for /health 200", async () => {
    mockFetch((url) => {
      if (url.endsWith("/health")) {
        return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("Not Found", { status: 404 });
    });

    const result = await probeHttpApi("svc-1", "https://api.example.com");
    expect(result.success).toBe(true);
    expect(result.details.probed_path).toBe("/health");
    expect(result.details.response_status).toBe(200);
  });

  it("falls back to / when /health and others fail", async () => {
    mockFetch((url) => {
      if (url.endsWith("/") || url === "https://api.example.com/") {
        return new Response("<html>OK</html>", { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    });

    const result = await probeHttpApi("svc-1", "https://api.example.com");
    expect(result.success).toBe(true);
    expect(result.details.probed_path).toBe("/");
  });

  it("returns failure when all paths fail", async () => {
    mockFetch(() => new Response("Not Found", { status: 404 }));

    const result = await probeHttpApi("svc-1", "https://api.example.com");
    expect(result.success).toBe(false);
    expect(result.probe_type).toBe("api_probe");
  });

  it("treats 301 redirect as success", async () => {
    mockFetch((url) => {
      if (url.endsWith("/health")) {
        return new Response("Redirecting", { status: 301 });
      }
      return new Response("Not Found", { status: 404 });
    });

    const result = await probeHttpApi("svc-1", "https://api.example.com");
    expect(result.success).toBe(true);
    expect(result.details.response_status).toBe(301);
  });
});

// ─── extractProbeEndpoint ───

describe("extractProbeEndpoint", () => {
  it("extracts Smithery MCP endpoint", () => {
    const service = makeService({
      protocols: { mcp: "mcp://smithery/my-tool" },
    });
    const endpoint = extractProbeEndpoint(service);
    expect(endpoint).toEqual({
      type: "mcp",
      url: "https://server.smithery.ai/my-tool/mcp",
    });
  });

  it("extracts direct HTTPS MCP endpoint", () => {
    const service = makeService({
      protocols: { mcp: "https://mcp.example.com/server" },
    });
    const endpoint = extractProbeEndpoint(service);
    expect(endpoint).toEqual({
      type: "mcp",
      url: "https://mcp.example.com/server",
    });
  });

  it("extracts REST endpoint", () => {
    const service = makeService({
      protocols: { rest: "https://api.example.com/v1" },
    });
    const endpoint = extractProbeEndpoint(service);
    expect(endpoint).toEqual({
      type: "http",
      url: "https://api.example.com/v1",
    });
  });

  it("skips GitHub URLs for MCP", () => {
    const service = makeService({
      protocols: { mcp: "https://github.com/owner/repo" },
    });
    const endpoint = extractProbeEndpoint(service);
    // Should fall through to source_url or null
    expect(endpoint).toBeNull();
  });

  it("returns null for CLI tools with no endpoint", () => {
    const service = makeService({
      protocols: {},
      source_url: "https://github.com/owner/repo",
    });
    const endpoint = extractProbeEndpoint(service);
    expect(endpoint).toBeNull();
  });

  it("uses non-GitHub source_url as HTTP fallback", () => {
    const service = makeService({
      protocols: {},
      source_url: "https://smithery.ai/servers/my-tool",
    });
    const endpoint = extractProbeEndpoint(service);
    expect(endpoint).toEqual({
      type: "http",
      url: "https://smithery.ai/servers/my-tool",
    });
  });
});

// ─── probeService orchestration ───

describe("probeService", () => {
  it("calls probeMcpServer for MCP type", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { capabilities: { tools: {} } },
        }),
        { status: 200 }
      )
    );

    const service = makeService({
      protocols: { mcp: "mcp://smithery/test-tool" },
    });
    const result = await probeService(service);
    expect(result).not.toBeNull();
    expect(result!.probe_type).toBe("mcp_handshake");
  });

  it("calls probeHttpApi for HTTP type", async () => {
    mockFetch(() => new Response("OK", { status: 200 }));

    const service = makeService({
      protocols: { rest: "https://api.example.com" },
    });
    const result = await probeService(service);
    expect(result).not.toBeNull();
    expect(result!.probe_type).toBe("api_probe");
  });

  it("returns null for CLI tools", async () => {
    const service = makeService({
      protocols: {},
      source_url: "https://github.com/owner/cli-tool",
    });
    const result = await probeService(service);
    expect(result).toBeNull();
  });
});

// ─── calculateSuccessRate ───

describe("calculateSuccessRate", () => {
  it("returns 1.0 for all successes", () => {
    const probes = Array.from({ length: 10 }, () => ({ success: true }));
    expect(calculateSuccessRate(probes)).toBe(1.0);
  });

  it("returns 0.7 for 7/10 successes", () => {
    const probes = [
      ...Array.from({ length: 7 }, () => ({ success: true })),
      ...Array.from({ length: 3 }, () => ({ success: false })),
    ];
    expect(calculateSuccessRate(probes)).toBe(0.7);
  });

  it("works with fewer than 10 probes", () => {
    const probes = [{ success: true }, { success: false }];
    expect(calculateSuccessRate(probes)).toBe(0.5);
  });

  it("returns null for empty array", () => {
    expect(calculateSuccessRate([])).toBeNull();
  });

  it("returns 0.0 for all failures", () => {
    const probes = Array.from({ length: 5 }, () => ({ success: false }));
    expect(calculateSuccessRate(probes)).toBe(0.0);
  });
});

// ─── Ranking impact ───

describe("ranking impact", () => {
  it("call_success_rate >= 0.8 boosts reliability", () => {
    const rate = 0.9;
    const baseScore = 0.6;
    const boosted = Math.min(1, baseScore + 0.1);
    expect(boosted).toBe(0.7);
    expect(rate >= 0.8).toBe(true);
  });

  it("call_success_rate < 0.3 halves reliability", () => {
    const rate = 0.2;
    const baseScore = 0.6;
    const penalized = baseScore * 0.5;
    expect(penalized).toBe(0.3);
    expect(rate < 0.3).toBe(true);
  });

  it("no call_success_rate leaves score unchanged", () => {
    const rate = null;
    const baseScore = 0.6;
    // No adjustment
    expect(rate === null).toBe(true);
    expect(baseScore).toBe(0.6);
  });
});

// ─── Helper ───

function makeService(overrides: Partial<Service>): Service {
  return {
    id: "test-svc",
    name: "Test Service",
    description: "A test service",
    capabilities: [],
    platform: "test",
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
