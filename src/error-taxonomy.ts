import type { ErrorType, ErrorClassification } from "./types.js";

// ─── Status Code Classification ───

export function classifyByStatusCode(statusCode: number): ErrorType {
  if (statusCode === 401 || statusCode === 403) return "auth_failure";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 400 || statusCode === 422) return "schema_mismatch";
  if (statusCode === 404) return "not_found";
  if (statusCode >= 500 && statusCode <= 599) return "server_error";
  if (statusCode >= 400 && statusCode < 500) return "unknown";
  return "unknown";
}

// ─── Error Text Classification ───

const TEXT_PATTERNS: Array<[RegExp, ErrorType]> = [
  [/\bunauthorized\b/i, "auth_failure"],
  [/\bforbidden\b/i, "auth_failure"],
  [/\binvalid[\s._-]*(?:api[\s._-]*)?key\b/i, "auth_failure"],
  [/\bauth(?:entication|orization)?\s+(?:fail|error|required)\b/i, "auth_failure"],
  [/\brate[\s._-]*limit/i, "rate_limited"],
  [/\btoo\s+many\s+requests\b/i, "rate_limited"],
  [/\bthrottl/i, "rate_limited"],
  [/\bquota\s+exceeded\b/i, "rate_limited"],
  [/\binvalid[\s._-]*param/i, "schema_mismatch"],
  [/\bmissing[\s._-]*(?:required\s+)?field/i, "schema_mismatch"],
  [/\bschema\b/i, "schema_mismatch"],
  [/\bvalidation\s+(?:error|fail)/i, "schema_mismatch"],
  [/\bnot\s+found\b/i, "not_found"],
  [/\bno\s+such\b/i, "not_found"],
  [/\btimeout\b/i, "timeout"],
  [/\btimed?\s*out\b/i, "timeout"],
  [/\bETIMEDOUT\b/, "timeout"],
  [/\bECONNABORTED\b/, "timeout"],
  [/\bECONNREFUSED\b/, "connection_refused"],
  [/\bconnection\s+refused\b/i, "connection_refused"],
  [/\bconnect\s+failed\b/i, "connection_refused"],
  [/\bECONNRESET\b/, "connection_refused"],
  [/\bdeprecated\b/i, "deprecated"],
  [/\bno\s+longer\s+(?:supported|available|maintained)\b/i, "deprecated"],
  [/\bsunset\b/i, "deprecated"],
  [/\bend\s+of\s+life\b/i, "deprecated"],
  [/\bssl\b/i, "ssl_error"],
  [/\bcertificate\b/i, "ssl_error"],
  [/\bCERT\b/, "ssl_error"],
  [/\bTLS\b/, "ssl_error"],
  [/\binternal\s+server\s+error\b/i, "server_error"],
];

export function classifyByErrorText(text: string): ErrorType {
  for (const [pattern, errorType] of TEXT_PATTERNS) {
    if (pattern.test(text)) return errorType;
  }
  return "unknown";
}

// ─── Combined Classification ───

export function classifyError(input: {
  status_code?: number;
  error_text?: string;
  details?: Record<string, any>;
}): ErrorType {
  // 1. Status code first
  if (input.status_code !== undefined && input.status_code !== null) {
    const result = classifyByStatusCode(input.status_code);
    if (result !== "unknown") return result;
  }

  // 2. Error text
  if (input.error_text) {
    const result = classifyByErrorText(input.error_text);
    if (result !== "unknown") return result;
  }

  // 3. Details.error or details.message
  if (input.details) {
    const errorMsg = input.details.error || input.details.message || "";
    if (typeof errorMsg === "string" && errorMsg.length > 0) {
      const result = classifyByErrorText(errorMsg);
      if (result !== "unknown") return result;
    }
  }

  return "unknown";
}

// ─── Risk Note Generation ───

export function generateRiskNote(primary: ErrorType, count: number): string | null {
  if (count < 3) return null;
  switch (primary) {
    case "auth_failure":
      return "Authentication issues reported. Ensure your API key is correctly configured.";
    case "rate_limited":
      return "Frequently rate-limited. Consider alternatives for high-volume usage.";
    case "timeout":
      return "Slow response times reported. May not be suitable for time-sensitive workflows.";
    case "server_error":
      return "Reliability issues detected. Server errors have been observed.";
    case "deprecated":
      return "This tool may be deprecated. Check for newer alternatives.";
    case "connection_refused":
      return "Connection issues detected. The service may be down.";
    default:
      return null;
  }
}

// ─── Classify from Health Checks ───

export async function classifyFromHealthChecks(
  db: D1Database,
  since: string
): Promise<ErrorClassification[]> {
  const rows = await db
    .prepare(
      `SELECT service_id, check_type, status, details, checked_at
       FROM health_checks
       WHERE status IN ('dead', 'timeout', 'error')
         AND checked_at > ?
       ORDER BY checked_at DESC
       LIMIT 500`
    )
    .bind(since)
    .all();

  if (!rows.results || rows.results.length === 0) return [];

  const classifications: ErrorClassification[] = [];

  for (const row of rows.results as any[]) {
    let details: Record<string, any> = {};
    try {
      details = row.details ? JSON.parse(row.details) : {};
    } catch {
      details = {};
    }

    const statusCode = details.response_status ?? details.status_code ?? undefined;
    const errorText = details.error ?? "";
    const checkType = row.check_type as string;
    const source: "probe" | "health_check" =
      checkType === "mcp_handshake" || checkType === "api_probe" ? "probe" : "health_check";

    const errorType = classifyError({
      status_code: typeof statusCode === "number" ? statusCode : undefined,
      error_text: typeof errorText === "string" ? errorText : "",
      details,
    });

    classifications.push({
      service_id: row.service_id as string,
      error_type: errorType,
      source,
      details: {
        check_type: checkType,
        status: row.status,
        original_error: errorText || undefined,
        status_code: statusCode || undefined,
      },
    });
  }

  return classifications;
}

// ─── Classify from Reports ───

export async function classifyFromReports(
  db: D1Database,
  since: string
): Promise<ErrorClassification[]> {
  const rows = await db
    .prepare(
      `SELECT service_id, error_message, created_at
       FROM reports
       WHERE success = 0 AND created_at > ?
       ORDER BY created_at DESC
       LIMIT 500`
    )
    .bind(since)
    .all();

  if (!rows.results || rows.results.length === 0) return [];

  return (rows.results as any[]).map((row) => ({
    service_id: row.service_id as string,
    error_type: classifyError({
      error_text: (row.error_message as string) ?? "",
    }),
    source: "user_report" as const,
    details: {
      error_message: row.error_message ?? null,
    },
  }));
}

// ─── Aggregate Error Distribution ───

export function aggregateErrors(
  classifications: ErrorClassification[]
): Record<string, { distribution: Record<string, number>; total: number; primary: ErrorType }> {
  const byService: Record<string, ErrorClassification[]> = {};

  for (const c of classifications) {
    if (!byService[c.service_id]) byService[c.service_id] = [];
    byService[c.service_id].push(c);
  }

  const result: Record<string, { distribution: Record<string, number>; total: number; primary: ErrorType }> = {};

  for (const [serviceId, items] of Object.entries(byService)) {
    const distribution: Record<string, number> = {};
    for (const item of items) {
      distribution[item.error_type] = (distribution[item.error_type] ?? 0) + 1;
    }

    let primary: ErrorType = "unknown";
    let maxCount = 0;
    for (const [type, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        primary = type as ErrorType;
      }
    }

    result[serviceId] = { distribution, total: items.length, primary };
  }

  return result;
}

// ─── Batch Execution ───

export async function runErrorClassification(
  db: D1Database
): Promise<{
  classified: number;
  by_type: Record<string, number>;
  services_affected: number;
}> {
  // Determine "since" — default last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Classify from both sources
  const [healthClassifications, reportClassifications] = await Promise.all([
    classifyFromHealthChecks(db, since),
    classifyFromReports(db, since),
  ]);

  const allClassifications = [...healthClassifications, ...reportClassifications];

  if (allClassifications.length === 0) {
    return { classified: 0, by_type: {}, services_affected: 0 };
  }

  // 2. Write to error_classifications table
  for (const c of allClassifications) {
    await db
      .prepare(
        `INSERT INTO error_classifications (service_id, error_type, source, details, occurred_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))`
      )
      .bind(c.service_id, c.error_type, c.source, JSON.stringify(c.details))
      .run();
  }

  // 3. Aggregate
  const aggregated = aggregateErrors(allClassifications);

  // 4. Update health_summary for each affected service
  for (const [serviceId, agg] of Object.entries(aggregated)) {
    // Count errors in last 30 days
    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt FROM error_classifications
         WHERE service_id = ? AND occurred_at > datetime('now', '-30 days')`
      )
      .bind(serviceId)
      .first<{ cnt: number }>();

    const errorCount30d = countRow?.cnt ?? agg.total;
    const distributionJson = JSON.stringify({
      ...agg.distribution,
      total: agg.total,
      classified_at: new Date().toISOString().slice(0, 10),
    });

    await db
      .prepare(
        `INSERT INTO health_summary (service_id, overall_status, error_distribution, primary_error_type, error_count_30d, updated_at)
         VALUES (?1, 'unknown', ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(service_id) DO UPDATE SET
           error_distribution = ?2,
           primary_error_type = ?3,
           error_count_30d = ?4,
           updated_at = datetime('now')`
      )
      .bind(serviceId, distributionJson, agg.primary, errorCount30d)
      .run();
  }

  // 5. Build stats
  const byType: Record<string, number> = {};
  for (const c of allClassifications) {
    byType[c.error_type] = (byType[c.error_type] ?? 0) + 1;
  }

  return {
    classified: allClassifications.length,
    by_type: byType,
    services_affected: Object.keys(aggregated).length,
  };
}

// ─── Cleanup ───

export async function cleanupOldErrors(
  db: D1Database,
  daysToKeep: number = 60
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM error_classifications WHERE occurred_at < datetime('now', '-' || ? || ' days')`
    )
    .bind(daysToKeep)
    .run();

  return result.meta?.changes ?? 0;
}
