-- Tool Co-occurrence Graph
CREATE TABLE IF NOT EXISTS tool_cooccurrence (
  service_id_a TEXT NOT NULL,
  service_id_b TEXT NOT NULL,
  co_count INTEGER DEFAULT 1,
  last_seen TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (service_id_a, service_id_b)
);

CREATE INDEX IF NOT EXISTS idx_cooccurrence_a ON tool_cooccurrence(service_id_a);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_b ON tool_cooccurrence(service_id_b);
