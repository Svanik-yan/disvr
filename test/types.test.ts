import { describe, it, expect } from "vitest";
import { rowToService } from "../src/types.js";
import type { ServiceRow } from "../src/types.js";

describe("rowToService", () => {
  const baseRow: ServiceRow = {
    id: "test-001",
    name: "Test Service",
    description: "A test service",
    capabilities: '["search", "web"]',
    platform: "smithery",
    protocols: '{"mcp": "mcp://test"}',
    pricing: '{"model": "per_call", "price_usd": 0.05}',
    reputation_score: 4.2,
    success_rate: 0.95,
    uptime_30d: 0.99,
    latency_p95_ms: 500,
    total_calls: 1000,
    successful_calls: 950,
    failed_calls: 50,
    retry_rate: 0.05,
    avg_cost_per_success: 0.053,
    doc_completeness: 0.8,
    verified: 1,
    source_url: "https://example.com",
    last_health_check: "2026-03-25T10:00:00Z",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-25T10:00:00Z",
  };

  it("parses JSON fields correctly", () => {
    const service = rowToService(baseRow);
    expect(service.capabilities).toEqual(["search", "web"]);
    expect(service.protocols).toEqual({ mcp: "mcp://test" });
    expect(service.pricing).toEqual({ model: "per_call", price_usd: 0.05 });
  });

  it("converts verified integer to boolean", () => {
    expect(rowToService({ ...baseRow, verified: 1 }).verified).toBe(true);
    expect(rowToService({ ...baseRow, verified: 0 }).verified).toBe(false);
  });

  it("handles null JSON fields with fallbacks", () => {
    const service = rowToService({
      ...baseRow,
      capabilities: null,
      protocols: null,
      pricing: null,
    });
    expect(service.capabilities).toEqual([]);
    expect(service.protocols).toEqual({});
    expect(service.pricing).toEqual({ model: "free", price_usd: 0 });
  });

  it("handles malformed JSON with fallbacks", () => {
    const service = rowToService({
      ...baseRow,
      capabilities: "not-json",
      protocols: "{broken",
    });
    expect(service.capabilities).toEqual([]);
    expect(service.protocols).toEqual({});
  });

  it("preserves numeric fields", () => {
    const service = rowToService(baseRow);
    expect(service.reputation_score).toBe(4.2);
    expect(service.success_rate).toBe(0.95);
    expect(service.retry_rate).toBe(0.05);
    expect(service.avg_cost_per_success).toBe(0.053);
    expect(service.total_calls).toBe(1000);
    expect(service.successful_calls).toBe(950);
    expect(service.failed_calls).toBe(50);
  });

  it("preserves null numeric fields", () => {
    const service = rowToService({
      ...baseRow,
      reputation_score: null,
      success_rate: null,
      retry_rate: null,
      avg_cost_per_success: null,
    });
    expect(service.reputation_score).toBeNull();
    expect(service.success_rate).toBeNull();
    expect(service.retry_rate).toBeNull();
    expect(service.avg_cost_per_success).toBeNull();
  });
});
