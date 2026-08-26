CREATE TABLE IF NOT EXISTS leaderboard_entries (
  date TEXT NOT NULL,
  player_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 60),
  kills INTEGER NOT NULL CHECK (kills >= 0),
  result TEXT NOT NULL CHECK (result IN ('victory', 'defeat')),
  submitted_at TEXT NOT NULL,
  PRIMARY KEY (date, player_hash)
);

CREATE INDEX IF NOT EXISTS leaderboard_daily_score
  ON leaderboard_entries (date, score DESC, round DESC, submitted_at ASC);
