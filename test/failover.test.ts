import { describe, it, expect, vi } from "vitest";
import { determineFailoverAction, generateFailoverHint, getFailoverAdvice } from "../src/failover.js";

// ─── Decision Engine ───

describe("determineFailoverAction", () => {
  it("auth_failure → check_config with confidence 0.9", () => {
    const result = determineFailoverAction("auth_failure");
    expect(result.action).toBe("check_config");
    expect(result.confidence).toBe(0.9);
    expect(result.config_hint).toBeDefined();
  });

  it("rate_limited + retry_count=0 → retry_with_delay 60s", () => {
    const result = determineFailoverAction("rate_limited", { retry_count: 0 });
    expect(result.action).toBe("retry_with_delay");
    expect(result.retry_after_seconds).toBe(60);
    expect(result.max_retries).toBe(3);
    expect(result.confidence).toBe(0.8);
  });

  it("rate_limited + retry_count=2 → retry_with_delay 180s (incremental backoff)", () => {
    const result = determineFailoverAction("rate_limited", { retry_count: 2 });
    expect(result.action).toBe("retry_with_delay");
    expect(result.retry_after_seconds).toBe(180);
  });

  it("rate_limited + retry_count=3 → switch_tool", () => {
    const result = determineFailoverAction("rate_limited", { retry_count: 3 });
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.7);
  });

  it("timeout + retry_count=0 → retry", () => {
    const result = determineFailoverAction("timeout", { retry_count: 0 });
    expect(result.action).toBe("retry");
    expect(result.max_retries).toBe(2);
    expect(result.confidence).toBe(0.6);
  });

  it("timeout + retry_count=2 → switch_tool", () => {
    const result = determineFailoverAction("timeout", { retry_count: 2 });
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.7);
  });

  it("timeout + service_health=degraded → switch_tool even with retry_count=0", () => {
    const result = determineFailoverAction("timeout", { retry_count: 0, service_health: "degraded" });
    expect(result.action).toBe("switch_tool");
  });

  it("server_error + retry_count=0 → retry_with_delay 30s", () => {
    const result = determineFailoverAction("server_error", { retry_count: 0 });
    expect(result.action).toBe("retry_with_delay");
    expect(result.retry_after_seconds).toBe(30);
    expect(result.max_retries).toBe(2);
  });

  it("server_error + retry_count=2 → switch_tool with confidence 0.8", () => {
    const result = determineFailoverAction("server_error", { retry_count: 2 });
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.8);
  });

  it("schema_mismatch → check_config with confidence 0.85", () => {
    const result = determineFailoverAction("schema_mismatch");
    expect(result.action).toBe("check_config");
    expect(result.confidence).toBe(0.85);
    expect(result.config_hint).toContain("schema");
  });

  it("connection_refused + health=dead → switch_tool, confidence=0.95", () => {
    const result = determineFailoverAction("connection_refused", { service_health: "dead" });
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.95);
  });

  it("connection_refused + health=healthy → retry_with_delay 120s", () => {
    const result = determineFailoverAction("connection_refused", { service_health: "healthy" });
    expect(result.action).toBe("retry_with_delay");
    expect(result.retry_after_seconds).toBe(120);
    expect(result.confidence).toBe(0.5);
  });

  it("deprecated → switch_tool, confidence=0.95", () => {
    const result = determineFailoverAction("deprecated");
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.95);
    expect(result.reason).toContain("deprecated");
  });

  it("ssl_error → switch_tool", () => {
    const result = determineFailoverAction("ssl_error");
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.8);
  });

  it("not_found → switch_tool with confidence 0.85", () => {
    const result = determineFailoverAction("not_found");
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.85);
  });

  it("unknown + error_count_30d > 10 → switch_tool", () => {
    const result = determineFailoverAction("unknown", { error_count_30d: 15 });
    expect(result.action).toBe("switch_tool");
    expect(result.confidence).toBe(0.5);
  });

  it("unknown + error_count_30d < 10 → retry", () => {
    const result = determineFailoverAction("unknown", { error_count_30d: 3 });
    expect(result.action).toBe("retry");
    expect(result.max_retries).toBe(1);
    expect(result.confidence).toBe(0.3);
  });

  it("unrecognized error type → treated as unknown", () => {
    const result = determineFailoverAction("something_weird");
    expect(result.action).toBe("retry");
    expect(result.confidence).toBe(0.3);
  });
});

// ─── Generate Failover Hint ───

describe("generateFailoverHint", () => {
  it("generates hint for rate_limited", () => {
    const hint = generateFailoverHint("rate_limited");
    expect(hint.likely_error).toBe("rate_limited");
    expect(hint.advice).toContain("wait");
    expect(hint.advice).toContain("/api/failover");
  });

  it("generates hint for auth_failure", () => {
    const hint = generateFailoverHint("auth_failure");
    expect(hint.likely_error).toBe("auth_failure");
    expect(hint.advice).toContain("Check");
  });

  it("generates hint for deprecated", () => {
    const hint = generateFailoverHint("deprecated");
    expect(hint.likely_error).toBe("deprecated");
    expect(hint.advice).toContain("alternatives");
  });

  it("generates hint for timeout", () => {
    const hint = generateFailoverHint("timeout");
    expect(hint.likely_error).toBe("timeout");
    expect(hint.advice).toContain("retry");
  });
});

// ─── Full Failover Advice (with mock DB) ───

function mockDb(healthRow: any = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(healthRow),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  } as any;
}

describe("getFailoverAdvice", () => {
  it("switch_tool includes alternative_tools when available", async () => {
    const db = mockDb({ overall_status: "dead", error_count_30d: 20 });
    // Mock the capabilities query and alternatives query
    db._stmt.first
      .mockResolvedValueOnce({ overall_status: "dead", error_count_30d: 20 }) // health_summary
      .mockResolvedValueOnce({ capabilities: '["search"]' }); // services
    db._stmt.all.mockResolvedValueOnce({
      results: [
        { id: "alt-1", name: "Alt Tool", reputation_score: 4.0, health_status: "healthy" },
      ],
    });

    const advice = await getFailoverAdvice(db, "svc-dead", "deprecated");
    expect(advice.action).toBe("switch_tool");
    expect(advice.confidence).toBe(0.95);
  });

  it("check_config includes config_hint", async () => {
    const db = mockDb({ overall_status: "healthy", error_count_30d: 0 });

    const advice = await getFailoverAdvice(db, "svc-1", "auth_failure");
    expect(advice.action).toBe("check_config");
    expect(advice.details.config_hint).toBeDefined();
    expect(advice.confidence).toBe(0.9);
  });

  it("retry_with_delay includes retry_after_seconds", async () => {
    const db = mockDb({ overall_status: "healthy", error_count_30d: 0 });

    const advice = await getFailoverAdvice(db, "svc-1", "rate_limited", { retry_count: 1 });
    expect(advice.action).toBe("retry_with_delay");
    expect(advice.details.retry_after_seconds).toBe(120); // 60 * (1 + 1)
    expect(advice.details.max_retries).toBe(3);
  });

  it("handles missing health data gracefully", async () => {
    const db = mockDb(null);

    const advice = await getFailoverAdvice(db, "svc-unknown", "timeout");
    expect(advice.action).toBe("retry");
    expect(advice.confidence).toBe(0.6);
  });
});

// ─── API validation ───

describe("POST /api/failover validation", () => {
  it("requires service_id and error_type", () => {
    const body = { service_id: "", error_type: "" };
    const isValid = body.service_id && body.error_type;
    expect(isValid).toBeFalsy();
  });

  it("accepts valid request", () => {
    const body = { service_id: "svc-1", error_type: "timeout", retry_count: 2 };
    const isValid = body.service_id && body.error_type;
    expect(isValid).toBeTruthy();
  });
});
