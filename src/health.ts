import type { Service, HealthCheckResult } from "./types.js";
import {
  insertHealthCheck,
  upsertHealthSummary,
  updateServiceReliability,
  cleanupOldHealthChecks,
} from "./db.js";

const TIMEOUT_MS = 5000;

// ─── Individual Check Functions ───

export async function checkGitHub(
  serviceId: string,
  repoUrl: string,
  githubToken?: string
): Promise<HealthCheckResult> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!match) {
    return {
      service_id: serviceId,
      check_type: "github",
      status: "error",
      response_time_ms: 0,
      details: { error: "Could not parse GitHub URL" },
    };
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}`;

  const headers: Record<string, string> = {
    "User-Agent": "disvr-healthcheck/1.0",
    Accept: "application/vnd.github.v3+json",
  };
  if (githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - start;

    if (response.status === 404) {
      return {
        service_id: serviceId,
        check_type: "github",
        status: "dead",
        response_time_ms: elapsed,
        details: { status_code: 404 },
      };
    }

    if (!response.ok) {
      return {
        service_id: serviceId,
        check_type: "github",
        status: "error",
        response_time_ms: elapsed,
        details: { status_code: response.status },
      };
    }

    const data = (await response.json()) as Record<string, any>;
    const archived = data.archived === true;

    return {
      service_id: serviceId,
      check_type: "github",
      status: archived ? "stale" : "alive",
      response_time_ms: elapsed,
      details: {
        stars: data.stargazers_count,
        last_push: data.pushed_at,
        archived,
      },
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    if (err?.name === "AbortError") {
      return {
        service_id: serviceId,
        check_type: "github",
        status: "timeout",
        response_time_ms: elapsed,
        details: { error: "Request timed out" },
      };
    }
    return {
      service_id: serviceId,
      check_type: "github",
      status: "error",
      response_time_ms: elapsed,
      details: { error: String(err) },
    };
  }
}

export async function checkNpm(
  serviceId: string,
  packageName: string
): Promise<HealthCheckResult> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "disvr-healthcheck/1.0" },
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - start;

    if (response.status === 404) {
      return {
        service_id: serviceId,
        check_type: "npm",
        status: "dead",
        response_time_ms: elapsed,
        details: { status_code: 404 },
      };
    }

    if (!response.ok) {
      return {
        service_id: serviceId,
        check_type: "npm",
        status: "error",
        response_time_ms: elapsed,
        details: { status_code: response.status },
      };
    }

    const data = (await response.json()) as Record<string, any>;
    const lastModified = data.time?.modified;
    const latestVersion = data["dist-tags"]?.latest;

    let status: HealthCheckResult["status"] = "alive";
    if (lastModified) {
      const daysSince =
        (Date.now() - new Date(lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 180) {
        status = "stale";
      }
    }

    return {
      service_id: serviceId,
      check_type: "npm",
      status,
      response_time_ms: elapsed,
      details: {
        latest_version: latestVersion,
        last_modified: lastModified,
      },
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    if (err?.name === "AbortError") {
      return {
        service_id: serviceId,
        check_type: "npm",
        status: "timeout",
        response_time_ms: elapsed,
        details: { error: "Request timed out" },
      };
    }
    return {
      service_id: serviceId,
      check_type: "npm",
      status: "error",
      response_time_ms: elapsed,
      details: { error: String(err) },
    };
  }
}

export async function checkPyPI(
  serviceId: string,
  packageName: string
): Promise<HealthCheckResult> {
  const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "disvr-healthcheck/1.0" },
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - start;

    if (response.status === 404) {
      return {
        service_id: serviceId,
        check_type: "pypi",
        status: "dead",
        response_time_ms: elapsed,
        details: { status_code: 404 },
      };
    }

    if (!response.ok) {
      return {
        service_id: serviceId,
        check_type: "pypi",
        status: "error",
        response_time_ms: elapsed,
        details: { status_code: response.status },
      };
    }

    const data = (await response.json()) as Record<string, any>;
    const info = data.info ?? {};
    const latestVersion = info.version;

    // Find last upload date from releases
    const releases = data.releases ?? {};
    let lastUpload: string | undefined;
    const versionFiles = releases[latestVersion];
    if (Array.isArray(versionFiles) && versionFiles.length > 0) {
      lastUpload = versionFiles[0].upload_time_iso_8601 ?? versionFiles[0].upload_time;
    }

    let status: HealthCheckResult["status"] = "alive";
    if (lastUpload) {
      const daysSince =
        (Date.now() - new Date(lastUpload).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 180) {
        status = "stale";
      }
    }

    return {
      service_id: serviceId,
      check_type: "pypi",
      status,
      response_time_ms: elapsed,
      details: {
        latest_version: latestVersion,
        last_upload: lastUpload,
      },
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    if (err?.name === "AbortError") {
      return {
        service_id: serviceId,
        check_type: "pypi",
        status: "timeout",
        response_time_ms: elapsed,
        details: { error: "Request timed out" },
      };
    }
    return {
      service_id: serviceId,
      check_type: "pypi",
      status: "error",
      response_time_ms: elapsed,
      details: { error: String(err) },
    };
  }
}

export async function checkEndpoint(
  serviceId: string,
  url: string
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "disvr-healthcheck/1.0" },
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - start;
    const code = response.status;

    let status: HealthCheckResult["status"];
    if (code >= 200 && code < 400) {
      status = "alive";
    } else if (code >= 400 && code < 500) {
      status = "dead";
    } else {
      status = "error";
    }

    return {
      service_id: serviceId,
      check_type: "endpoint",
      status,
      response_time_ms: elapsed,
      details: { status_code: code },
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    if (err?.name === "AbortError") {
      return {
        service_id: serviceId,
        check_type: "endpoint",
        status: "timeout",
        response_time_ms: elapsed,
        details: { error: "Request timed out" },
      };
    }
    return {
      service_id: serviceId,
      check_type: "endpoint",
      status: "error",
      response_time_ms: elapsed,
      details: { error: String(err) },
    };
  }
}

// ─── Service-Level Check Orchestration ───

export async function checkService(
  service: Service,
  githubToken?: string
): Promise<HealthCheckResult[]> {
  const checks: Promise<HealthCheckResult>[] = [];

  // GitHub check
  if (service.source_url?.includes("github.com")) {
    checks.push(checkGitHub(service.id, service.source_url, githubToken));
  }

  // npm check — look for npm-like package name patterns
  const npmName = extractNpmPackageName(service);
  if (npmName) {
    checks.push(checkNpm(service.id, npmName));
  }

  // PyPI check
  const pypiName = extractPyPIPackageName(service);
  if (pypiName) {
    checks.push(checkPyPI(service.id, pypiName));
  }

  // Endpoint check — use protocols or source_url that isn't GitHub
  const endpoint = extractEndpointUrl(service);
  if (endpoint) {
    checks.push(checkEndpoint(service.id, endpoint));
  }

  const results = await Promise.allSettled(checks);
  return results
    .filter(
      (r): r is PromiseFulfilledResult<HealthCheckResult> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}

function extractNpmPackageName(service: Service): string | null {
  // Check install command for npx/npm patterns
  if (service.install?.runtime === "node" && service.install.command) {
    const cmd = service.install.command;
    // npx @scope/package or npx package
    const npxMatch = cmd.match(/npx\s+(@[\w-]+\/[\w.-]+|[\w.-]+)/);
    if (npxMatch) return npxMatch[1];
    // npm install package
    const npmMatch = cmd.match(/npm\s+(?:install|i)\s+(@[\w-]+\/[\w.-]+|[\w.-]+)/);
    if (npmMatch) return npmMatch[1];
  }

  // Check source_url for npmjs.com links
  if (service.source_url?.includes("npmjs.com/package/")) {
    const match = service.source_url.match(/npmjs\.com\/package\/(.+?)(?:$|\/|\?|#)/);
    if (match) return match[1];
  }

  return null;
}

function extractPyPIPackageName(service: Service): string | null {
  if (service.install?.runtime === "python" && service.install.command) {
    const cmd = service.install.command;
    const pipMatch = cmd.match(/pip\s+install\s+([\w.-]+)/);
    if (pipMatch) return pipMatch[1];
    const uvxMatch = cmd.match(/uvx\s+([\w.-]+)/);
    if (uvxMatch) return uvxMatch[1];
  }

  if (service.source_url?.includes("pypi.org/project/")) {
    const match = service.source_url.match(/pypi\.org\/project\/(.+?)(?:$|\/|\?|#)/);
    if (match) return match[1];
  }

  return null;
}

function extractEndpointUrl(service: Service): string | null {
  // Check protocols for HTTP endpoints
  for (const [protocol, url] of Object.entries(service.protocols)) {
    if (
      (protocol === "rest" || protocol === "http" || protocol === "https") &&
      url.startsWith("http")
    ) {
      return url;
    }
  }
  return null;
}

// ─── Aggregation & Scoring ───

export function computeOverallStatus(
  results: HealthCheckResult[],
  lastUpdated?: string | null
): { overall_status: "healthy" | "degraded" | "dead" | "unknown"; reliability: number } {
  if (results.length === 0) {
    return { overall_status: "unknown", reliability: -1 }; // -1 = don't update
  }

  // If GitHub is dead → overall dead
  const githubResult = results.find((r) => r.check_type === "github");
  if (githubResult?.status === "dead") {
    return { overall_status: "dead", reliability: 0.1 };
  }

  const allAlive = results.every((r) => r.status === "alive");
  const allErrorOrTimeout = results.every(
    (r) => r.status === "error" || r.status === "timeout"
  );
  const hasStaleOrTimeout = results.some(
    (r) => r.status === "stale" || r.status === "timeout"
  );
  const allDead = results.every((r) => r.status === "dead");

  if (allDead) {
    return { overall_status: "dead", reliability: 0.1 };
  }

  if (allErrorOrTimeout) {
    return { overall_status: "degraded", reliability: 0.3 };
  }

  if (allAlive) {
    // Check freshness based on lastUpdated
    if (lastUpdated) {
      const daysSince =
        (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) {
        return { overall_status: "healthy", reliability: 1.0 };
      }
      if (daysSince <= 90) {
        return { overall_status: "healthy", reliability: 0.8 };
      }
      if (daysSince <= 180) {
        return { overall_status: "degraded", reliability: 0.6 };
      }
      return { overall_status: "degraded", reliability: 0.5 };
    }
    // No lastUpdated info — assume healthy
    return { overall_status: "healthy", reliability: 0.8 };
  }

  if (hasStaleOrTimeout) {
    return { overall_status: "degraded", reliability: 0.5 };
  }

  // Mixed results
  return { overall_status: "degraded", reliability: 0.5 };
}

export function computeUptime30d(
  recentChecks: Array<{ status: string }>
): number {
  if (recentChecks.length === 0) return 0;
  const aliveCount = recentChecks.filter((c) => c.status === "alive").length;
  return aliveCount / recentChecks.length;
}

// ─── Batch Execution Entry Point ───

export async function runHealthChecks(
  db: D1Database,
  batchSize: number = 50,
  githubToken?: string
): Promise<{ checked: number; healthy: number; degraded: number; dead: number }> {
  // 1. Find services most in need of checking
  const rows = await db
    .prepare(
      `SELECT s.* FROM services s
       LEFT JOIN health_summary h ON s.id = h.service_id
       ORDER BY h.last_check_at ASC NULLS FIRST
       LIMIT ?`
    )
    .bind(batchSize)
    .all();

  if (!rows.results || rows.results.length === 0) {
    return { checked: 0, healthy: 0, degraded: 0, dead: 0 };
  }

  const stats = { checked: 0, healthy: 0, degraded: 0, dead: 0 };

  // 2. Process in sub-batches of 10
  const services = rows.results as any[];
  for (let i = 0; i < services.length; i += 10) {
    const batch = services.slice(i, i + 10);

    const batchResults = await Promise.allSettled(
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
          install: row.install_command
            ? {
                command: row.install_command,
                runtime: row.install_runtime ?? "node",
                min_version: row.runtime_version,
              }
            : null,
        };

        const results = await checkService(service, githubToken);
        return { service, results };
      })
    );

    for (const settled of batchResults) {
      if (settled.status !== "fulfilled") continue;
      const { service, results } = settled.value;

      // 3. Write each check result to health_checks
      for (const result of results) {
        await insertHealthCheck(db, result);
      }

      // 4. Determine last_updated from details
      let lastUpdated: string | null = null;
      for (const r of results) {
        const pushed = r.details.last_push ?? r.details.last_modified ?? r.details.last_upload;
        if (pushed && (!lastUpdated || pushed > lastUpdated)) {
          lastUpdated = pushed;
        }
      }

      // 5. Get recent checks for uptime calculation
      const recentRows = await db
        .prepare(
          `SELECT status FROM health_checks
           WHERE service_id = ? AND checked_at > datetime('now', '-30 days')`
        )
        .bind(service.id)
        .all();
      const uptime30d = computeUptime30d(
        (recentRows.results ?? []) as Array<{ status: string }>
      );

      // 6. Compute overall status
      const { overall_status, reliability } = computeOverallStatus(
        results,
        lastUpdated
      );

      // Compute avg response time
      const responseTimes = results
        .filter((r) => r.response_time_ms > 0)
        .map((r) => r.response_time_ms);
      const avgResponseMs =
        responseTimes.length > 0
          ? Math.round(
              responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            )
          : undefined;

      // 7. Upsert health_summary
      const githubStatus = results.find((r) => r.check_type === "github")?.status;
      const packageStatus =
        results.find((r) => r.check_type === "npm")?.status ??
        results.find((r) => r.check_type === "pypi")?.status;
      const endpointStatus = results.find(
        (r) => r.check_type === "endpoint"
      )?.status;

      await upsertHealthSummary(db, service.id, {
        overall_status,
        github_status: githubStatus,
        package_status: packageStatus,
        endpoint_status: endpointStatus,
        last_updated: lastUpdated ?? undefined,
        uptime_30d,
        avg_response_ms: avgResponseMs,
      });

      // 8. Update services.reliability (only when we have a definitive result)
      if (reliability >= 0) {
        await updateServiceReliability(db, service.id, reliability);
      }

      stats.checked++;
      if (overall_status === "healthy") stats.healthy++;
      else if (overall_status === "degraded") stats.degraded++;
      else if (overall_status === "dead") stats.dead++;
    }
  }

  return stats;
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
