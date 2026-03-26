-- Disvr D1 Database Schema
-- Agent Spend Intelligence / Economic Router

-- ─── Core: Service Registry ───

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  capabilities TEXT,          -- JSON array of capability tags
  platform TEXT NOT NULL,     -- 'smithery' | 'mcp_registry' | 'github' | 'manual'
  protocols TEXT,             -- JSON: { "mcp": "endpoint", "rest": "endpoint" }
  pricing TEXT,               -- JSON: { "model": "free|per_call", "price_usd": 0.00 }
  reputation_score REAL,      -- 0-5, computed from call data
  success_rate REAL,          -- 0-1, from real call reports
  uptime_30d REAL,            -- 0-1
  latency_p95_ms INTEGER,
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  retry_rate REAL,            -- 0-1, how often agents need to retry
  avg_cost_per_success REAL,  -- USD, actual cost including retries
  doc_completeness REAL,      -- 0-1
  verified INTEGER DEFAULT 0,
  source_url TEXT,
  last_health_check TEXT,     -- ISO 8601
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_services_platform ON services(platform);
CREATE INDEX IF NOT EXISTS idx_services_reputation ON services(reputation_score);
CREATE INDEX IF NOT EXISTS idx_services_success_rate ON services(success_rate);
CREATE INDEX IF NOT EXISTS idx_services_cost ON services(avg_cost_per_success);

-- FTS5 for fallback text search (when OpenAI embedding is unavailable)
CREATE VIRTUAL TABLE IF NOT EXISTS services_fts USING fts5(
  id, name, description, capabilities,
  content='services',
  content_rowid='rowid'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS services_ai AFTER INSERT ON services BEGIN
  INSERT INTO services_fts(rowid, id, name, description, capabilities)
  VALUES (new.rowid, new.id, new.name, new.description, new.capabilities);
END;

CREATE TRIGGER IF NOT EXISTS services_ad AFTER DELETE ON services BEGIN
  INSERT INTO services_fts(services_fts, rowid, id, name, description, capabilities)
  VALUES ('delete', old.rowid, old.id, old.name, old.description, old.capabilities);
END;

CREATE TRIGGER IF NOT EXISTS services_au AFTER UPDATE ON services BEGIN
  INSERT INTO services_fts(services_fts, rowid, id, name, description, capabilities)
  VALUES ('delete', old.rowid, old.id, old.name, old.description, old.capabilities);
  INSERT INTO services_fts(rowid, id, name, description, capabilities)
  VALUES (new.rowid, new.id, new.name, new.description, new.capabilities);
END;

-- ─── Feedback Loop: Call Reports ───
-- This is the real moat — closed-loop signal from actual agent calls
-- Not human reviews, but machine telemetry:
--   task completion rate, retry rate, cost per success, latency, human escalation

CREATE TABLE IF NOT EXISTS call_reports (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  success INTEGER NOT NULL,       -- 0 or 1
  actual_latency_ms INTEGER,
  actual_cost_usd REAL,
  retried INTEGER DEFAULT 0,      -- 0 or 1
  retry_count INTEGER DEFAULT 0,
  human_escalated INTEGER DEFAULT 0,
  task_context TEXT,               -- what type of task was this for
  caller_key_hash TEXT,            -- which agent/key made the call
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_call_reports_service ON call_reports(service_id);
CREATE INDEX IF NOT EXISTS idx_call_reports_query ON call_reports(query_id);
CREATE INDEX IF NOT EXISTS idx_call_reports_created ON call_reports(created_at);

-- ─── API Keys ───

CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'scale'
  daily_usage INTEGER DEFAULT 0,
  last_reset TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── Query Cache ───

CREATE TABLE IF NOT EXISTS query_cache (
  query_hash TEXT PRIMARY KEY,
  embedding BLOB,
  created_at TEXT DEFAULT (datetime('now'))
);
