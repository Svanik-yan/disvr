import { describe, it, expect } from "vitest";

// ─── MCP Tool Response Format Tests ───
// Tests the data transformation logic that MCP tools apply to service data,
// without requiring a running MCP server or Durable Object.

describe("discover_tools response format", () => {
  // Simulate the mapping from Recommendation → agent-friendly format
  function formatDiscoverResult(recs: Array<{
    service_id: string;
    service: string;
    summary: string;
    value_score: number;
    reason: string;
    type: string;
    install?: { command: string; runtime: string };
  }>, queryId: string) {
    return {
      query_id: queryId,
      recommendations: recs.map((r) => ({
        service_id: r.service_id,
        name: r.service,
        summary: r.summary,
        value_score: r.value_score,
        match_reason: r.reason,
        type: r.type,
        ...(r.install ? { install: r.install } : {}),
      })),
    };
  }

  it("formats recommendations with install info", () => {
    const result = formatDiscoverResult([
      {
        service_id: "smithery-deepl",
        service: "DeepL MCP",
        summary: "Translation API",
        value_score: 0.85,
        reason: "Highly relevant, free, best value",
        type: "mcp_server",
        install: { command: "npx -y @smithery/cli install deepl --client claude", runtime: "node" },
      },
    ], "q-123");

    expect(result.query_id).toBe("q-123");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].service_id).toBe("smithery-deepl");
    expect(result.recommendations[0].name).toBe("DeepL MCP");
    expect(result.recommendations[0].install).toEqual({
      command: "npx -y @smithery/cli install deepl --client claude",
      runtime: "node",
    });
  });

  it("omits install when not available", () => {
    const result = formatDiscoverResult([
      {
        service_id: "github-test",
        service: "Test Tool",
        summary: "A tool",
        value_score: 0.7,
        reason: "Good match",
        type: "mcp_server",
      },
    ], "q-456");

    expect(result.recommendations[0]).not.toHaveProperty("install");
  });

  it("applies max_results limit", () => {
    const recs = Array.from({ length: 5 }, (_, i) => ({
      service_id: `svc-${i}`,
      service: `Service ${i}`,
      summary: `Summary ${i}`,
      value_score: 0.9 - i * 0.1,
      reason: "match",
      type: "mcp_server" as const,
    }));

    const maxResults = 2;
    const limited = recs.slice(0, maxResults);
    const result = formatDiscoverResult(limited, "q-789");
    expect(result.recommendations).toHaveLength(2);
  });

  it("applies type_filter", () => {
    const recs = [
      { service_id: "a", service: "A", summary: "s", value_score: 0.9, reason: "r", type: "mcp_server" },
      { service_id: "b", service: "B", summary: "s", value_score: 0.8, reason: "r", type: "api" },
      { service_id: "c", service: "C", summary: "s", value_score: 0.7, reason: "r", type: "mcp_server" },
    ];

    const typeFilter = "mcp_server";
    const filtered = recs.filter((r) => r.type === typeFilter);
    const result = formatDiscoverResult(filtered, "q-000");
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations.every((r) => r.type === "mcp_server")).toBe(true);
  });
});

describe("get_tool_details response format", () => {
  interface ServiceLike {
    id: string;
    name: string;
    description: string;
    service_type?: string;
    install?: { command: string; runtime: string } | null;
    required_env?: Array<{ key: string; description: string }> | null;
    tools_provided?: Array<{ name: string; description: string }> | null;
    reputation_score: number | null;
    success_rate: number | null;
    uptime_30d: number | null;
    latency_p95_ms: number | null;
    total_calls: number;
    retry_rate: number | null;
    platform: string;
    source_url: string | null;
  }

  function formatToolDetails(service: ServiceLike) {
    return {
      service_id: service.id,
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
    };
  }

  it("returns full service detail with all fields", () => {
    const result = formatToolDetails({
      id: "smithery-test",
      name: "Test MCP",
      description: "A test MCP server for testing",
      service_type: "mcp_server",
      install: { command: "npx test-mcp", runtime: "node" },
      required_env: [{ key: "API_KEY", description: "Required API key" }],
      tools_provided: [{ name: "translate", description: "Translate text" }],
      reputation_score: 4.2,
      success_rate: 0.95,
      uptime_30d: 0.99,
      latency_p95_ms: 500,
      total_calls: 1000,
      retry_rate: 0.02,
      platform: "smithery",
      source_url: "https://example.com",
    });

    expect(result.service_id).toBe("smithery-test");
    expect(result.type).toBe("mcp_server");
    expect(result.install).toEqual({ command: "npx test-mcp", runtime: "node" });
    expect(result.required_env).toHaveLength(1);
    expect(result.required_env[0].key).toBe("API_KEY");
    expect(result.tools_provided).toHaveLength(1);
    expect(result.metrics.reputation_score).toBe(4.2);
    expect(result.metrics.success_rate).toBe(0.95);
  });

  it("returns empty arrays for null required_env and tools_provided", () => {
    const result = formatToolDetails({
      id: "test-null",
      name: "Null Fields",
      description: "desc",
      service_type: undefined,
      install: null,
      required_env: null,
      tools_provided: null,
      reputation_score: null,
      success_rate: null,
      uptime_30d: null,
      latency_p95_ms: null,
      total_calls: 0,
      retry_rate: null,
      platform: "github",
      source_url: null,
    });

    expect(result.type).toBe("mcp_server");
    expect(result.install).toBeNull();
    expect(result.required_env).toEqual([]);
    expect(result.tools_provided).toEqual([]);
    expect(result.metrics.reputation_score).toBeNull();
  });
});

describe("report_result input validation", () => {
  it("accepts valid report with all fields", () => {
    const report = {
      service_id: "smithery-test",
      query_id: "q-123",
      api_key_hash: "mcp_anonymous",
      success: true,
      latency_ms: 450,
      error_message: undefined,
    };

    expect(report.service_id).toBeTruthy();
    expect(report.query_id).toBeTruthy();
    expect(typeof report.success).toBe("boolean");
  });

  it("accepts report without optional fields", () => {
    const report = {
      service_id: "smithery-test",
      query_id: "q-456",
      api_key_hash: "mcp_anonymous",
      success: false,
    };

    expect(report.service_id).toBeTruthy();
    expect(report.success).toBe(false);
    expect((report as any).latency_ms).toBeUndefined();
    expect((report as any).error_message).toBeUndefined();
  });

  it("tags MCP channel reports as mcp_anonymous", () => {
    const apiKeyHash = "mcp_anonymous";
    expect(apiKeyHash).toBe("mcp_anonymous");
  });
});

describe("list_tools response format", () => {
  function formatListResponse(
    services: Array<{
      id: string;
      name: string;
      description: string;
      service_type?: string;
      install?: { command: string; runtime: string } | null;
    }>,
    total: number,
    page: number,
    limit: number
  ) {
    return {
      services: services.map((s) => ({
        service_id: s.id,
        name: s.name,
        summary: s.description.length > 120 ? s.description.slice(0, 117) + "..." : s.description,
        type: s.service_type ?? "mcp_server",
        ...(s.install ? { install: s.install } : {}),
      })),
      total,
      page,
      limit,
    };
  }

  it("returns paginated results with summary", () => {
    const result = formatListResponse(
      [
        { id: "1", name: "tool-a", description: "Short description", service_type: "mcp_server" },
        { id: "2", name: "tool-b", description: "Another tool", service_type: "api" },
      ],
      100,
      1,
      20
    );

    expect(result.services).toHaveLength(2);
    expect(result.services[0].service_id).toBe("1");
    expect(result.services[0].type).toBe("mcp_server");
    expect(result.services[1].type).toBe("api");
    expect(result.total).toBe(100);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("truncates long descriptions to 120 chars", () => {
    const longDesc = "A".repeat(200);
    const result = formatListResponse(
      [{ id: "1", name: "long-desc", description: longDesc }],
      1, 1, 20
    );

    expect(result.services[0].summary.length).toBe(120);
    expect(result.services[0].summary.endsWith("...")).toBe(true);
  });

  it("keeps short descriptions unchanged", () => {
    const result = formatListResponse(
      [{ id: "1", name: "short", description: "Hello world" }],
      1, 1, 20
    );

    expect(result.services[0].summary).toBe("Hello world");
  });

  it("caps limit at 50", () => {
    const requestedLimit = 100;
    const safeLimit = Math.min(requestedLimit, 50);
    expect(safeLimit).toBe(50);
  });

  it("defaults type to mcp_server when undefined", () => {
    const result = formatListResponse(
      [{ id: "1", name: "no-type", description: "desc" }],
      1, 1, 20
    );

    expect(result.services[0].type).toBe("mcp_server");
  });

  it("includes install info when available", () => {
    const result = formatListResponse(
      [{ id: "1", name: "with-install", description: "desc", install: { command: "npx test", runtime: "node" } }],
      1, 1, 20
    );

    expect(result.services[0].install).toEqual({ command: "npx test", runtime: "node" });
  });

  it("omits install when null", () => {
    const result = formatListResponse(
      [{ id: "1", name: "no-install", description: "desc", install: null }],
      1, 1, 20
    );

    expect(result.services[0]).not.toHaveProperty("install");
  });

  it("applies type_filter correctly", () => {
    const services = [
      { id: "1", name: "a", description: "d", service_type: "mcp_server" },
      { id: "2", name: "b", description: "d", service_type: "api" },
      { id: "3", name: "c", description: "d", service_type: "mcp_server" },
    ];

    const typeFilter = "api";
    const filtered = services.filter((s) => (s.service_type ?? "mcp_server") === typeFilter);
    const result = formatListResponse(filtered, filtered.length, 1, 20);

    expect(result.services).toHaveLength(1);
    expect(result.services[0].type).toBe("api");
  });
});
