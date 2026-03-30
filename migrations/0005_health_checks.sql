-- Health Check History
CREATE TABLE IF NOT EXISTS health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  details TEXT,
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_health_checks_service ON health_checks(service_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_health_checks_time ON health_checks(checked_at);

-- Health Summary (aggregated per service)
CREATE TABLE IF NOT EXISTS health_summary (
  service_id TEXT PRIMARY KEY,
  overall_status TEXT NOT NULL DEFAULT 'unknown',
  github_status TEXT,
  package_status TEXT,
  endpoint_status TEXT,
  last_updated TEXT,
  uptime_30d REAL DEFAULT 0,
  avg_response_ms INTEGER,
  last_check_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
