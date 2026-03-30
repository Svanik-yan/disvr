-- Migration 0012: Changelog Intelligence (version tracking + breaking change detection)

CREATE TABLE IF NOT EXISTS version_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  package_type TEXT NOT NULL,
  version TEXT NOT NULL,
  previous_version TEXT,
  changes_detected TEXT,
  is_breaking_change INTEGER DEFAULT 0,
  breaking_details TEXT,
  published_at TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  UNIQUE(service_id, version)
);

CREATE INDEX IF NOT EXISTS idx_version_service ON version_history(service_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_breaking ON version_history(is_breaking_change, detected_at DESC);

ALTER TABLE health_summary ADD COLUMN current_version TEXT DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN last_version_change TEXT DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN recent_breaking_change INTEGER DEFAULT 0;
