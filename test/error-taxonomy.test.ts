import { describe, it, expect, vi } from "vitest";
import {
  classifyByStatusCode,
  classifyByErrorText,
  classifyError,
  generateRiskNote,
  aggregateErrors,
} from "../src/error-taxonomy.js";
import type { ErrorClassification, ErrorType } from "../src/types.js";

// ─── classifyByStatusCode ───

describe("classifyByStatusCode", () => {
  it("classifies 401 as auth_failure", () => {
    expect(classifyByStatusCode(401)).toBe("auth_failure");
  });

  it("classifies 403 as auth_failure", () => {
    expect(classifyByStatusCode(403)).toBe("auth_failure");
  });

  it("classifies 429 as rate_limited", () => {
    expect(classifyByStatusCode(429)).toBe("rate_limited");
  });

  it("classifies 400 as schema_mismatch", () => {
    expect(classifyByStatusCode(400)).toBe("schema_mismatch");
  });

  it("classifies 422 as schema_mismatch", () => {
    expect(classifyByStatusCode(422)).toBe("schema_mismatch");
  });

  it("classifies 404 as not_found", () => {
    expect(classifyByStatusCode(404)).toBe("not_found");
  });

  it("classifies 500 as server_error", () => {
    expect(classifyByStatusCode(500)).toBe("server_error");
  });

  it("classifies 503 as server_error", () => {
    expect(classifyByStatusCode(503)).toBe("server_error");
  });

  it("classifies 200 as unknown", () => {
    expect(classifyByStatusCode(200)).toBe("unknown");
  });

  it("classifies other 4xx as unknown", () => {
    expect(classifyByStatusCode(418)).toBe("unknown");
  });
});

// ─── classifyByErrorText ───

describe("classifyByErrorText", () => {
  it("detects unauthorized", () => {
    expect(classifyByErrorText("Unauthorized access")).toBe("auth_failure");
  });

  it("detects invalid api key", () => {
    expect(classifyByErrorText("invalid api key provided")).toBe("auth_failure");
  });

  it("detects rate limit", () => {
    expect(classifyByErrorText("rate limit exceeded")).toBe("rate_limited");
  });

  it("detects too many requests", () => {
    expect(classifyByErrorText("Too many requests")).toBe("rate_limited");
  });

  it("detects throttled", () => {
    expect(classifyByErrorText("Request throttled")).toBe("rate_limited");
  });

  it("detects quota exceeded", () => {
    expect(classifyByErrorText("quota exceeded for this month")).toBe("rate_limited");
  });

  it("detects invalid param", () => {
    expect(classifyByErrorText("invalid parameter 'format'")).toBe("schema_mismatch");
  });

  it("detects missing required field", () => {
    expect(classifyByErrorText("missing required field: name")).toBe("schema_mismatch");
  });

  it("detects validation error", () => {
    expect(classifyByErrorText("validation error on input")).toBe("schema_mismatch");
  });

  it("detects not found", () => {
    expect(classifyByErrorText("Resource not found")).toBe("not_found");
  });

  it("detects timeout", () => {
    expect(classifyByErrorText("Request timeout")).toBe("timeout");
  });

  it("detects ETIMEDOUT", () => {
    expect(classifyByErrorText("connect ETIMEDOUT 1.2.3.4:443")).toBe("timeout");
  });

  it("detects ECONNREFUSED", () => {
    expect(classifyByErrorText("connect ECONNREFUSED 127.0.0.1:3000")).toBe("connection_refused");
  });

  it("detects connection refused text", () => {
    expect(classifyByErrorText("connection refused by server")).toBe("connection_refused");
  });

  it("detects deprecated", () => {
    expect(classifyByErrorText("This endpoint is deprecated")).toBe("deprecated");
  });

  it("detects sunset", () => {
    expect(classifyByErrorText("API sunset notice")).toBe("deprecated");
  });

  it("detects end of life", () => {
    expect(classifyByErrorText("This version has reached end of life")).toBe("deprecated");
  });

  it("detects SSL error", () => {
    expect(classifyByErrorText("SSL certificate problem")).toBe("ssl_error");
  });

  it("detects TLS error", () => {
    expect(classifyByErrorText("TLS handshake failed")).toBe("ssl_error");
  });

  it("detects internal server error", () => {
    expect(classifyByErrorText("Internal server error")).toBe("server_error");
  });

  it("returns unknown for unrecognized text", () => {
    expect(classifyByErrorText("something went wrong")).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    expect(classifyByErrorText("")).toBe("unknown");
  });
});

// ─── classifyError (combined) ───

describe("classifyError", () => {
  it("prioritizes status_code over error_text", () => {
    expect(
      classifyError({ status_code: 429, error_text: "unauthorized" })
    ).toBe("rate_limited");
  });

  it("falls back to error_text when status_code is unknown", () => {
    expect(
      classifyError({ status_code: 200, error_text: "connection refused" })
    ).toBe("connection_refused");
  });

  it("falls back to details.error", () => {
    expect(
      classifyError({
        details: { error: "ETIMEDOUT" },
      })
    ).toBe("timeout");
  });

  it("falls back to details.message", () => {
    expect(
      classifyError({
        details: { message: "rate limit exceeded" },
      })
    ).toBe("rate_limited");
  });

  it("returns unknown when nothing matches", () => {
    expect(classifyError({})).toBe("unknown");
  });

  it("handles null status_code gracefully", () => {
    expect(
      classifyError({ status_code: undefined, error_text: "forbidden" })
    ).toBe("auth_failure");
  });
});

// ─── generateRiskNote ───

describe("generateRiskNote", () => {
  it("returns null when count < 3", () => {
    expect(generateRiskNote("auth_failure", 2)).toBeNull();
  });

  it("returns auth risk note", () => {
    const note = generateRiskNote("auth_failure", 5);
    expect(note).toContain("Authentication");
  });

  it("returns rate limit risk note", () => {
    const note = generateRiskNote("rate_limited", 3);
    expect(note).toContain("rate-limited");
  });

  it("returns timeout risk note", () => {
    const note = generateRiskNote("timeout", 10);
    expect(note).toContain("Slow response");
  });

  it("returns server error risk note", () => {
    const note = generateRiskNote("server_error", 4);
    expect(note).toContain("Reliability");
  });

  it("returns deprecated risk note", () => {
    const note = generateRiskNote("deprecated", 3);
    expect(note).toContain("deprecated");
  });

  it("returns connection refused risk note", () => {
    const note = generateRiskNote("connection_refused", 5);
    expect(note).toContain("Connection");
  });

  it("returns null for unknown type", () => {
    expect(generateRiskNote("unknown", 10)).toBeNull();
  });

  it("returns null for schema_mismatch", () => {
    expect(generateRiskNote("schema_mismatch", 10)).toBeNull();
  });
});

// ─── aggregateErrors ───

describe("aggregateErrors", () => {
  it("returns empty object for empty input", () => {
    expect(aggregateErrors([])).toEqual({});
  });

  it("aggregates single service errors", () => {
    const classifications: ErrorClassification[] = [
      { service_id: "svc-1", error_type: "timeout", source: "probe", details: {} },
      { service_id: "svc-1", error_type: "timeout", source: "probe", details: {} },
      { service_id: "svc-1", error_type: "server_error", source: "health_check", details: {} },
    ];
    const result = aggregateErrors(classifications);
    expect(result["svc-1"]).toBeDefined();
    expect(result["svc-1"].total).toBe(3);
    expect(result["svc-1"].primary).toBe("timeout");
    expect(result["svc-1"].distribution).toEqual({ timeout: 2, server_error: 1 });
  });

  it("aggregates multiple services", () => {
    const classifications: ErrorClassification[] = [
      { service_id: "svc-1", error_type: "auth_failure", source: "user_report", details: {} },
      { service_id: "svc-2", error_type: "rate_limited", source: "probe", details: {} },
      { service_id: "svc-2", error_type: "rate_limited", source: "probe", details: {} },
    ];
    const result = aggregateErrors(classifications);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["svc-1"].primary).toBe("auth_failure");
    expect(result["svc-1"].total).toBe(1);
    expect(result["svc-2"].primary).toBe("rate_limited");
    expect(result["svc-2"].total).toBe(2);
  });

  it("picks correct primary when tied (first encountered wins)", () => {
    const classifications: ErrorClassification[] = [
      { service_id: "svc-1", error_type: "timeout", source: "probe", details: {} },
      { service_id: "svc-1", error_type: "server_error", source: "probe", details: {} },
    ];
    const result = aggregateErrors(classifications);
    // Both have count 1, first encountered with max wins
    expect(result["svc-1"].total).toBe(2);
    expect(["timeout", "server_error"]).toContain(result["svc-1"].primary);
  });
});
