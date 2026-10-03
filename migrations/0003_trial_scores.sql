-- Level Trial scores: the trial's id (see src/data/trials.ts), or NULL for any other score.
ALTER TABLE scores ADD COLUMN trial TEXT;

CREATE INDEX scores_trial ON scores (trial, difficulty, score DESC);
