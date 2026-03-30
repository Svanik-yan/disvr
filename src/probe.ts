import type { Service } from "./types.js";

// ─── Types ───

export interface ProbeResult {
  service_id: string;
  probe_type: "mcp_handshake" | "api_probe";
  success: boolean;
  response_time_ms: number;
  details: Record<string, any>;
}

// ─── MCP Server Handshake ───

export async function probeMcpServer(
  serviceId: string,
  endpoint: string
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "disvr-probe", version: "1.0" },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const responseTimeMs = Date.now() - start;
    const status = response.status;

    let body: any = null;
    try {
      body = await response.json();
    } catch {
      // non-JSON response
    }

    const hasCapabilities = body?.result?.capabilities !== undefined;
    const serverName = body?.result?.serverInfo?.name ?? null;

    return {
      service_id: serviceId,
      probe_type: "mcp_handshake",
      success: status === 200 && hasCapabilities,
      response_time_ms: responseTimeMs,
      details: {
        response_status: status,
        has_capabilities: hasCapabilities,
        server_name: serverName,
        error: status !== 200 ? `HTTP ${status}` : (!hasCapabilities ? "No capabilities in response" : null),
      },
    };
  } catch (err: any) {
    return {
      service_id: serviceId,
      probe_type: "mcp_handshake",
      success: false,
      response_time_ms: Date.now() - start,
      details: {
        error: err?.name === "TimeoutError" ? "timeout" : (err?.message ?? "unknown error"),
      },
    };
  }
}

// ─── HTTP API Probe ───

const HEALTH_PATHS = ["/health", "/api/health", "/status", "/"];

export async function probeHttpApi(
  serviceId: string,
  baseUrl: string
): Promise<ProbeResult> {
  const start = Date.now();
  let lastError = "";

  for (const path of HEALTH_PATHS) {
    try {
      const url = baseUrl.replace(/\/+$/, "") + path;
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });

      const responseTimeMs = Date.now() - start;

      if (response.status >= 200 && response.status < 400) {
        return {
          service_id: serviceId,
          probe_type: "api_probe",
          success: true,
          response_time_ms: responseTimeMs,
          details: {
            probed_path: path,
            response_status: response.status,
            content_type: response.headers.get("content-type") ?? null,
          },
        };
      }

      lastError = `HTTP ${response.status} at ${path}`;
    } catch (err: any) {
      lastError = err?.name === "TimeoutError" ? `timeout at ${path}` : (err?.message ?? "unknown error");
    }
  }

  return {
    service_id: serviceId,
    probe_type: "api_probe",
    success: false,
    response_time_ms: Date.now() - start,
    details: { error: lastError },
  };
}

// ─── Service-Level Probe Orchestration ───

export function extractProbeEndpoint(service: Service): { type: "mcp" | "http"; url: string } | null {
  const protocols = service.protocols ?? {};

  // Check for MCP endpoint via Smithery proxy
  const mcpUrl = protocols.mcp ?? protocols.MCP ?? null;
  if (mcpUrl) {
    // mcp://smithery/slug → https://server.smithery.ai/slug/mcp
    if (typeof mcpUrl === "string" && mcpUrl.startsWith("mcp://smithery/")) {
      const slug = mcpUrl.replace("mcp://smithery/", "");
      return { type: "mcp", url: `https://server.smithery.ai/${slug}/mcp` };
    }
    // Direct https MCP endpoint
    if (typeof mcpUrl === "string" && mcpUrl.startsWith("https://") && !mcpUrl.includes("github.com")) {
      return { type: "mcp", url: mcpUrl };
    }
  }

  // Check for REST/HTTP endpoint
  const restUrl = protocols.rest ?? protocols.REST ?? protocols.http ?? null;
  if (typeof restUrl === "string" && restUrl.startsWith("https://")) {
    return { type: "http", url: restUrl };
  }

  // Check source_url for non-GitHub HTTP endpoints
  if (service.source_url && service.source_url.startsWith("https://") && !service.source_url.includes("github.com")) {
    return { type: "http", url: service.source_url };
  }

  return null;
}

export async function probeService(service: Service): Promise<ProbeResult | null> {
  const endpoint = extractProbeEndpoint(service);
  if (!endpoint) return null;

  if (endpoint.type === "mcp") {
    return probeMcpServer(service.id, endpoint.url);
  }
  return probeHttpApi(service.id, endpoint.url);
}

// ─── Success Rate Calculation ───

export function calculateSuccessRate(
  recentProbes: Array<{ success: boolean }>
): number | null {
  if (recentProbes.length === 0) return null;
  const successes = recentProbes.filter((p) => p.success).length;
  return Math.round((successes / recentProbes.length) * 100) / 100;
}

// ─── Batch Execution ───

export async function runLiveProbes(
  db: D1Database,
  batchSize: number = 20
): Promise<{ probed: number; successful: number; failed: number; skipped: number }> {
  // 1. Get services that need probing (exclude probe_type='none', unless stale >7d)
  const rows = await db
    .prepare(
      `SELECT s.*, h.probe_type, h.updated_at as h_updated_at
       FROM services s
       LEFT JOIN health_summary h ON s.id = h.service_id
       WHERE h.probe_type IS NULL
          OR (h.probe_type != 'none')
          OR (h.probe_type = 'none' AND h.updated_at < datetime('now', '-7 days'))
       ORDER BY h.last_check_at ASC NULLS FIRST
       LIMIT ?`
    )
    .bind(batchSize)
    .all();

  if (!rows.results || rows.results.length === 0) {
    return { probed: 0, successful: 0, failed: 0, skipped: 0 };
  }

  const stats = { probed: 0, successful: 0, failed: 0, skipped: 0 };
  const services = rows.results as any[];

  // 2. Process in sub-batches of 5
  for (let i = 0; i < services.length; i += 5) {
    const batch = services.slice(i, i + 5);

    const results = await Promise.allSettled(
      batch.map(async (row: any) => {
        const service: Service = {
          id: row.id,
          name: row.name,
          description: row.description,
          capabilities: [],
          platform: row.platform,
          protocols: safeParseJson(row.protocols, {}),
          pricing: safeParseJson(row.pricing, { model: "free", price_usd: 0 }),
          reputation_score: row.reputation_score,
          success_rate: row.success_rate,
          uptime_30d: row.uptime_30d,
          latency_p95_ms: row.latency_p95_ms,
          total_calls: row.total_calls ?? 0,
          successful_calls: row.successful_calls ?? 0,
          failed_calls: row.failed_calls ?? 0,
          retry_rate: row.retry_rate,
          avg_cost_per_success: row.avg_cost_per_success,
          doc_completeness: row.doc_completeness,
          verified: row.verified === 1,
          source_url: row.source_url,
        };

        const result = await probeService(service);
        return { serviceId: service.id, result };
      })
    );

    for (const settled of results) {
      if (settled.status !== "fulfilled") continue;
      const { serviceId, result } = settled.value;

      if (result === null) {
        // Not probeable — mark as 'none'
        await db
          .prepare(
            `INSERT INTO health_summary (service_id, overall_status, probe_type, updated_at)
             VALUES (?1, 'unknown', 'none', datetime('now'))
             ON CONFLICT(service_id) DO UPDATE SET
               probe_type = 'none',
               updated_at = datetime('now')`
          )
          .bind(serviceId)
          .run();
        stats.skipped++;
        continue;
      }

      // 3. Write probe result to health_checks
      await db
        .prepare(
          `INSERT INTO health_checks (service_id, check_type, status, response_time_ms, details, checked_at)
           VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))`
        )
        .bind(
          serviceId,
          result.probe_type,
          result.success ? "alive" : "dead",
          result.response_time_ms,
          JSON.stringify(result.details)
        )
        .run();

      // 4. Calculate success rate from recent probes
      const recentRows = await db
        .prepare(
          `SELECT status FROM health_checks
           WHERE service_id = ?1
             AND check_type IN ('mcp_handshake', 'api_probe')
           ORDER BY checked_at DESC
           LIMIT 10`
        )
        .bind(serviceId)
        .all();

      const recentProbes = (recentRows.results ?? []).map((r) => ({
        success: (r.status as string) === "alive",
      }));
      const successRate = calculateSuccessRate(recentProbes);

      const probeTypeLabel = result.probe_type === "mcp_handshake" ? "mcp" : "http";

      // 5. Update health_summary
      await db
        .prepare(
          `INSERT INTO health_summary (service_id, overall_status, call_success_rate, probe_type, last_probe_details, updated_at)
           VALUES (?1, 'unknown', ?2, ?3, ?4, datetime('now'))
           ON CONFLICT(service_id) DO UPDATE SET
             call_success_rate = ?2,
             probe_type = ?3,
             last_probe_details = ?4,
             updated_at = datetime('now')`
        )
        .bind(
          serviceId,
          successRate,
          probeTypeLabel,
          JSON.stringify(result.details)
        )
        .run();

      stats.probed++;
      if (result.success) {
        stats.successful++;
      } else {
        stats.failed++;
      }
    }
  }

  return stats;
}

// ─── Helpers ───

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
