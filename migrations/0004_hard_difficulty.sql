-- Hard difficulty. The scores table only allowed 'easy' and 'normal', and SQLite can't change
-- a CHECK, so rebuild the table (same columns) and copy every score across.
CREATE TABLE scores_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  hearts INTEGER NOT NULL,
  peas INTEGER NOT NULL,
  score INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  daily TEXT,
  trial TEXT
);

INSERT INTO scores_new (id, name, level, difficulty, hearts, peas, score, ip_hash, created_at, daily, trial)
  SELECT id, name, level, difficulty, hearts, peas, score, ip_hash, created_at, daily, trial FROM scores;

DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;

-- The indexes went with the old table.
CREATE INDEX scores_board ON scores (level, difficulty, score DESC);
CREATE INDEX scores_rate ON scores (ip_hash, created_at);
CREATE INDEX scores_daily ON scores (daily, difficulty, score DESC);
CREATE INDEX scores_trial ON scores (trial, difficulty, score DESC);
