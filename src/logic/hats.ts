import type { DuckKind } from '../data/ducks';
import { HAT_ORDER, HATS, type HatKind } from '../data/hats';
import type { Progress } from './progress';

// Which hats are unlocked (by stars earned) and which duck is wearing what.

/** Every star earned on every level and difficulty (Daily Challenges don't count). */
export function totalStars(progress: Progress): number {
  let stars = 0;
  for (const levels of Object.values(progress.levels)) {
    for (const record of Object.values(levels)) stars += record.stars;
  }
  return stars;
}

export function isHatUnlocked(hat: HatKind, stars: number): boolean {
  return stars >= HATS[hat].stars;
}

/** Hats that unlock somewhere above `before` stars, up to `after`. */
export function newlyUnlocked(before: number, after: number): HatKind[] {
  return HAT_ORDER.filter((hat) => !isHatUnlocked(hat, before) && isHatUnlocked(hat, after));
}

/** The hat a duck is wearing, if it has one (and it's unlocked). */
export function hatFor(progress: Progress, kind: DuckKind): HatKind | undefined {
  const hat = progress.hats?.[kind];
  return hat && isHatUnlocked(hat, totalStars(progress)) ? hat : undefined;
}

/** Puts a hat on a duck (or takes it off with undefined). Locked hats can't be worn. Returns a new Progress. */
export function wearHat(progress: Progress, kind: DuckKind, hat: HatKind | undefined): Progress {
  if (hat && !isHatUnlocked(hat, totalStars(progress))) return progress;
  const hats = { ...progress.hats };
  if (hat) hats[kind] = hat;
  else delete hats[kind];
  return { ...progress, hats };
}
