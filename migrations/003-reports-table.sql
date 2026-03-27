-- MCP tool call reports (simpler schema for MCP channel feedback)

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_service_id ON reports(service_id);
CREATE INDEX IF NOT EXISTS idx_reports_query_id ON reports(query_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
