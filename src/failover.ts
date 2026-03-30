import type { FailoverAction, FailoverAdvice } from "./types.js";

// ─── Core Decision Engine ───

export function determineFailoverAction(
  errorType: string,
  errorContext?: {
    status_code?: number;
    error_message?: string;
    retry_count?: number;
    service_health?: string;
    error_count_30d?: number;
  }
): {
  action: FailoverAction;
  reason: string;
  retry_after_seconds?: number;
  config_hint?: string;
  max_retries?: number;
  confidence: number;
} {
  const retryCount = errorContext?.retry_count ?? 0;
  const serviceHealth = errorContext?.service_health ?? "unknown";
  const errorCount30d = errorContext?.error_count_30d ?? 0;

  switch (errorType) {
    case "auth_failure":
      return {
        action: "check_config",
        reason: "Authentication failed. Verify your API key or credentials.",
        config_hint: "Check that the required API key is set and not expired.",
        confidence: 0.9,
      };

    case "rate_limited":
      if (retryCount < 3) {
        return {
          action: "retry_with_delay",
          reason: "Rate limited. Wait and retry with exponential backoff.",
          retry_after_seconds: 60 * (retryCount + 1),
          max_retries: 3,
          confidence: 0.8,
        };
      }
      return {
        action: "switch_tool",
        reason: "Persistent rate limiting. Consider an alternative tool with higher limits.",
        confidence: 0.7,
      };

    case "timeout":
      if (retryCount < 2 && serviceHealth !== "degraded") {
        return {
          action: "retry",
          reason: "Request timed out. May be a transient issue.",
          max_retries: 2,
          confidence: 0.6,
        };
      }
      return {
        action: "switch_tool",
        reason: "Persistent timeout. The service may be experiencing issues.",
        confidence: 0.7,
      };

    case "server_error":
      if (retryCount < 2) {
        return {
          action: "retry_with_delay",
          reason: "Server error. Likely transient, retry after a short wait.",
          retry_after_seconds: 30,
          max_retries: 2,
          confidence: 0.6,
        };
      }
      return {
        action: "switch_tool",
        reason: "Persistent server errors. Service may be down.",
        confidence: 0.8,
      };

    case "schema_mismatch":
      return {
        action: "check_config",
        reason: "Input validation failed. Check request format and required parameters.",
        config_hint: "Review the tool schema and ensure all required fields are provided with correct types.",
        confidence: 0.85,
      };

    case "connection_refused":
      if (serviceHealth === "dead") {
        return {
          action: "switch_tool",
          reason: "Service is unreachable and marked as dead.",
          confidence: 0.95,
        };
      }
      return {
        action: "retry_with_delay",
        reason: "Connection refused. Service may be temporarily down.",
        retry_after_seconds: 120,
        confidence: 0.5,
      };

    case "deprecated":
      return {
        action: "switch_tool",
        reason: "This tool is deprecated. Switch to an actively maintained alternative.",
        confidence: 0.95,
      };

    case "ssl_error":
      return {
        action: "switch_tool",
        reason: "SSL/TLS error. The service has certificate issues.",
        confidence: 0.8,
      };

    case "not_found":
      return {
        action: "switch_tool",
        reason: "Endpoint not found. The tool may have changed its API.",
        confidence: 0.85,
      };

    default: // "unknown" and any unrecognized type
      if (errorCount30d > 10) {
        return {
          action: "switch_tool",
          reason: "Recurring unknown errors. Consider a more reliable alternative.",
          confidence: 0.5,
        };
      }
      return {
        action: "retry",
        reason: "Unknown error. Retry once before switching.",
        max_retries: 1,
        confidence: 0.3,
      };
  }
}

// ─── Generate Failover Hint (lightweight, no DB queries) ───

export function generateFailoverHint(
  primaryErrorType: string
): { likely_error: string; advice: string } {
  const decision = determineFailoverAction(primaryErrorType);

  let advice: string;
  switch (decision.action) {
    case "retry":
      advice = `If ${primaryErrorType} occurs, retry up to ${decision.max_retries ?? 1} time(s). If it persists, call /api/failover for alternatives.`;
      break;
    case "retry_with_delay":
      advice = `If ${primaryErrorType} occurs, wait ${decision.retry_after_seconds ?? 60}s and retry. After ${decision.max_retries ?? 3} retries, call /api/failover for alternatives.`;
      break;
    case "check_config":
      advice = `If ${primaryErrorType} occurs, ${decision.config_hint ?? "check your configuration"}. Call /api/failover if the issue persists.`;
      break;
    case "switch_tool":
      advice = `This tool has a history of ${primaryErrorType}. Call /api/failover to get alternatives.`;
      break;
    default:
      advice = `If errors occur, call /api/failover for guidance.`;
  }

  return { likely_error: primaryErrorType, advice };
}

// ─── Full Failover Advice (with DB queries for alternatives) ───

export async function getFailoverAdvice(
  db: D1Database,
  serviceId: string,
  errorType: string,
  errorContext?: {
    status_code?: number;
    error_message?: string;
    retry_count?: number;
  }
): Promise<FailoverAdvice> {
  // 1. Fetch health summary for the service
  const healthRow = await db
    .prepare(
      `SELECT overall_status, error_count_30d FROM health_summary WHERE service_id = ?`
    )
    .bind(serviceId)
    .first<{ overall_status: string; error_count_30d: number }>();

  const serviceHealth = healthRow?.overall_status ?? "unknown";
  const errorCount30d = healthRow?.error_count_30d ?? 0;

  // 2. Determine action
  const decision = determineFailoverAction(errorType, {
    status_code: errorContext?.status_code,
    error_message: errorContext?.error_message,
    retry_count: errorContext?.retry_count,
    service_health: serviceHealth,
    error_count_30d: errorCount30d,
  });

  // 3. Build advice
  const advice: FailoverAdvice = {
    action: decision.action,
    reason: decision.reason,
    details: {
      ...(decision.retry_after_seconds !== undefined
        ? { retry_after_seconds: decision.retry_after_seconds }
        : {}),
      ...(decision.config_hint !== undefined
        ? { config_hint: decision.config_hint }
        : {}),
      ...(decision.max_retries !== undefined
        ? { max_retries: decision.max_retries }
        : {}),
    },
    confidence: decision.confidence,
  };

  // 4. If switch_tool, find alternatives (bypassing health gate)
  if (decision.action === "switch_tool") {
    const alternatives = await findAlternativesForFailover(db, serviceId);
    if (alternatives.length > 0) {
      advice.details.alternative_tools = alternatives;
    }
  }

  return advice;
}

// ─── Find Alternatives (bypasses health gate — for failover use) ───

async function findAlternativesForFailover(
  db: D1Database,
  serviceId: string,
  limit: number = 3
): Promise<Array<{ id: string; name: string; value_score: number; health_status: string }>> {
  // Get source service capabilities
  const source = await db
    .prepare(`SELECT capabilities FROM services WHERE id = ?`)
    .bind(serviceId)
    .first<{ capabilities: string | null }>();

  if (!source) return [];

  let capabilities: string[] = [];
  try {
    capabilities = source.capabilities ? JSON.parse(source.capabilities) : [];
  } catch {
    capabilities = [];
  }

  if (capabilities.length === 0) return [];

  // Find healthy/unknown services with overlapping capabilities
  const capPlaceholders = capabilities.map((_, i) => `?${i + 3}`).join(",");
  const rows = await db
    .prepare(
      `SELECT DISTINCT s.id, s.name, s.reputation_score,
              COALESCE(h.overall_status, 'unknown') as health_status
       FROM services s
       LEFT JOIN health_summary h ON s.id = h.service_id
       WHERE s.id != ?1
         AND (h.overall_status IS NULL OR h.overall_status IN ('healthy', 'unknown'))
         AND EXISTS (
           SELECT 1 FROM json_each(s.capabilities) je
           WHERE je.value IN (${capPlaceholders})
         )
       ORDER BY s.reputation_score DESC NULLS LAST
       LIMIT ?2`
    )
    .bind(serviceId, limit, ...capabilities)
    .all();

  return (rows.results ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    value_score: Math.round(((r.reputation_score as number) ?? 0) / 5 * 100) / 100,
    health_status: r.health_status as string,
  }));
}
