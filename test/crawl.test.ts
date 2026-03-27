import { describe, it, expect, vi } from "vitest";

// ─── smitheryToService (tested via crawlSmithery integration) ───
// Since smitheryToService is not exported, we test the internal logic
// through the exported helpers: extractCapabilities, calculateReputation, calculateDocCompleteness
// These are also not exported, so we test them indirectly via crawlSmithery behavior.

// Instead, we test the core transformation logic by importing the module
// and mocking fetch + DB to verify the pipeline.

describe("crawlSmithery", () => {
  it("processes Smithery API response and upserts services", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDB = { prepare: mockPrepare } as unknown as D1Database;

    const mockVectorize = {
      upsert: vi.fn().mockResolvedValue(undefined),
    };

    // Mock fetch for Smithery API
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        servers: [
          {
            qualifiedName: "test/server-one",
            displayName: "Server One",
            description: "A test MCP server for search and web browsing",
            homepage: "https://example.com",
            useCount: 5000,
            isDeployed: true,
            tools: [{ name: "search_web", description: "Search the web" }],
          },
          {
            qualifiedName: "test/server-two",
            displayName: "",
            description: "",
            useCount: 0,
            isDeployed: false,
          },
        ],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 1, totalCount: 2 },
      }),
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    // Mock OpenAI for embedAndIndex
    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          create: vi.fn().mockResolvedValue({
            data: [
              { embedding: new Array(1536).fill(0.1) },
              { embedding: new Array(1536).fill(0.2) },
            ],
          }),
        };
      },
    }));

    const { crawlSmithery } = await import("../src/crawl.js");

    const env = {
      DB: mockDB,
      VECTORIZE: mockVectorize,
      OPENAI_API_KEY: "test-key",
      ENVIRONMENT: "test",
    } as any;

    const count = await crawlSmithery(env);

    expect(count).toBe(2);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("registry.smithery.ai/servers"),
      expect.any(Object)
    );
    // Verify upsert was called for each service
    expect(mockPrepare).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
    vi.doUnmock("openai");
  });

  it("handles API errors gracefully", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    } as unknown as D1Database;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { crawlSmithery } = await import("../src/crawl.js");

    const env = {
      DB: mockDB,
      VECTORIZE: { upsert: vi.fn() },
      OPENAI_API_KEY: "test-key",
      ENVIRONMENT: "test",
    } as any;

    // Should not throw, just return 0
    const count = await crawlSmithery(env);
    expect(count).toBe(0);

    globalThis.fetch = originalFetch;
  });

  it("handles empty server list", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    } as unknown as D1Database;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        servers: [],
        pagination: { currentPage: 1, pageSize: 100, totalPages: 0, totalCount: 0 },
      }),
    });

    const { crawlSmithery } = await import("../src/crawl.js");

    const env = {
      DB: mockDB,
      VECTORIZE: { upsert: vi.fn() },
      OPENAI_API_KEY: "test-key",
      ENVIRONMENT: "test",
    } as any;

    const count = await crawlSmithery(env);
    expect(count).toBe(0);

    globalThis.fetch = originalFetch;
  });
});

describe("embedAndIndex", () => {
  it("batches services and calls OpenAI + Vectorize", async () => {
    const mockUpsert = vi.fn().mockResolvedValue(undefined);

    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          create: vi.fn().mockResolvedValue({
            data: [{ embedding: new Array(1536).fill(0.5) }],
          }),
        };
      },
    }));

    const { embedAndIndex } = await import("../src/crawl.js");

    const env = {
      VECTORIZE: { upsert: mockUpsert },
      OPENAI_API_KEY: "test-key",
    } as any;

    const services = [
      {
        id: "test-1",
        name: "Test Service",
        description: "A test service",
        capabilities: ["search"],
        platform: "smithery",
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
      },
    ];

    await embedAndIndex(env, services);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "test-1" }),
      ])
    );

    vi.doUnmock("openai");
  });

  it("handles embedding API failure gracefully", async () => {
    vi.doMock("openai", () => ({
      default: class MockOpenAI {
        embeddings = {
          create: vi.fn().mockRejectedValue(new Error("API Error")),
        };
      },
    }));

    const { embedAndIndex } = await import("../src/crawl.js");

    const env = {
      VECTORIZE: { upsert: vi.fn() },
      OPENAI_API_KEY: "test-key",
    } as any;

    const services = [
      {
        id: "test-1",
        name: "Test",
        description: "desc",
        capabilities: [],
        platform: "smithery",
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
      },
    ];

    // Should not throw
    await expect(embedAndIndex(env, services)).resolves.toBeUndefined();

    vi.doUnmock("openai");
  });
});
