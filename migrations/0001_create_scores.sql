-- The public leaderboard: one row per posted win.
CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal')),
  hearts INTEGER NOT NULL,
  peas INTEGER NOT NULL,
  score INTEGER NOT NULL,
  -- A one-way hash of the poster's IP address, only used for rate limiting.
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX scores_board ON scores (level, difficulty, score DESC);
CREATE INDEX scores_rate ON scores (ip_hash, created_at);
