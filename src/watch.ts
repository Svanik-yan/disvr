// ─── Tool Watch & Alerts ───
// Pull-based alert system: agents subscribe to tools, poll for alerts.
// No webhook push — most agents can't expose endpoints.

export interface WatchAlert {
  id: number;
  service_id: string;
  service_name?: string;
  alert_type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  details: Record<string, any> | null;
  created_at: string;
}

export interface AlertSummary {
  total_watches: number;
  unread_alerts: number;
  critical: number;
  warning: number;
  info: number;
  tools_at_risk: number;
}

const MAX_WATCHES_PER_AGENT = 50;

// Alert type → severity mapping
const ALERT_SEVERITY: Record<string, "critical" | "warning" | "info"> = {
  health_dead: "critical",
  deprecated: "critical",
  health_degraded: "warning",
  breaking_change: "warning",
  install_broken: "warning",
  health_recovered: "info",
};

// ===== Subscription Management =====

export async function addWatch(
  db: D1Database,
  apiKeyHash: string,
  serviceId: string
): Promise<{ success: boolean; error?: string }> {
  // Check current count
  const countRow = await db
    .prepare("SELECT COUNT(*) as cnt FROM tool_watches WHERE api_key_hash = ?1")
    .bind(apiKeyHash)
    .first<{ cnt: number }>();

  if ((countRow?.cnt ?? 0) >= MAX_WATCHES_PER_AGENT) {
    return { success: false, error: `Watch limit reached (max ${MAX_WATCHES_PER_AGENT})` };
  }

  await db
    .prepare("INSERT OR IGNORE INTO tool_watches (api_key_hash, service_id) VALUES (?1, ?2)")
    .bind(apiKeyHash, serviceId)
    .run();

  return { success: true };
}

export async function removeWatch(
  db: D1Database,
  apiKeyHash: string,
  serviceId: string
): Promise<void> {
  await db
    .prepare("DELETE FROM tool_watches WHERE api_key_hash = ?1 AND service_id = ?2")
    .bind(apiKeyHash, serviceId)
    .run();
}

export async function getWatchList(
  db: D1Database,
  apiKeyHash: string
): Promise<Array<{ service_id: string; service_name: string; health_status: string; created_at: string }>> {
  const rows = await db
    .prepare(
      `SELECT tw.service_id, s.name as service_name, COALESCE(h.overall_status, 'unknown') as health_status, tw.created_at
       FROM tool_watches tw
       JOIN services s ON tw.service_id = s.id
       LEFT JOIN health_summary h ON tw.service_id = h.service_id
       WHERE tw.api_key_hash = ?1
       ORDER BY tw.created_at DESC`
    )
    .bind(apiKeyHash)
    .all();

  return (rows.results ?? []).map((r) => ({
    service_id: r.service_id as string,
    service_name: r.service_name as string,
    health_status: r.health_status as string,
    created_at: r.created_at as string,
  }));
}

// ===== Alert Generation (cron-triggered) =====

export async function generateAlerts(
  db: D1Database
): Promise<{ alerts_created: number }> {
  let alertsCreated = 0;

  // Get all watched service IDs
  const watchedRows = await db
    .prepare("SELECT DISTINCT service_id FROM tool_watches")
    .all();
  const watchedIds = (watchedRows.results ?? []).map((r) => r.service_id as string);

  if (watchedIds.length === 0) {
    return { alerts_created: 0 };
  }

  // Batch fetch health summaries for watched services
  const placeholders = watchedIds.map((_, i) => `?${i + 1}`).join(",");
  const healthRows = await db
    .prepare(
      `SELECT service_id, overall_status, primary_error_type, install_difficulty, recent_breaking_change,
              current_version, last_version_change
       FROM health_summary
       WHERE service_id IN (${placeholders})`
    )
    .bind(...watchedIds)
    .all();

  const healthMap = new Map<string, Record<string, any>>();
  for (const row of healthRows.results ?? []) {
    healthMap.set(row.service_id as string, row);
  }

  // Get service names for alert titles
  const nameRows = await db
    .prepare(`SELECT id, name FROM services WHERE id IN (${placeholders})`)
    .bind(...watchedIds)
    .all();
  const nameMap = new Map<string, string>();
  for (const row of nameRows.results ?? []) {
    nameMap.set(row.id as string, row.name as string);
  }

  for (const serviceId of watchedIds) {
    const health = healthMap.get(serviceId);
    const name = nameMap.get(serviceId) ?? serviceId;

    if (!health) continue;

    const status = health.overall_status as string;

    // 1. Health status changes
    await checkHealthChange(db, serviceId, name, status).then((n) => { alertsCreated += n; });

    // 2. Breaking change
    if (health.recent_breaking_change) {
      const exists = await hasRecentAlert(db, serviceId, "breaking_change", 7);
      if (!exists) {
        const version = health.current_version as string | null;
        const title = version
          ? `${name} detected breaking change (→ ${version})`
          : `${name} detected breaking change`;
        await insertAlert(db, serviceId, "breaking_change", "warning", title, {
          current_version: version,
        });
        alertsCreated++;
      }
    }

    // 3. Deprecated
    if (health.primary_error_type === "deprecated") {
      const exists = await hasRecentAlert(db, serviceId, "deprecated", 30);
      if (!exists) {
        await insertAlert(db, serviceId, "deprecated", "critical", `${name} has been deprecated`, null);
        alertsCreated++;
      }
    }

    // 4. Install broken
    if (health.install_difficulty === "broken") {
      const exists = await hasRecentAlert(db, serviceId, "install_broken", 30);
      if (!exists) {
        await insertAlert(db, serviceId, "install_broken", "warning", `${name} installation is broken`, null);
        alertsCreated++;
      }
    }
  }

  return { alerts_created: alertsCreated };
}

async function checkHealthChange(
  db: D1Database,
  serviceId: string,
  name: string,
  currentStatus: string
): Promise<number> {
  // Find the most recent health-related alert for this service
  const lastAlert = await db
    .prepare(
      `SELECT alert_type FROM watch_alerts
       WHERE service_id = ?1 AND alert_type IN ('health_degraded', 'health_dead', 'health_recovered')
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(serviceId)
    .first<{ alert_type: string }>();

  // Derive previous status from last alert
  let previousStatus: string | null = null;
  if (lastAlert) {
    if (lastAlert.alert_type === "health_degraded") previousStatus = "degraded";
    else if (lastAlert.alert_type === "health_dead") previousStatus = "dead";
    else if (lastAlert.alert_type === "health_recovered") previousStatus = "healthy";
  }

  // No history — only alert if currently unhealthy
  if (previousStatus === null) {
    if (currentStatus === "degraded") {
      // Deduplicate within 24h
      const exists = await hasRecentAlert(db, serviceId, "health_degraded", 1);
      if (exists) return 0;
      await insertAlert(db, serviceId, "health_degraded", "warning", `${name} is degraded`, null);
      return 1;
    }
    if (currentStatus === "dead") {
      const exists = await hasRecentAlert(db, serviceId, "health_dead", 1);
      if (exists) return 0;
      await insertAlert(db, serviceId, "health_dead", "critical", `${name} is dead`, null);
      return 1;
    }
    return 0;
  }

  // Status unchanged → no alert
  if (previousStatus === currentStatus) return 0;

  // Deduplicate within 24h
  if (currentStatus === "degraded") {
    const exists = await hasRecentAlert(db, serviceId, "health_degraded", 1);
    if (exists) return 0;
    await insertAlert(db, serviceId, "health_degraded", "warning", `${name} is now degraded`, null);
    return 1;
  }
  if (currentStatus === "dead") {
    const exists = await hasRecentAlert(db, serviceId, "health_dead", 1);
    if (exists) return 0;
    await insertAlert(db, serviceId, "health_dead", "critical", `${name} is now dead`, null);
    return 1;
  }
  if (currentStatus === "healthy" && (previousStatus === "degraded" || previousStatus === "dead")) {
    const exists = await hasRecentAlert(db, serviceId, "health_recovered", 1);
    if (exists) return 0;
    await insertAlert(db, serviceId, "health_recovered", "info", `${name} has recovered to healthy`, null);
    return 1;
  }

  return 0;
}

async function hasRecentAlert(
  db: D1Database,
  serviceId: string,
  alertType: string,
  days: number
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM watch_alerts
       WHERE service_id = ?1 AND alert_type = ?2 AND created_at > datetime('now', ?3)
       LIMIT 1`
    )
    .bind(serviceId, alertType, `-${days} days`)
    .first();
  return row !== null;
}

async function insertAlert(
  db: D1Database,
  serviceId: string,
  alertType: string,
  severity: "critical" | "warning" | "info",
  title: string,
  details: Record<string, any> | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO watch_alerts (service_id, alert_type, severity, title, details)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
    .bind(serviceId, alertType, severity, title, details ? JSON.stringify(details) : null)
    .run();
}

// ===== Get Alerts for Agent =====

export async function getAlerts(
  db: D1Database,
  apiKeyHash: string,
  options?: {
    since?: string;
    severity?: string;
    limit?: number;
  }
): Promise<WatchAlert[]> {
  const limit = Math.min(options?.limit ?? 50, 200);

  let sql = `SELECT wa.id, wa.service_id, s.name as service_name, wa.alert_type, wa.severity, wa.title, wa.details, wa.created_at
     FROM watch_alerts wa
     JOIN tool_watches tw ON wa.service_id = tw.service_id AND tw.api_key_hash = ?1
     JOIN services s ON wa.service_id = s.id
     WHERE 1=1`;

  const binds: any[] = [apiKeyHash];
  let paramIdx = 2;

  if (options?.since) {
    sql += ` AND wa.created_at > ?${paramIdx}`;
    binds.push(options.since);
    paramIdx++;
  }

  if (options?.severity) {
    sql += ` AND wa.severity = ?${paramIdx}`;
    binds.push(options.severity);
    paramIdx++;
  }

  sql += ` ORDER BY wa.created_at DESC LIMIT ?${paramIdx}`;
  binds.push(limit);

  const rows = await db.prepare(sql).bind(...binds).all();

  return (rows.results ?? []).map((r) => ({
    id: r.id as number,
    service_id: r.service_id as string,
    service_name: r.service_name as string,
    alert_type: r.alert_type as string,
    severity: r.severity as "critical" | "warning" | "info",
    title: r.title as string,
    details: r.details ? safeParseJson(r.details as string) : null,
    created_at: r.created_at as string,
  }));
}

// ===== Alert Summary =====

export async function getAlertSummary(
  db: D1Database,
  apiKeyHash: string
): Promise<AlertSummary> {
  // Total watches
  const watchCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM tool_watches WHERE api_key_hash = ?1")
    .bind(apiKeyHash)
    .first<{ cnt: number }>();

  // Unread alerts (last 24h) — only for watched tools
  const alertCounts = await db
    .prepare(
      `SELECT wa.severity, COUNT(*) as cnt
       FROM watch_alerts wa
       JOIN tool_watches tw ON wa.service_id = tw.service_id AND tw.api_key_hash = ?1
       WHERE wa.created_at > datetime('now', '-1 day')
       GROUP BY wa.severity`
    )
    .bind(apiKeyHash)
    .all();

  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const row of alertCounts.results ?? []) {
    const sev = row.severity as string;
    const cnt = row.cnt as number;
    if (sev === "critical") critical = cnt;
    else if (sev === "warning") warning = cnt;
    else if (sev === "info") info = cnt;
  }

  // Tools at risk — watched tools that are degraded or dead
  const riskCount = await db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM tool_watches tw
       JOIN health_summary h ON tw.service_id = h.service_id
       WHERE tw.api_key_hash = ?1 AND h.overall_status IN ('degraded', 'dead')`
    )
    .bind(apiKeyHash)
    .first<{ cnt: number }>();

  return {
    total_watches: watchCount?.cnt ?? 0,
    unread_alerts: critical + warning + info,
    critical,
    warning,
    info,
    tools_at_risk: riskCount?.cnt ?? 0,
  };
}

// ===== Cleanup =====

export async function cleanupOldAlerts(
  db: D1Database,
  daysToKeep: number = 30
): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM watch_alerts WHERE created_at < datetime('now', ?1)`)
    .bind(`-${daysToKeep} days`)
    .run();
  return result.meta?.changes ?? 0;
}

// ===== Watch Suggestion for /discover =====

export function shouldSuggestWatch(
  healthStatus?: string,
  recentBreakingChange?: boolean,
  errorCount30d?: number
): boolean {
  if (healthStatus === "degraded" || healthStatus === "dead") return true;
  if (recentBreakingChange) return true;
  if ((errorCount30d ?? 0) >= 10) return true;
  return false;
}

// ─── Helpers ───

function safeParseJson(value: string): Record<string, any> | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
