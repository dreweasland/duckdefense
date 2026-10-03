import { CHALLENGES, type Challenge } from '../data/challenges';
import { DIFFICULTIES, type Difficulty, type DifficultySettings } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import type { Wave } from '../data/waves';

// The Daily Challenge: one level and one twist per day (in UTC, so it's the same
// everywhere). Shared by the game and the leaderboard server, so both agree.

export interface Daily {
  date: string; // YYYY-MM-DD
  level: number; // index into LEVELS
  challenge: Challenge;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in UTC, like "2026-09-29". */
export function dailyDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Days since 1970-01-01 for a YYYY-MM-DD date, or undefined if it isn't a real date. */
function dayNumber(date: string): number | undefined {
  if (!DATE_PATTERN.test(date)) return undefined;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || dailyDate(new Date(ms)) !== date) return undefined;
  return Math.round(ms / DAY_MS);
}

/** How many days after `from` the date `to` is (1 = the next day), or undefined if either isn't a real date. */
export function daysBetween(from: string, to: string): number | undefined {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === undefined || b === undefined ? undefined : b - a;
}

/** A well-mixed number from a day number, so neighbouring days don't look alike. */
function mix(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Some days get two twists at once ("Hawk Day + Thin Wallet"): one day in this many.
export const DOUBLE_TWIST_EVERY = 3;

/** The level and twist (or two) for a date. Every player gets the same one. */
export function dailyFor(date: string): Daily | undefined {
  const day = dayNumber(date);
  if (day === undefined) return undefined;
  // Twists take turns, so none repeats until they've all had a day; the level is mixed up.
  const first = CHALLENGES[day % CHALLENGES.length]!;
  const level = mix(day) % LEVEL_COUNT;
  // On a double-twist day a second, different twist joins in (mixed up, so the pairs vary).
  if (mix(day + 2) % DOUBLE_TWIST_EVERY !== 0 || CHALLENGES.length < 2) return { date, level, challenge: first };
  const second = CHALLENGES[(day + 1 + (mix(day + 2) % (CHALLENGES.length - 1))) % CHALLENGES.length]!;
  return { date, level, challenge: combineChallenges(first, second) };
}

/** Two twists as one: both rules apply (fewer ducks, less of everything, every extra predator). */
export function combineChallenges(a: Challenge, b: Challenge): Challenge {
  const shared = a.ducks && b.ducks ? a.ducks.filter((kind) => b.ducks!.includes(kind)) : undefined;
  // Both teams, if they overlap; the first twist's team if they don't (nobody would be no game at all).
  const ducks = shared && shared.length > 0 ? shared : (a.ducks ?? b.ducks);
  const multiply = (x?: number, y?: number) => (x === undefined && y === undefined ? undefined : (x ?? 1) * (y ?? 1));
  const extras = [...(a.extras ?? []), ...(b.extras ?? [])];
  return {
    name: `${a.name} + ${b.name}`,
    description: `${a.description} ${b.description}`,
    ...(ducks && { ducks }),
    ...(multiply(a.startingPeas, b.startingPeas) !== undefined && { startingPeas: multiply(a.startingPeas, b.startingPeas) }),
    ...(multiply(a.hearts, b.hearts) !== undefined && { hearts: multiply(a.hearts, b.hearts) }),
    ...(multiply(a.enemySpeed, b.enemySpeed) !== undefined && { enemySpeed: multiply(a.enemySpeed, b.enemySpeed) }),
    ...((a.allNight || b.allNight) && { allNight: true }),
    ...((a.noSelling || b.noSelling) && { noSelling: true }),
    ...((a.noCraig || b.noCraig) && { noCraig: true }),
    ...((a.maxDucks !== undefined || b.maxDucks !== undefined) && { maxDucks: Math.min(a.maxDucks ?? Infinity, b.maxDucks ?? Infinity) }),
    ...(extras.length > 0 && { extras }),
  };
}

/** Scores can be posted for today, or yesterday (for a game that started before midnight). */
export function isPostableDate(date: string, now: Date = new Date()): boolean {
  const day = dayNumber(date);
  const today = dayNumber(dailyDate(now))!;
  return day !== undefined && (day === today || day === today - 1);
}

/** The difficulty's settings with the twist applied. */
export function challengeSettings(difficulty: Difficulty, challenge?: Challenge): DifficultySettings {
  const base = DIFFICULTIES[difficulty];
  if (!challenge) return base;
  return {
    ...base,
    startingPeas: Math.round(base.startingPeas * (challenge.startingPeas ?? 1)),
    hearts: Math.max(1, Math.round(base.hearts * (challenge.hearts ?? 1))),
    enemySpeed: base.enemySpeed * (challenge.enemySpeed ?? 1),
  };
}

/** A level's waves with the twist applied (all night, extra predators). */
export function challengeWaves(waves: readonly Wave[], challenge?: Challenge): Wave[] {
  if (!challenge) return [...waves];
  return waves.map((wave) => ({
    ...wave,
    time: challenge.allNight ? 'night' : wave.time,
    groups: challenge.extras ? [...wave.groups, ...challenge.extras.map((group) => ({ ...group }))] : wave.groups,
  }));
}
