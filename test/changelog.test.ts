import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseSemver,
  detectBreakingChange,
  checkNpmVersionChange,
  checkPyPIVersionChange,
  extractPackageInfo,
  runVersionChecks,
  getVersionHistory,
  getRecentBreakingChanges,
} from "../src/changelog.js";

// ─── parseSemver ───

describe("parseSemver", () => {
  it("parses standard version", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("parses version with v prefix", () => {
    expect(parseSemver("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("parses zero version", () => {
    expect(parseSemver("0.1.0")).toEqual({ major: 0, minor: 1, patch: 0 });
  });

  it("returns null for invalid version", () => {
    expect(parseSemver("invalid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSemver("")).toBeNull();
  });

  it("parses version with extra suffix", () => {
    expect(parseSemver("1.2.3-beta.1")).toEqual({ major: 1, minor: 2, patch: 3 });
  });
});

// ─── detectBreakingChange ───

describe("detectBreakingChange", () => {
  it("major version bump is breaking", () => {
    const result = detectBreakingChange("2.0.0", "1.5.3");
    expect(result.is_breaking).toBe(true);
    expect(result.reasons).toContain("major_version_bump");
  });

  it("0.x minor bump is breaking", () => {
    const result = detectBreakingChange("0.2.0", "0.1.0");
    expect(result.is_breaking).toBe(true);
    expect(result.reasons).toContain("0x_minor_bump");
  });

  it("minor update is not breaking", () => {
    const result = detectBreakingChange("1.3.0", "1.2.3");
    expect(result.is_breaking).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("patch update is not breaking", () => {
    const result = detectBreakingChange("1.2.4", "1.2.3");
    expect(result.is_breaking).toBe(false);
  });

  it("null previous version is not breaking (first record)", () => {
    const result = detectBreakingChange("1.0.0", null);
    expect(result.is_breaking).toBe(false);
  });

  it("unparseable versions are not breaking", () => {
    const result = detectBreakingChange("latest", "stable");
    expect(result.is_breaking).toBe(false);
  });
});

// ─── checkNpmVersionChange ───

describe("checkNpmVersionChange", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when version unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "1.0.0" },
        time: { "1.0.0": "2026-01-01T00:00:00Z" },
      }),
    }));

    const result = await checkNpmVersionChange("test-pkg", "1.0.0");
    expect(result).toBeNull();
  });

  it("returns VersionChange when version changed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "2.0.0" },
        time: { "2.0.0": "2026-03-28T00:00:00Z" },
      }),
    }));

    const result = await checkNpmVersionChange("test-pkg", "1.5.3");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("2.0.0");
    expect(result!.previous_version).toBe("1.5.3");
    expect(result!.is_breaking).toBe(true);
    expect(result!.breaking_reasons).toContain("major_version_bump");
    expect(result!.package_type).toBe("npm");
  });

  it("detects deprecated marker as breaking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "1.1.0" },
        time: { "1.1.0": "2026-03-28T00:00:00Z" },
        versions: { "1.1.0": { deprecated: "Use @new/pkg instead" } },
      }),
    }));

    const result = await checkNpmVersionChange("test-pkg", "1.0.0");
    expect(result).not.toBeNull();
    expect(result!.is_breaking).toBe(true);
    expect(result!.breaking_reasons).toContain("deprecated_marker");
  });

  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await checkNpmVersionChange("nonexistent-pkg", null);
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const result = await checkNpmVersionChange("test-pkg", "1.0.0");
    expect(result).toBeNull();
  });

  it("returns VersionChange for first detection (null known)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        "dist-tags": { latest: "1.0.0" },
        time: { "1.0.0": "2026-01-01T00:00:00Z" },
      }),
    }));

    const result = await checkNpmVersionChange("test-pkg", null);
    expect(result).not.toBeNull();
    expect(result!.version).toBe("1.0.0");
    expect(result!.is_breaking).toBe(false);
  });
});

// ─── checkPyPIVersionChange ───

describe("checkPyPIVersionChange", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns VersionChange when version changed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        info: {
          version: "2.0.0",
          classifiers: [],
        },
      }),
    }));

    const result = await checkPyPIVersionChange("test-pkg", "1.0.0");
    expect(result).not.toBeNull();
    expect(result!.version).toBe("2.0.0");
    expect(result!.is_breaking).toBe(true);
    expect(result!.package_type).toBe("pypi");
  });

  it("detects inactive classifier as breaking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        info: {
          version: "1.1.0",
          classifiers: ["Development Status :: 7 - Inactive"],
        },
      }),
    }));

    const result = await checkPyPIVersionChange("test-pkg", "1.0.0");
    expect(result).not.toBeNull();
    expect(result!.is_breaking).toBe(true);
    expect(result!.breaking_reasons).toContain("inactive_project");
  });

  it("returns null when version unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ info: { version: "1.0.0", classifiers: [] } }),
    }));

    const result = await checkPyPIVersionChange("test-pkg", "1.0.0");
    expect(result).toBeNull();
  });
});

// ─── extractPackageInfo ───

describe("extractPackageInfo", () => {
  it("extracts npm package from npx command", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: "npx @anthropic/mcp-server",
      install_runtime: "node",
      source_url: null,
    });
    expect(result).toEqual({ name: "@anthropic/mcp-server", type: "npm" });
  });

  it("extracts npm package from npm install command", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: "npm install my-package",
      install_runtime: "node",
      source_url: null,
    });
    expect(result).toEqual({ name: "my-package", type: "npm" });
  });

  it("extracts pypi package from pip install", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: "pip install my-tool",
      install_runtime: "python",
      source_url: null,
    });
    expect(result).toEqual({ name: "my-tool", type: "pypi" });
  });

  it("extracts pypi package from uvx command", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: "uvx my-tool",
      install_runtime: "python",
      source_url: null,
    });
    expect(result).toEqual({ name: "my-tool", type: "pypi" });
  });

  it("skips @smithery/cli in npx commands", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: "npx -y @smithery/cli install github --client claude",
      install_runtime: "node",
      source_url: null,
    });
    expect(result).toBeNull();
  });

  it("extracts from npmjs.com source_url", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: null,
      install_runtime: null,
      source_url: "https://www.npmjs.com/package/@modelcontextprotocol/server",
    });
    expect(result).toEqual({ name: "@modelcontextprotocol/server", type: "npm" });
  });

  it("extracts from pypi.org source_url", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: null,
      install_runtime: null,
      source_url: "https://pypi.org/project/mcp-server/",
    });
    expect(result).toEqual({ name: "mcp-server", type: "pypi" });
  });

  it("returns null when no package info available", () => {
    const result = extractPackageInfo({
      id: "test",
      install_command: null,
      install_runtime: null,
      source_url: "https://github.com/user/repo",
    });
    expect(result).toBeNull();
  });
});

// ─── runVersionChecks (with mocked DB) ───

describe("runVersionChecks", () => {
  function mockDb(serviceRows: any[] = [], healthRows: any[] = []) {
    const preparedStmt = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
      all: vi.fn().mockResolvedValue({ results: serviceRows }),
      first: vi.fn().mockResolvedValue(null),
    };
    return {
      prepare: vi.fn().mockReturnValue(preparedStmt),
      _stmt: preparedStmt,
    } as any;
  }

  it("returns zeros when no services have install_command", async () => {
    const db = mockDb([]);
    const result = await runVersionChecks(db, 10);
    expect(result.checked).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.breaking_changes).toBe(0);
  });
});

// ─── getVersionHistory ───

describe("getVersionHistory", () => {
  it("returns parsed version history", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              version: "2.0.0",
              previous_version: "1.5.3",
              is_breaking_change: 1,
              breaking_details: JSON.stringify({ reasons: ["major_version_bump"] }),
              changes_detected: JSON.stringify({ type: "major_update" }),
              published_at: "2026-03-28T00:00:00Z",
              detected_at: "2026-03-28T12:00:00Z",
            },
            {
              version: "1.5.3",
              previous_version: "1.5.2",
              is_breaking_change: 0,
              breaking_details: null,
              changes_detected: JSON.stringify({ type: "patch" }),
              published_at: "2026-03-20T00:00:00Z",
              detected_at: "2026-03-21T12:00:00Z",
            },
          ],
        }),
      }),
    } as any;

    const result = await getVersionHistory(db, "svc-1");
    expect(result).toHaveLength(2);
    expect(result[0].version).toBe("2.0.0");
    expect(result[0].is_breaking_change).toBe(true);
    expect(result[0].breaking_details?.reasons).toContain("major_version_bump");
    expect(result[1].is_breaking_change).toBe(false);
    expect(result[1].breaking_details).toBeNull();
  });
});

// ─── getRecentBreakingChanges ───

describe("getRecentBreakingChanges", () => {
  it("returns recent breaking changes with service names", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              service_id: "svc-1",
              service_name: "Test Service",
              version: "2.0.0",
              previous_version: "1.5.3",
              breaking_details: JSON.stringify({ reasons: ["major_version_bump"] }),
              detected_at: "2026-03-28T12:00:00Z",
            },
          ],
        }),
      }),
    } as any;

    const result = await getRecentBreakingChanges(db, 7);
    expect(result).toHaveLength(1);
    expect(result[0].service_id).toBe("svc-1");
    expect(result[0].service_name).toBe("Test Service");
    expect(result[0].breaking_details.reasons).toContain("major_version_bump");
  });

  it("returns empty array when no breaking changes", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    } as any;

    const result = await getRecentBreakingChanges(db, 7);
    expect(result).toHaveLength(0);
  });
});
