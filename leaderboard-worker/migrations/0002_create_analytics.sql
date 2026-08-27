CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  run_id TEXT,
  game_version TEXT NOT NULL,
  properties_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS analytics_received_at
  ON analytics_events (received_at);

CREATE INDEX IF NOT EXISTS analytics_name_received_at
  ON analytics_events (name, received_at);
