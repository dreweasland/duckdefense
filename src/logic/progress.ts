import type { Difficulty } from '../data/difficulty';

// Saved progress: which levels are beaten, stars, and best scores, per difficulty.

export interface LevelRecord {
  stars: number; // 1 to 3
  bestScore: number;
}

export interface Progress {
  version: 1;
  levels: Record<Difficulty, Record<number, LevelRecord>>;
}

export function emptyProgress(): Progress {
  return { version: 1, levels: { easy: {}, normal: {} } };
}

/** 3 stars for keeping almost every heart, 2 for keeping at least half, otherwise 1. */
export function starsFor(heartsLeft: number, startingHearts: number): number {
  const kept = heartsLeft / Math.max(1, startingHearts);
  if (kept >= 0.9) return 3;
  if (kept >= 0.5) return 2;
  return 1;
}

/** Leaderboard score for a win: 100 per heart kept plus leftover peas, doubled on Normal. */
export function scoreFor(heartsLeft: number, peasLeft: number, difficulty: Difficulty): number {
  return (heartsLeft * 100 + peasLeft) * (difficulty === 'normal' ? 2 : 1);
}

/** The first level is always open; each level after unlocks when the one before is beaten. */
export function isUnlocked(progress: Progress, difficulty: Difficulty, level: number): boolean {
  return level === 0 || !!progress.levels[difficulty][level - 1];
}

/** Records a win, keeping the best stars and score. Returns a new Progress. */
export function recordWin(progress: Progress, difficulty: Difficulty, level: number, stars: number, score: number): Progress {
  const previous = progress.levels[difficulty][level];
  const record: LevelRecord = {
    stars: Math.max(stars, previous?.stars ?? 0),
    bestScore: Math.max(score, previous?.bestScore ?? 0),
  };
  return {
    ...progress,
    levels: { ...progress.levels, [difficulty]: { ...progress.levels[difficulty], [level]: record } },
  };
}

/** Reads saved progress, ignoring anything missing or malformed. */
export function parseProgress(text: string | null): Progress {
  const progress = emptyProgress();
  if (!text) return progress;
  try {
    const data = JSON.parse(text) as { levels?: Partial<Record<Difficulty, Record<string, Partial<LevelRecord>>>> };
    for (const difficulty of ['easy', 'normal'] as const) {
      for (const [key, record] of Object.entries(data.levels?.[difficulty] ?? {})) {
        const level = Number(key);
        const stars = Number(record?.stars);
        const bestScore = Number(record?.bestScore);
        if (Number.isInteger(level) && level >= 0 && stars >= 1 && stars <= 3) {
          progress.levels[difficulty][level] = { stars, bestScore: Number.isFinite(bestScore) ? bestScore : 0 };
        }
      }
    }
  } catch {
    // Corrupt save: start fresh rather than crash.
  }
  return progress;
}
