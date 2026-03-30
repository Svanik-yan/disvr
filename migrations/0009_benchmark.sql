-- Benchmark scenarios and results
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
