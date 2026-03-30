import type { VersionChange } from "./types.js";

// ─── Semver Parsing ───

export function parseSemver(
  version: string
): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

// ─── Breaking Change Detection ───

export function detectBreakingChange(
  currentVersion: string,
  previousVersion: string | null
): { is_breaking: boolean; reasons: string[] } {
  if (!previousVersion) {
    return { is_breaking: false, reasons: [] };
  }

  const current = parseSemver(currentVersion);
  const previous = parseSemver(previousVersion);

  if (!current || !previous) {
    return { is_breaking: false, reasons: [] };
  }

  const reasons: string[] = [];

  // Major version bump → breaking
  if (current.major > previous.major) {
    reasons.push("major_version_bump");
  }

  // 0.x → different 0.y → breaking (0.x is unstable)
  if (
    previous.major === 0 &&
    current.major === 0 &&
    current.minor > previous.minor
  ) {
    reasons.push("0x_minor_bump");
  }

  return {
    is_breaking: reasons.length > 0,
    reasons,
  };
}

// ─── Change Type Detection ───

function detectChangeType(
  currentVersion: string,
  previousVersion: string | null
): Record<string, any> {
  if (!previousVersion) {
    return { type: "initial", version_jump: `→ ${currentVersion}` };
  }

  const current = parseSemver(currentVersion);
  const previous = parseSemver(previousVersion);

  if (!current || !previous) {
    return {
      type: "unknown",
      version_jump: `${previousVersion} → ${currentVersion}`,
    };
  }

  let type = "patch";
  if (current.major > previous.major) type = "major_update";
  else if (current.minor > previous.minor) type = "minor_update";

  return {
    type,
    version_jump: `${previousVersion} → ${currentVersion}`,
  };
}

// ─── npm Version Check ───

export async function checkNpmVersionChange(
  packageName: string,
  knownVersion: string | null
): Promise<VersionChange | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      {
        headers: { Accept: "application/vnd.npm.install-v1+json" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!resp.ok) return null;

    const data = (await resp.json()) as any;
    const latest = data["dist-tags"]?.latest;
    if (!latest) return null;

    // No change
    if (latest === knownVersion) return null;

    // Get publish time
    const publishedAt = data.time?.[latest] ?? null;

    // Check deprecated
    const breaking = detectBreakingChange(latest, knownVersion);
    const isDeprecated =
      typeof data.versions?.[latest]?.deprecated === "string";
    if (isDeprecated && !breaking.reasons.includes("deprecated_marker")) {
      breaking.reasons.push("deprecated_marker");
      breaking.is_breaking = true;
    }

    return {
      service_id: "", // filled by caller
      package_type: "npm",
      version: latest,
      previous_version: knownVersion,
      is_breaking: breaking.is_breaking,
      breaking_reasons: breaking.reasons,
      changes: detectChangeType(latest, knownVersion),
      published_at: publishedAt ?? null,
    };
  } catch {
    return null;
  }
}

// ─── PyPI Version Check ───

export async function checkPyPIVersionChange(
  packageName: string,
  knownVersion: string | null
): Promise<VersionChange | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(
      `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!resp.ok) return null;

    const data = (await resp.json()) as any;
    const latest = data.info?.version;
    if (!latest) return null;

    if (latest === knownVersion) return null;

    const breaking = detectBreakingChange(latest, knownVersion);

    // Check for inactive classifier
    const classifiers: string[] = data.info?.classifiers ?? [];
    const isInactive = classifiers.some((c: string) =>
      c.includes("Development Status :: 7 - Inactive")
    );
    if (isInactive && !breaking.reasons.includes("inactive_project")) {
      breaking.reasons.push("inactive_project");
      breaking.is_breaking = true;
    }

    return {
      service_id: "",
      package_type: "pypi",
      version: latest,
      previous_version: knownVersion,
      is_breaking: breaking.is_breaking,
      breaking_reasons: breaking.reasons,
      changes: detectChangeType(latest, knownVersion),
      published_at: null,
    };
  } catch {
    return null;
  }
}

// ─── Package Name Extraction ───

interface ServiceRow {
  id: string;
  install_command: string | null;
  install_runtime: string | null;
  source_url: string | null;
}

export function extractPackageInfo(
  row: ServiceRow
): { name: string; type: "npm" | "pypi" } | null {
  const cmd = row.install_command ?? "";
  const runtime = row.install_runtime ?? "";

  if (runtime === "node" || runtime === "") {
    // npx @scope/package or npx package (skip @smithery/cli)
    const npxMatch = cmd.match(
      /npx\s+(?:-y\s+)?(@[\w-]+\/[\w.-]+|[\w.-]+)/
    );
    if (npxMatch && npxMatch[1] !== "@smithery/cli") {
      return { name: npxMatch[1], type: "npm" };
    }

    // npm install package
    const npmMatch = cmd.match(
      /npm\s+(?:install|i)\s+(@[\w-]+\/[\w.-]+|[\w.-]+)/
    );
    if (npmMatch) return { name: npmMatch[1], type: "npm" };
  }

  if (runtime === "python") {
    const pipMatch = cmd.match(/pip\s+install\s+([\w.-]+)/);
    if (pipMatch) return { name: pipMatch[1], type: "pypi" };

    const uvxMatch = cmd.match(/uvx\s+([\w.-]+)/);
    if (uvxMatch) return { name: uvxMatch[1], type: "pypi" };
  }

  // source_url fallbacks
  if (row.source_url?.includes("npmjs.com/package/")) {
    const match = row.source_url.match(
      /npmjs\.com\/package\/((?:@[\w-]+\/)?[\w.-]+)/
    );
    if (match) return { name: match[1], type: "npm" };
  }

  if (row.source_url?.includes("pypi.org/project/")) {
    const match = row.source_url.match(
      /pypi\.org\/project\/(.+?)(?:$|\/|\?|#)/
    );
    if (match) return { name: match[1], type: "pypi" };
  }

  return null;
}

// ─── Batch Version Checks ───

export async function runVersionChecks(
  db: D1Database,
  batchSize: number = 50
): Promise<{
  checked: number;
  updated: number;
  breaking_changes: number;
}> {
  // Reset stale breaking flags (older than 7 days)
  await db
    .prepare(
      `UPDATE health_summary SET recent_breaking_change = 0
       WHERE last_version_change < datetime('now', '-7 days')
         AND recent_breaking_change = 1`
    )
    .run();

  // Get services with install_command, prioritize oldest checked
  const rows = await db
    .prepare(
      `SELECT s.id, s.install_command, s.install_runtime, s.source_url,
              h.current_version
       FROM services s
       LEFT JOIN health_summary h ON s.id = h.service_id
       WHERE s.install_command IS NOT NULL
       ORDER BY h.last_version_change ASC NULLS FIRST
       LIMIT ?`
    )
    .bind(batchSize)
    .all();

  if (!rows.results || rows.results.length === 0) {
    return { checked: 0, updated: 0, breaking_changes: 0 };
  }

  let checked = 0;
  let updated = 0;
  let breakingChanges = 0;

  // Process in batches of 10
  const items = rows.results as any[];
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(async (row: any) => {
        const pkg = extractPackageInfo(row);
        if (!pkg) return null;

        checked++;
        const knownVersion = row.current_version ?? null;

        if (pkg.type === "npm") {
          const change = await checkNpmVersionChange(pkg.name, knownVersion);
          return change ? { ...change, service_id: row.id } : null;
        } else {
          const change = await checkPyPIVersionChange(pkg.name, knownVersion);
          return change ? { ...change, service_id: row.id } : null;
        }
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;

      const change = result.value;
      updated++;
      if (change.is_breaking) breakingChanges++;

      // Insert into version_history (UPSERT)
      await db
        .prepare(
          `INSERT INTO version_history (service_id, package_type, version, previous_version, changes_detected, is_breaking_change, breaking_details, published_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
           ON CONFLICT(service_id, version) DO UPDATE SET
             changes_detected = ?5,
             is_breaking_change = ?6,
             breaking_details = ?7,
             detected_at = datetime('now')`
        )
        .bind(
          change.service_id,
          change.package_type,
          change.version,
          change.previous_version,
          JSON.stringify(change.changes),
          change.is_breaking ? 1 : 0,
          change.breaking_reasons.length > 0
            ? JSON.stringify({
                reasons: change.breaking_reasons,
                description: buildBreakingDescription(change),
              })
            : null,
          change.published_at
        )
        .run();

      // Update health_summary
      await db
        .prepare(
          `INSERT INTO health_summary (service_id, overall_status, current_version, last_version_change, recent_breaking_change)
           VALUES (?1, 'unknown', ?2, datetime('now'), ?3)
           ON CONFLICT(service_id) DO UPDATE SET
             current_version = ?2,
             last_version_change = datetime('now'),
             recent_breaking_change = ?3,
             updated_at = datetime('now')`
        )
        .bind(
          change.service_id,
          change.version,
          change.is_breaking ? 1 : 0
        )
        .run();
    }
  }

  return { checked, updated, breaking_changes: breakingChanges };
}

function buildBreakingDescription(change: VersionChange): string {
  const parts: string[] = [];
  for (const reason of change.breaking_reasons) {
    switch (reason) {
      case "major_version_bump":
        parts.push(
          `Major version update from ${change.previous_version} to ${change.version}`
        );
        break;
      case "0x_minor_bump":
        parts.push(
          `Pre-1.0 minor bump (${change.previous_version} → ${change.version}), may contain breaking changes`
        );
        break;
      case "deprecated_marker":
        parts.push("Package marked as deprecated");
        break;
      case "inactive_project":
        parts.push("Project marked as inactive");
        break;
      default:
        parts.push(reason);
    }
  }
  return parts.join(". ");
}

// ─── Query Functions ───

export async function getVersionHistory(
  db: D1Database,
  serviceId: string,
  limit: number = 10
): Promise<
  Array<{
    version: string;
    previous_version: string | null;
    is_breaking_change: boolean;
    breaking_details: Record<string, any> | null;
    changes_detected: Record<string, any> | null;
    published_at: string | null;
    detected_at: string;
  }>
> {
  const rows = await db
    .prepare(
      `SELECT version, previous_version, is_breaking_change, breaking_details, changes_detected, published_at, detected_at
       FROM version_history
       WHERE service_id = ?
       ORDER BY detected_at DESC
       LIMIT ?`
    )
    .bind(serviceId, limit)
    .all();

  return (rows.results ?? []).map((row: any) => ({
    version: row.version,
    previous_version: row.previous_version ?? null,
    is_breaking_change: row.is_breaking_change === 1,
    breaking_details: safeParseJson(row.breaking_details),
    changes_detected: safeParseJson(row.changes_detected),
    published_at: row.published_at ?? null,
    detected_at: row.detected_at,
  }));
}

export async function getRecentBreakingChanges(
  db: D1Database,
  days: number = 7
): Promise<
  Array<{
    service_id: string;
    service_name: string;
    version: string;
    previous_version: string;
    breaking_details: Record<string, any>;
    detected_at: string;
  }>
> {
  const rows = await db
    .prepare(
      `SELECT v.service_id, s.name AS service_name, v.version, v.previous_version, v.breaking_details, v.detected_at
       FROM version_history v
       JOIN services s ON v.service_id = s.id
       WHERE v.is_breaking_change = 1
         AND v.detected_at > datetime('now', '-' || ? || ' days')
       ORDER BY v.detected_at DESC`
    )
    .bind(days)
    .all();

  return (rows.results ?? []).map((row: any) => ({
    service_id: row.service_id,
    service_name: row.service_name,
    version: row.version,
    previous_version: row.previous_version ?? "",
    breaking_details: safeParseJson(row.breaking_details) ?? {},
    detected_at: row.detected_at,
  }));
}

function safeParseJson(value: string | null): Record<string, any> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
