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
  install_command TEXT,        -- e.g. "npx @anthropic-ai/deepl-mcp"
  install_runtime TEXT,        -- "node" | "python" | "docker" | "binary"
  runtime_version TEXT,        -- e.g. "18" (minimum version)
  service_type TEXT DEFAULT 'mcp_server',  -- "mcp_server" | "api" | "library" | "cli"
  required_env TEXT,           -- JSON array: [{"key":"DEEPL_API_KEY","description":"...","free_tier":true}]
  tools_provided TEXT,         -- JSON array: [{"name":"translate","description":"...","example_input":{...}}]
  pricing_model TEXT,           -- 'free' | 'freemium' | 'paid' | 'open_source' | 'unknown'
  pricing_details TEXT,         -- JSON: raw pricing info with source, tiers
  cost_per_call REAL,           -- estimated USD per call, 0 for free
  free_tier_limit INTEGER,      -- calls/day free tier, -1=unlimited, 0=none, null=unknown
  monthly_price REAL,           -- lowest paid tier monthly USD, 0=free, null=unknown
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
  email TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'scale'
  daily_usage INTEGER DEFAULT 0,
  last_reset TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(email);

-- ─── Query Cache ───

CREATE TABLE IF NOT EXISTS query_cache (
  query_hash TEXT PRIMARY KEY,
  embedding BLOB,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── Request Logs: track every API call ───

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

-- ─── MCP Reports: simplified feedback from MCP channel ───

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

-- ─── Daily Stats: aggregated history (cron job fills this) ───

CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  unique_keys INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL,
  error_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, endpoint)
);

-- ─── Service Passive Signal Scores (cron aggregates daily) ───

CREATE TABLE IF NOT EXISTS service_signals (
  service_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,        -- 'repeat_search' | 'satisfied' | 'low_confidence'
  signal_value REAL NOT NULL,       -- signal strength
  sample_count INTEGER NOT NULL,    -- how many samples this is based on
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (service_id, signal_type)
);

-- ─── Health Check History ───

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

-- ─── Health Summary (aggregated per service) ───

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
  install_score INTEGER DEFAULT NULL,
  install_difficulty TEXT DEFAULT NULL,
  install_details TEXT DEFAULT NULL,
  call_success_rate REAL DEFAULT NULL,
  probe_type TEXT DEFAULT NULL,
  last_probe_details TEXT DEFAULT NULL,
  error_distribution TEXT DEFAULT NULL,
  primary_error_type TEXT DEFAULT NULL,
  error_count_30d INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── Error Classifications ───

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

-- ─── Tool Co-occurrence Graph ───

CREATE TABLE IF NOT EXISTS tool_cooccurrence (
  service_id_a TEXT NOT NULL,
  service_id_b TEXT NOT NULL,
  co_count INTEGER DEFAULT 1,
  last_seen TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (service_id_a, service_id_b)
);

CREATE INDEX IF NOT EXISTS idx_cooccurrence_a ON tool_cooccurrence(service_id_a);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_b ON tool_cooccurrence(service_id_b);

-- ─── Benchmark ───

CREATE TABLE IF NOT EXISTS benchmark_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category_match TEXT NOT NULL,
  tags_match TEXT,
  eval_weights TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS benchmark_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  overall_score REAL NOT NULL,
  dimension_scores TEXT NOT NULL,
  rank INTEGER,
  run_version TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(scenario_id, service_id, run_version)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_scenario ON benchmark_results(scenario_id, rank);
CREATE INDEX IF NOT EXISTS idx_benchmark_service ON benchmark_results(service_id);
