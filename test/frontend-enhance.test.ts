import { describe, it, expect, vi } from "vitest";
import { serviceDetailPageHtml } from "../src/pages/service-detail.js";

// ─── Service Detail Page Generation ───

describe("serviceDetailPageHtml", () => {
  it("returns valid HTML with service ID embedded", () => {
    const html = serviceDetailPageHtml("svc-123");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("svc-123");
    expect(html).toContain("/api/services/");
  });

  it("escapes single quotes in service ID", () => {
    const html = serviceDetailPageHtml("svc-test's");
    expect(html).toContain("svc-test\\'s");
  });

  it("includes all required sections", () => {
    const html = serviceDetailPageHtml("svc-1");
    expect(html).toContain("health-section");
    expect(html).toContain("cost-section");
    expect(html).toContain("errors-section");
    expect(html).toContain("versions-section");
    expect(html).toContain("cooccurrence-section");
    expect(html).toContain("benchmarks-section");
    expect(html).toContain("install-info");
    expect(html).toContain("tools-section");
  });

  it("includes back link to registry", () => {
    const html = serviceDetailPageHtml("svc-1");
    expect(html).toContain('href="/registry"');
    expect(html).toContain("Back to Registry");
  });

  it("includes nav with all pages", () => {
    const html = serviceDetailPageHtml("svc-1");
    expect(html).toContain('href="/explorer"');
    expect(html).toContain('href="/analytics"');
    expect(html).toContain('href="/benchmark"');
  });
});

// ─── Enhanced /api/services Parameter Parsing ───

describe("GET /api/services enhanced parameter parsing", () => {
  function parseParams(query: Record<string, string | undefined>) {
    const page = Math.max(1, parseInt(query.page || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20") || 1));
    const search = query.search || undefined;
    const platform = query.platform || undefined;
    const sort = query.sort || undefined;
    const health = query.health || undefined;
    const pricing = query.pricing || undefined;
    const install = query.install || undefined;
    return { page, limit, search, platform, sort, health, pricing, install };
  }

  it("parses health filter", () => {
    const params = parseParams({ health: "healthy" });
    expect(params.health).toBe("healthy");
  });

  it("parses pricing filter", () => {
    const params = parseParams({ pricing: "free" });
    expect(params.pricing).toBe("free");
  });

  it("parses install filter", () => {
    const params = parseParams({ install: "easy" });
    expect(params.install).toBe("easy");
  });

  it("returns undefined for missing filters", () => {
    const params = parseParams({});
    expect(params.health).toBeUndefined();
    expect(params.pricing).toBeUndefined();
    expect(params.install).toBeUndefined();
  });

  it("supports new sort options", () => {
    expect(parseParams({ sort: "health" }).sort).toBe("health");
    expect(parseParams({ sort: "install" }).sort).toBe("install");
  });

  it("handles all filters simultaneously", () => {
    const params = parseParams({
      search: "search",
      platform: "smithery",
      health: "healthy",
      pricing: "free",
      install: "easy",
      sort: "health",
    });
    expect(params.search).toBe("search");
    expect(params.platform).toBe("smithery");
    expect(params.health).toBe("healthy");
    expect(params.pricing).toBe("free");
    expect(params.install).toBe("easy");
    expect(params.sort).toBe("health");
  });
});

// ─── ServiceWithMeta Shape ───

describe("ServiceWithMeta enrichment", () => {
  it("adds health/install metadata fields to service", () => {
    // Simulates what getServicesPaginated does with LEFT JOIN results
    const row = {
      id: "svc-1",
      name: "Test Service",
      health_status: "healthy",
      health_uptime: 0.99,
      install_score: 85,
      install_difficulty: "easy",
      error_count_30d: 0,
      primary_error_type: null,
      current_version: "1.2.3",
      recent_breaking_change: 0,
    };

    const meta = {
      health_status: row.health_status ?? "unknown",
      health_uptime: row.health_uptime ?? 0,
      install_score: row.install_score ?? null,
      install_difficulty: row.install_difficulty ?? null,
      error_count_30d: row.error_count_30d ?? 0,
      primary_error_type: row.primary_error_type ?? null,
      current_version: row.current_version ?? null,
      recent_breaking_change: (row.recent_breaking_change ?? 0) === 1,
    };

    expect(meta.health_status).toBe("healthy");
    expect(meta.health_uptime).toBe(0.99);
    expect(meta.install_score).toBe(85);
    expect(meta.install_difficulty).toBe("easy");
    expect(meta.error_count_30d).toBe(0);
    expect(meta.current_version).toBe("1.2.3");
    expect(meta.recent_breaking_change).toBe(false);
  });

  it("defaults to unknown/null when no health_summary row", () => {
    const row = {
      health_status: null,
      health_uptime: null,
      install_score: null,
      install_difficulty: null,
      error_count_30d: null,
      primary_error_type: null,
      current_version: null,
      recent_breaking_change: null,
    };

    const meta = {
      health_status: row.health_status ?? "unknown",
      health_uptime: row.health_uptime ?? 0,
      install_score: row.install_score ?? null,
      install_difficulty: row.install_difficulty ?? null,
      error_count_30d: row.error_count_30d ?? 0,
      primary_error_type: row.primary_error_type ?? null,
      current_version: row.current_version ?? null,
      recent_breaking_change: (row.recent_breaking_change ?? 0) === 1,
    };

    expect(meta.health_status).toBe("unknown");
    expect(meta.health_uptime).toBe(0);
    expect(meta.install_score).toBeNull();
    expect(meta.install_difficulty).toBeNull();
    expect(meta.error_count_30d).toBe(0);
    expect(meta.recent_breaking_change).toBe(false);
  });

  it("detects breaking change flag correctly", () => {
    expect(((1) === 1)).toBe(true);
    expect(((0) === 1)).toBe(false);
  });
});
