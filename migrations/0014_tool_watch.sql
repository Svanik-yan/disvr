-- Tool Watch & Alerts
-- Agent subscribes to tool health alerts (pull model)

CREATE TABLE IF NOT EXISTS tool_watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_hash TEXT NOT NULL,
  service_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(api_key_hash, service_id)
);

CREATE INDEX idx_watch_key ON tool_watches(api_key_hash);
CREATE INDEX idx_watch_service ON tool_watches(service_id);

CREATE TABLE IF NOT EXISTS watch_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_alerts_service ON watch_alerts(service_id, created_at DESC);
CREATE INDEX idx_alerts_time ON watch_alerts(created_at);
