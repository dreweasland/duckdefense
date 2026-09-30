import type { EnemyKind } from './enemies';

// The Endless Pond: waves keep coming, bigger and tougher each time, until the duck
// house runs out of hearts. Your score is how many waves you survive. There's no
// randomness, so everyone faces the same waves and the leaderboard is fair.

export interface EndlessGroup {
  enemy: EnemyKind;
  from: number; // the first wave it shows up in
  count: number; // how many in that first wave
  perWave: number; // how many more each wave after that (fractions add up over waves)
  every: number; // seconds between them in the first wave (gets shorter as waves go on)
  after?: number; // seconds into the wave before the first one appears
}

export const ENDLESS = {
  level: 0, // which map (index into LEVELS): the Backyard Pond
  name: 'Endless Pond',
  maxWaves: 999, // nobody will get this far... right?
  nightEvery: 3, // every 3rd wave is at night
  bossEvery: 10, // the Night Bandit crashes every 10th wave
  healthPerWave: 0.07, // predators get this much tougher each wave (0.07 = +7% health)
  spacingPerWave: 0.03, // and arrive this much closer together
  minEvery: 0.35, // but never closer than this many seconds apart
  bonusPeas: { first: 50, perWave: 4 }, // peas for clearing a wave
  perkEvery: 5, // after every 5th wave, pick a Pond Perk (see src/data/perks.ts)
  // Training: once a duck has both upgrades, it can keep training to hit harder.
  training: {
    damage: 0.15, // each level of training adds this much damage (0.15 = +15%)
    firstCost: 150, // peas for the first level
    costGrowth: 1.25, // each level after costs this much more (1.25 = +25%)
  },
  // Fixing the duck house: spend peas to get a heart back (up to the hearts you started with).
  repair: {
    firstCost: 120, // peas for the first heart
    costGrowth: 1.3, // each heart after costs this much more
  },
  groups: [
    { enemy: 'raccoon', from: 1, count: 4, perWave: 1.2, every: 1.3 },
    { enemy: 'fox', from: 3, count: 2, perWave: 0.5, every: 1.1, after: 2 },
    { enemy: 'hawk', from: 4, count: 1, perWave: 0.35, every: 2.5, after: 4 },
    { enemy: 'mink', from: 6, count: 2, perWave: 0.4, every: 1.6, after: 3 },
    { enemy: 'turtle', from: 8, count: 1, perWave: 0.15, every: 5, after: 2 },
  ] satisfies EndlessGroup[],
};

// Endless scores are stored on the leaderboard as this "level" (real levels start at 0).
export const ENDLESS_LEVEL = -1;
