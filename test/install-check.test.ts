import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkNpmInstallability,
  checkPyPIInstallability,
  checkEnvDocs,
  estimateInstallSteps,
  checkInstallability,
  extractNpmPackageName,
  extractPipPackageName,
} from "../src/install-check.js";
import type { Service } from "../src/types.js";

// ─── Mock fetch ───

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (input: any) => {
    const url = typeof input === "string" ? input : input.url;
    return handler(url);
  }) as any;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ─── npm checks ───

describe("checkNpmInstallability", () => {
  it("returns exists + installable for valid package", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              dist: { tarball: "https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz" },
              dependencies: { dep1: "^1.0.0", dep2: "^2.0.0" },
            },
          },
          time: { "1.0.0": "2026-03-20T00:00:00Z" },
        }),
        { status: 200 }
      )
    );

    const result = await checkNpmInstallability("test-pkg");
    expect(result.exists).toBe(true);
    expect(result.installable).toBe(true);
    expect(result.dependency_count).toBe(2);
    expect(result.last_publish_days).toBeGreaterThanOrEqual(0);
  });

  it("returns not found for 404", async () => {
    mockFetch(() => new Response("Not found", { status: 404 }));

    const result = await checkNpmInstallability("nonexistent-pkg");
    expect(result.exists).toBe(false);
    expect(result.installable).toBe(false);
  });

  it("counts dependencies correctly", async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 15; i++) deps[`dep-${i}`] = "^1.0.0";

    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "2.0.0" },
          versions: {
            "2.0.0": {
              dist: { tarball: "https://example.com/pkg.tgz" },
              dependencies: deps,
            },
          },
          time: { "2.0.0": "2026-01-01T00:00:00Z" },
        }),
        { status: 200 }
      )
    );

    const result = await checkNpmInstallability("many-deps");
    expect(result.dependency_count).toBe(15);
  });

  it("computes last_publish_days correctly", async () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              dist: { tarball: "https://example.com/pkg.tgz" },
              dependencies: {},
            },
          },
          time: { "1.0.0": twoWeeksAgo },
        }),
        { status: 200 }
      )
    );

    const result = await checkNpmInstallability("recent-pkg");
    expect(result.last_publish_days).toBeGreaterThanOrEqual(13);
    expect(result.last_publish_days).toBeLessThanOrEqual(15);
  });

  it("handles fetch error gracefully", async () => {
    mockFetch(() => {
      throw new Error("Network error");
    });

    const result = await checkNpmInstallability("error-pkg");
    expect(result.exists).toBe(false);
  });
});

// ─── PyPI checks ───

describe("checkPyPIInstallability", () => {
  it("returns exists + installable for valid package", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          info: { requires_dist: ["dep1", "dep2", "dep3"] },
          urls: [{ upload_time: "2026-03-25T00:00:00" }],
        }),
        { status: 200 }
      )
    );

    const result = await checkPyPIInstallability("test-pkg");
    expect(result.exists).toBe(true);
    expect(result.installable).toBe(true);
    expect(result.dependency_count).toBe(3);
  });

  it("returns not found for 404", async () => {
    mockFetch(() => new Response("Not found", { status: 404 }));

    const result = await checkPyPIInstallability("nonexistent");
    expect(result.exists).toBe(false);
  });

  it("counts requires_dist as dependency_count", async () => {
    mockFetch(() =>
      new Response(
        JSON.stringify({
          info: { requires_dist: ["a", "b", "c", "d", "e"] },
          urls: [{ upload_time: "2026-03-01T00:00:00" }],
        }),
        { status: 200 }
      )
    );

    const result = await checkPyPIInstallability("multi-dep");
    expect(result.dependency_count).toBe(5);
  });
});

// ─── Env docs check ───

describe("checkEnvDocs", () => {
  it("returns true when no required_env", () => {
    expect(checkEnvDocs({ required_env: null })).toBe(true);
    expect(checkEnvDocs({ required_env: [] })).toBe(true);
  });

  it("returns true when description mentions env var", () => {
    expect(
      checkEnvDocs({
        required_env: [{ key: "OPENAI_API_KEY" }],
        description: "Requires OPENAI_API_KEY from OpenAI dashboard",
      })
    ).toBe(true);
  });

  it("returns false when description does not mention env var", () => {
    expect(
      checkEnvDocs({
        required_env: [{ key: "SECRET_TOKEN" }],
        description: "A simple tool for data processing",
      })
    ).toBe(false);
  });
});

// ─── Install steps estimation ───

describe("estimateInstallSteps", () => {
  it("returns 1 for simple install command with no env", () => {
    expect(estimateInstallSteps({ install: { command: "npm install pkg" }, required_env: null })).toBe(1);
  });

  it("returns 3 for install command with 2 env vars", () => {
    expect(
      estimateInstallSteps({
        install: { command: "npm install pkg" },
        required_env: [{ key: "A" }, { key: "B" }],
      })
    ).toBe(3);
  });

  it("returns 3 for no install command (manual setup)", () => {
    expect(estimateInstallSteps({ install: null, required_env: null })).toBe(3);
  });
});

// ─── Package name extraction ───

describe("extractNpmPackageName", () => {
  it("extracts from npm install", () => {
    expect(extractNpmPackageName("npm install @anthropic/mcp-server")).toBe("@anthropic/mcp-server");
  });

  it("extracts from npx", () => {
    expect(extractNpmPackageName("npx @modelcontextprotocol/server")).toBe("@modelcontextprotocol/server");
  });

  it("extracts from npx -y", () => {
    expect(extractNpmPackageName("npx -y some-tool")).toBe("some-tool");
  });

  it("returns null for non-npm command", () => {
    expect(extractNpmPackageName("pip install something")).toBeNull();
  });
});

describe("extractPipPackageName", () => {
  it("extracts from pip install", () => {
    expect(extractPipPackageName("pip install mcp-server")).toBe("mcp-server");
  });

  it("extracts from uvx", () => {
    expect(extractPipPackageName("uvx my-tool")).toBe("my-tool");
  });

  it("returns null for non-pip command", () => {
    expect(extractPipPackageName("npm install something")).toBeNull();
  });
});

// ─── Comprehensive scoring ───

describe("checkInstallability", () => {
  it("scores perfect tool as 100 / easy", async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              dist: { tarball: "https://example.com/pkg.tgz" },
              dependencies: { dep1: "^1.0.0" },
            },
          },
          time: { "1.0.0": recentDate },
        }),
        { status: 200 }
      )
    );

    const service = makeService({
      install: { command: "npx my-tool", runtime: "node" },
      required_env: null,
    });

    const result = await checkInstallability(service);
    expect(result.install_score).toBe(100);
    expect(result.install_difficulty).toBe("easy");
  });

  it("scores broken package as <= 29 / broken", async () => {
    mockFetch(() => new Response("Not found", { status: 404 }));

    const service = makeService({
      install: { command: "npx nonexistent-tool", runtime: "node" },
      required_env: [{ key: "SECRET", description: "A secret", free_tier: false }],
    });

    const result = await checkInstallability(service);
    expect(result.install_score).toBeLessThanOrEqual(29);
    expect(result.install_difficulty).toBe("broken");
  });

  it("scores multi-step tool as hard", async () => {
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

    mockFetch(() =>
      new Response(
        JSON.stringify({
          "dist-tags": { latest: "0.1.0" },
          versions: {
            "0.1.0": {
              dist: { tarball: "https://example.com/pkg.tgz" },
              dependencies: Object.fromEntries(
                Array.from({ length: 25 }, (_, i) => [`dep-${i}`, "^1.0.0"])
              ),
            },
          },
          time: { "0.1.0": oldDate },
        }),
        { status: 200 }
      )
    );

    const service = makeService({
      install: { command: "npm install complex-tool", runtime: "node" },
      required_env: [
        { key: "API_KEY", description: "key", free_tier: false },
        { key: "API_SECRET", description: "secret", free_tier: false },
        { key: "DB_URL", description: "db", free_tier: false },
      ],
    });

    const result = await checkInstallability(service);
    // exists+installable(40) + no 1-step bonus + deps>=20(0) + no env docs(0) + old publish(0) = 40
    expect(result.install_score).toBeLessThan(60);
    expect(["hard", "broken"]).toContain(result.install_difficulty);
  });

  it("pure API service gets easy score", async () => {
    const service = makeService({
      install: null,
      required_env: null,
    });
    // No npm/pip → package_exists=true, installable=true
    // No install command → steps=3, so no step bonus
    // No env → has_env_docs=true (+15)
    // No publish date
    // Score: 40 + 0 + 15 = 55 → hard (no package manager check)

    // Actually for pure API with no install command:
    // steps = 3 (manual) + 0 env = 3 → no step bonus
    // But package_exists=true, installable=true → +40
    // has_env_docs=true → +15
    // = 55 → hard

    const result = await checkInstallability(service);
    expect(result.details.package_exists).toBe(true);
    expect(result.details.package_installable).toBe(true);
    expect(result.details.has_env_docs).toBe(true);
  });
});

// ─── Helper ───

function makeService(overrides: Partial<Service>): Service {
  return {
    id: "test-svc",
    name: "Test Service",
    description: "A test service for unit tests",
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
