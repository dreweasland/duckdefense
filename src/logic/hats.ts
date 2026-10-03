import type { DuckKind } from '../data/ducks';
import { HAT_ORDER, HATS, type HatKind } from '../data/hats';
import type { Progress } from './progress';

// Which hats are unlocked (by stars and ribbons earned) and which duck is wearing what.

/** What's been earned so far: stars from levels, ribbons from Level Trials. */
export interface Earned {
  stars: number;
  ribbons: number;
}

/** Every star earned on every level and difficulty (Daily Challenges don't count). */
export function totalStars(progress: Progress): number {
  let stars = 0;
  for (const levels of Object.values(progress.levels)) {
    for (const record of Object.values(levels)) stars += record.stars;
  }
  return stars;
}

/** Every Level Trial ribbon earned, on both difficulties. */
export function totalRibbons(progress: Progress): number {
  return Object.values(progress.trials ?? {}).reduce((sum, won) => sum + won.length, 0);
}

export function totalEarned(progress: Progress): Earned {
  return { stars: totalStars(progress), ribbons: totalRibbons(progress) };
}

export function isHatUnlocked(hat: HatKind, earned: Earned): boolean {
  return earned.stars >= HATS[hat].stars && earned.ribbons >= (HATS[hat].ribbons ?? 0);
}

/** Hats that were locked with `before` earned and are unlocked with `after`. */
export function newlyUnlocked(before: Earned, after: Earned): HatKind[] {
  return HAT_ORDER.filter((hat) => !isHatUnlocked(hat, before) && isHatUnlocked(hat, after));
}

/** The hat a duck is wearing, if it has one (and it's unlocked). */
export function hatFor(progress: Progress, kind: DuckKind): HatKind | undefined {
  const hat = progress.hats?.[kind];
  return hat && isHatUnlocked(hat, totalEarned(progress)) ? hat : undefined;
}

/** Puts a hat on a duck (or takes it off with undefined). Locked hats can't be worn. Returns a new Progress. */
export function wearHat(progress: Progress, kind: DuckKind, hat: HatKind | undefined): Progress {
  if (hat && !isHatUnlocked(hat, totalEarned(progress))) return progress;
  const hats = { ...progress.hats };
  if (hat) hats[kind] = hat;
  else delete hats[kind];
  return { ...progress, hats };
}
