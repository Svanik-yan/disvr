-- Error classification tracking
CREATE TABLE IF NOT EXISTS error_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  error_type TEXT NOT NULL,
  source TEXT NOT NULL,
  details TEXT,
  occurred_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_class_service ON error_classifications(service_id, error_type);
CREATE INDEX IF NOT EXISTS idx_error_class_time ON error_classifications(occurred_at);

ALTER TABLE health_summary ADD COLUMN error_distribution TEXT DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN primary_error_type TEXT DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN error_count_30d INTEGER DEFAULT 0;
