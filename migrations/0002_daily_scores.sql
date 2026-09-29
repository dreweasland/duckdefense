-- Daily Challenge scores: the challenge's date (YYYY-MM-DD), or NULL for a regular level score.
ALTER TABLE scores ADD COLUMN daily TEXT;

CREATE INDEX scores_daily ON scores (daily, difficulty, score DESC);
