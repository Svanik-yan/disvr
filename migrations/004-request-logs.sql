-- Migration 004: Enhanced request logging + passive signal collection
-- Drops old request_logs/daily_stats (early stage, minimal data) and recreates with richer schema

-- 1. Rebuild request_logs with endpoint, need, response_service_ids, query_id, status_code
DROP TABLE IF EXISTS request_logs;

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  need TEXT,
  response_service_ids TEXT,   -- JSON array of recommended service IDs
  query_id TEXT,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_request_logs_api_key_hash ON request_logs(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_need ON request_logs(need);

-- 2. Rebuild daily_stats with (date, endpoint) composite key
DROP TABLE IF EXISTS daily_stats;

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  unique_keys INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL,
  error_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, endpoint)
);

-- 3. New: service passive signal scores (cron aggregates daily)
CREATE TABLE IF NOT EXISTS service_signals (
  service_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,        -- 'repeat_search' | 'satisfied' | 'low_confidence'
  signal_value REAL NOT NULL,       -- signal strength
  sample_count INTEGER NOT NULL,    -- how many samples this is based on
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (service_id, signal_type)
);
