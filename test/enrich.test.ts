import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGitHubReadme, extractStructuredData, enrichServices } from "../src/enrich.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchGitHubReadme", () => {
  it("extracts owner/repo from standard GitHub URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa("# Hello World"),
        encoding: "base64",
      }),
    });

    const readme = await fetchGitHubReadme("https://github.com/owner/repo");
    expect(readme).toBe("# Hello World");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/readme",
      expect.any(Object)
    );
  });

  it("handles GitHub URL with .git suffix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa("# Test"),
        encoding: "base64",
      }),
    });

    const readme = await fetchGitHubReadme("https://github.com/owner/repo.git");
    expect(readme).toBe("# Test");
  });

  it("handles GitHub URL with tree path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa("# Sub"),
        encoding: "base64",
      }),
    });

    const readme = await fetchGitHubReadme("https://github.com/owner/repo/tree/main/packages/sub");
    expect(readme).toBe("# Sub");
  });

  it("returns null for non-GitHub URL", async () => {
    const readme = await fetchGitHubReadme("https://gitlab.com/owner/repo");
    expect(readme).toBeNull();
  });

  it("returns null on API error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const readme = await fetchGitHubReadme("https://github.com/owner/nonexistent");
    expect(readme).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const readme = await fetchGitHubReadme("https://github.com/owner/repo");
    expect(readme).toBeNull();
  });
});

describe("extractStructuredData", () => {
  it("parses valid LLM response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              install_command: "npx test-mcp",
              install_runtime: "node",
              required_env: [{ key: "API_KEY", description: "The API key", free_tier: true }],
              tools_provided: [{ name: "do_thing", description: "Does a thing", example_input: { x: 1 } }],
            }),
          },
        }],
      }),
    });

    const result = await extractStructuredData("# Some README", "sk-test");
    expect(result.install_command).toBe("npx test-mcp");
    expect(result.install_runtime).toBe("node");
    expect(result.required_env).toHaveLength(1);
    expect(result.required_env[0].key).toBe("API_KEY");
    expect(result.tools_provided).toHaveLength(1);
    expect(result.tools_provided[0].name).toBe("do_thing");
  });

  it("returns defaults on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const result = await extractStructuredData("# README", "sk-test");
    expect(result.install_command).toBeNull();
    expect(result.required_env).toEqual([]);
    expect(result.tools_provided).toEqual([]);
  });

  it("returns defaults on malformed JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json at all" } }],
      }),
    });

    const result = await extractStructuredData("# README", "sk-test");
    expect(result.install_command).toBeNull();
    expect(result.required_env).toEqual([]);
  });

  it("truncates long README to 8000 chars", async () => {
    const longReadme = "x".repeat(20000);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              install_command: null,
              install_runtime: null,
              required_env: [],
              tools_provided: [],
            }),
          },
        }],
      }),
    });

    await extractStructuredData(longReadme, "sk-test");

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const userContent = callBody.messages[1].content;
    // "README content:\n\n" (18 chars) + 8000 chars = 8018
    expect(userContent.length).toBeLessThan(9000);
  });

  it("returns defaults when choices array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    });

    const result = await extractStructuredData("# README", "sk-test");
    expect(result.install_command).toBeNull();
    expect(result.tools_provided).toEqual([]);
  });
});

describe("enrichServices", () => {
  it("returns zero counts when no services need enrichment", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    };

    const result = await enrichServices(mockDB as any, "sk-test", { limit: 10 });
    expect(result.total).toBe(0);
    expect(result.enriched).toBe(0);
  });

  it("skips services where README is not found", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{
              id: "svc-1",
              name: "Test Service",
              source_url: "https://github.com/owner/repo",
              install_command: null,
            }],
          }),
        }),
      }),
    };

    // GitHub API returns 404
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await enrichServices(mockDB as any, "sk-test");
    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.details[0].status).toBe("skipped");
    expect(result.details[0].reason).toBe("README not found");
  });

  it("enriches service with extracted data", async () => {
    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockDB = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("SELECT")) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [{
                  id: "svc-1",
                  name: "Test MCP",
                  source_url: "https://github.com/owner/test-mcp",
                  install_command: null,
                }],
              }),
            }),
          };
        }
        // UPDATE
        return {
          bind: vi.fn().mockReturnValue({ run: mockRun }),
        };
      }),
    };

    // GitHub README fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: btoa("# Test MCP\n\nInstall: npx test-mcp"),
        encoding: "base64",
      }),
    });

    // OpenAI extraction
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              install_command: "npx test-mcp",
              install_runtime: "node",
              required_env: [{ key: "TOKEN", description: "Auth token" }],
              tools_provided: [{ name: "search", description: "Search items" }],
            }),
          },
        }],
      }),
    });

    const result = await enrichServices(mockDB as any, "sk-test");
    expect(result.enriched).toBe(1);
    expect(result.details[0].status).toBe("enriched");
    expect(mockRun).toHaveBeenCalled();
  });

  it("uses forceRefresh to re-enrich all services", async () => {
    const mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    };

    await enrichServices(mockDB as any, "sk-test", { forceRefresh: true });

    // Verify the SQL does NOT contain "tools_provided IS NULL"
    const sql = mockDB.prepare.mock.calls[0][0];
    expect(sql).not.toContain("tools_provided IS NULL");
    expect(sql).toContain("github.com");
  });

  it("defaults limit to 20", async () => {
    const mockBind = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
    });
    const mockDB = {
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    };

    await enrichServices(mockDB as any, "sk-test");

    expect(mockBind).toHaveBeenCalledWith(20);
  });
});
