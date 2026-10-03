import { DIFFICULTIES, DIFFICULTY_ORDER, type Difficulty } from '../data/difficulty';
import { DUCK_ORDER, type DuckKind } from '../data/ducks';
import { HATS, type HatKind } from '../data/hats';
import { TRIALS, findTrial } from '../data/trials';
import { daysBetween } from './daily';

// Saved progress: which levels are beaten, stars, and best scores, per difficulty.

export interface LevelRecord {
  stars: number; // 1 to 3
  bestScore: number;
}

export interface Progress {
  version: 1;
  levels: Record<Difficulty, Record<number, LevelRecord>>;
  /** The most recent Daily Challenge played, and the best result on each difficulty. */
  daily?: { date: string; results: Partial<Record<Difficulty, LevelRecord>> };
  /** Daily Challenges won on days in a row: how many, and the last day one was won. */
  dailyStreak?: { count: number; last: string };
  /** The hat each duck is wearing (picked in the Wardrobe). */
  hats?: Partial<Record<DuckKind, HatKind>>;
  /** The most Endless Pond waves survived on each difficulty, per map (index into LEVELS). */
  endless?: Partial<Record<Difficulty, Record<number, number>>>;
  /** Level Trials won (their ids, see src/data/trials.ts) on each difficulty. */
  trials?: Partial<Record<Difficulty, string[]>>;
}

/** Records a Level Trial win. Returns a new Progress (the same one if it was already won). */
export function recordTrialWin(progress: Progress, difficulty: Difficulty, trialId: string): Progress {
  const won = progress.trials?.[difficulty] ?? [];
  if (won.includes(trialId)) return progress;
  return { ...progress, trials: { ...progress.trials, [difficulty]: [...won, trialId] } };
}

export function hasWonTrial(progress: Progress, difficulty: Difficulty, trialId: string): boolean {
  return progress.trials?.[difficulty]?.includes(trialId) ?? false;
}

/** How many of a level's trials have been won on a difficulty. */
export function trialsWon(progress: Progress, difficulty: Difficulty, level: number): number {
  return (TRIALS[level] ?? []).filter((trial) => hasWonTrial(progress, difficulty, trial.id)).length;
}

/** Trials open once the level itself has been beaten on that difficulty. */
export function trialsUnlocked(progress: Progress, difficulty: Difficulty, level: number): boolean {
  return !!progress.levels[difficulty][level];
}

/** Records an Endless Pond run on a map, keeping the most waves survived there. Returns a new Progress. */
export function recordEndless(progress: Progress, difficulty: Difficulty, map: number, waves: number): Progress {
  const best = Math.max(waves, endlessBest(progress, difficulty, map));
  return { ...progress, endless: { ...progress.endless, [difficulty]: { ...progress.endless?.[difficulty], [map]: best } } };
}

/** The most Endless Pond waves survived on a map and difficulty (0 if never played). */
export function endlessBest(progress: Progress, difficulty: Difficulty, map: number): number {
  return progress.endless?.[difficulty]?.[map] ?? 0;
}

/** A result folded into the record so far: the most stars and the best score. */
function bestOf(previous: LevelRecord | undefined, stars: number, score: number): LevelRecord {
  return { stars: Math.max(stars, previous?.stars ?? 0), bestScore: Math.max(score, previous?.bestScore ?? 0) };
}

/** A saved record, if it makes sense (1 to 3 stars). */
function parseRecord(record: Partial<LevelRecord> | undefined): LevelRecord | undefined {
  const stars = Number(record?.stars);
  const bestScore = Number(record?.bestScore);
  return stars >= 1 && stars <= 3 ? { stars, bestScore: Number.isFinite(bestScore) ? bestScore : 0 } : undefined;
}

export function emptyProgress(): Progress {
  return { version: 1, levels: { easy: {}, normal: {}, hard: {} } };
}

/** Records a Daily Challenge win, keeping the best for that day. An older day's results are dropped. */
export function recordDailyWin(progress: Progress, date: string, difficulty: Difficulty, stars: number, score: number): Progress {
  const results = progress.daily?.date === date ? progress.daily.results : {};
  return {
    ...progress,
    daily: { date, results: { ...results, [difficulty]: bestOf(results[difficulty], stars, score) } },
    dailyStreak: nextStreak(progress.dailyStreak, date),
  };
}

/** The streak after a win on `date`: one longer if yesterday was won too, the same if today already was, otherwise back to 1. */
function nextStreak(streak: Progress['dailyStreak'], date: string): Progress['dailyStreak'] {
  const gap = streak && daysBetween(streak.last, date);
  if (streak && gap === 0) return streak;
  return { count: streak && gap === 1 ? streak.count + 1 : 1, last: date };
}

/**
 * How many days in a row the Daily Challenge has been won, as of `today`. It still counts
 * if today's hasn't been won yet (there's time), but not once a whole day has been missed.
 */
export function dailyStreak(progress: Progress, today: string): number {
  const streak = progress.dailyStreak;
  const gap = streak && daysBetween(streak.last, today);
  return streak && (gap === 0 || gap === 1) ? streak.count : 0;
}

/** The best result for a day's Daily Challenge on a difficulty, if it's been won. */
export function dailyRecord(progress: Progress, date: string, difficulty: Difficulty): LevelRecord | undefined {
  return progress.daily?.date === date ? progress.daily.results[difficulty] : undefined;
}

/** 3 stars for keeping almost every heart, 2 for keeping at least half, otherwise 1. */
export function starsFor(heartsLeft: number, startingHearts: number): number {
  const kept = heartsLeft / Math.max(1, startingHearts);
  if (kept >= 0.9) return 3;
  if (kept >= 0.5) return 2;
  return 1;
}

/**
 * Leaderboard score for a win: 100 per heart kept plus peas (leftover ones and those spent
 * on the ducks still out: see scorePeas in game.ts), doubled on Normal and tripled on Hard.
 */
export function scoreFor(heartsLeft: number, peas: number, difficulty: Difficulty): number {
  return (heartsLeft * 100 + peas) * DIFFICULTIES[difficulty].scoreMultiplier;
}

/** The first level is always open; each level after unlocks when the one before is beaten. */
export function isUnlocked(progress: Progress, difficulty: Difficulty, level: number): boolean {
  return level === 0 || !!progress.levels[difficulty][level - 1];
}

/** Records a win, keeping the best stars and score. Returns a new Progress. */
export function recordWin(progress: Progress, difficulty: Difficulty, level: number, stars: number, score: number): Progress {
  const record = bestOf(progress.levels[difficulty][level], stars, score);
  return {
    ...progress,
    levels: { ...progress.levels, [difficulty]: { ...progress.levels[difficulty], [level]: record } },
  };
}

/** Reads saved progress, ignoring anything missing or malformed. */
export function parseProgress(text: string | null): Progress {
  let progress = emptyProgress();
  if (!text) return progress;
  try {
    const data = JSON.parse(text) as {
      levels?: Partial<Record<Difficulty, Record<string, Partial<LevelRecord>>>>;
      daily?: { date?: unknown; results?: Partial<Record<Difficulty, Partial<LevelRecord>>> };
      dailyStreak?: { count?: unknown; last?: unknown };
      hats?: Record<string, unknown>;
      endless?: Record<string, unknown>;
      trials?: Record<string, unknown>;
    };
    for (const difficulty of DIFFICULTY_ORDER) {
      for (const [key, record] of Object.entries(data.levels?.[difficulty] ?? {})) {
        const level = Number(key);
        const parsed = parseRecord(record);
        if (Number.isInteger(level) && level >= 0 && parsed) progress.levels[difficulty][level] = parsed;
      }
    }
    const daily = data.daily;
    if (daily && typeof daily.date === 'string') {
      const results: Partial<Record<Difficulty, LevelRecord>> = {};
      for (const difficulty of DIFFICULTY_ORDER) {
        const parsed = parseRecord(daily.results?.[difficulty]);
        if (parsed) results[difficulty] = parsed;
      }
      progress.daily = { date: daily.date, results };
    }
    const streak = data.dailyStreak;
    if (streak && typeof streak.last === 'string' && daysBetween(streak.last, streak.last) === 0 && Number.isInteger(streak.count) && (streak.count as number) > 0) {
      progress.dailyStreak = { count: streak.count as number, last: streak.last };
    }
    const hats: Partial<Record<DuckKind, HatKind>> = {};
    for (const kind of DUCK_ORDER) {
      const hat = data.hats?.[kind];
      if (typeof hat === 'string' && hat in HATS) hats[kind] = hat as HatKind;
    }
    if (Object.keys(hats).length > 0) progress.hats = hats;
    for (const difficulty of DIFFICULTY_ORDER) {
      const saved = data.endless?.[difficulty];
      // Before Endless came to every map, this was just a number: the best on the first map.
      const perMap: Record<string, unknown> = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : { 0: saved };
      for (const [key, value] of Object.entries(perMap)) {
        const map = Number(key);
        const waves = Number(value);
        if (Number.isInteger(map) && map >= 0 && Number.isInteger(waves) && waves > 0) progress = recordEndless(progress, difficulty, map, waves);
      }
    }
    for (const difficulty of DIFFICULTY_ORDER) {
      const ids = data.trials?.[difficulty];
      if (!Array.isArray(ids)) continue;
      // Only trials that still exist, each counted once.
      const won = [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!findTrial(id)))];
      if (won.length > 0) progress.trials = { ...progress.trials, [difficulty]: won };
    }
  } catch {
    // Corrupt save: start fresh rather than crash.
  }
  return progress;
}
