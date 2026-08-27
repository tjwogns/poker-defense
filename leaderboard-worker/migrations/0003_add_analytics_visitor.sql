ALTER TABLE analytics_events ADD COLUMN visitor_hash TEXT;

CREATE INDEX IF NOT EXISTS analytics_visitor_received_at
  ON analytics_events (visitor_hash, received_at);
