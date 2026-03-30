-- Migration 0013: Agent Profiles (behavioral tracking + personalized recommendations)

CREATE TABLE IF NOT EXISTS agent_profiles (
  api_key_hash TEXT PRIMARY KEY,
  search_count INTEGER DEFAULT 0,
  first_seen TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  preferred_categories TEXT DEFAULT '{}',
  preferred_pricing TEXT DEFAULT NULL,
  intent_distribution TEXT DEFAULT '{}',
  top_tools TEXT DEFAULT '[]',
  avg_tools_per_session REAL DEFAULT 0,
  profile_data TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_hash TEXT NOT NULL,
  service_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_key ON agent_tool_usage(api_key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_service ON agent_tool_usage(service_id);
