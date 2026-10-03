import type { EnemyKind } from './enemies';
import type { VariantKind } from './variants';

// A wave is one or more groups of predators. Each group sends `count` predators,
// one every `every` seconds, starting `after` seconds into the wave (default 0).
// Night waves are harder (see src/data/dayNight.ts).

export interface SpawnGroup {
  enemy: EnemyKind;
  count: number;
  every: number;
  after?: number;
  variant?: VariantKind; // a twist on them, like 'armored' (see src/data/variants.ts)
}

// Calling the next wave early: once every predator in a wave has shown up, you can send the
// next wave before this one is finished. You get this wave's bonus right away, plus extra
// peas for every predator still out there (more risk, more reward).
export const EARLY_CALL = {
  peasPerPredator: 5,
};

export interface Wave {
  time: 'day' | 'night';
  groups: SpawnGroup[];
  bonusPeas: number; // peas earned for clearing the wave
  health?: number; // multiplies every predator's health this wave (the Endless Pond uses it)
}

export const LEVEL1_WAVES: Wave[] = [
  { time: 'day', groups: [{ enemy: 'raccoon', count: 3, every: 2.5 }], bonusPeas: 50 },
  { time: 'day', groups: [{ enemy: 'raccoon', count: 5, every: 2 }], bonusPeas: 60 },
  { time: 'night', groups: [{ enemy: 'raccoon', count: 7, every: 1.5 }], bonusPeas: 70 },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 6, every: 1.2 },
      { enemy: 'fox', count: 3, every: 2, after: 3 }, // the first foxes!
      { enemy: 'hawk', count: 3, every: 3, after: 4 },
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 10, every: 1 },
      { enemy: 'fox', count: 4, every: 1.5, after: 2 },
      { enemy: 'hawk', count: 4, every: 2.5, after: 6 },
    ],
    bonusPeas: 90,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 18, every: 0.7 },
      { enemy: 'hawk', count: 4, every: 2.5, after: 5 },
    ],
    bonusPeas: 0,
  },
];

export const LEVEL2_WAVES: Wave[] = [
  { time: 'day', groups: [{ enemy: 'raccoon', count: 3, every: 2.5 }], bonusPeas: 60 },
  { time: 'day', groups: [{ enemy: 'raccoon', count: 4, every: 2.2 }], bonusPeas: 70 },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 5, every: 1.6 },
      { enemy: 'mink', count: 3, every: 2.5, after: 3 }, // the first minks!
    ],
    bonusPeas: 80,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.1 },
      { enemy: 'fox', count: 3, every: 1.5, after: 2 },
      { enemy: 'hawk', count: 4, every: 2.5, after: 4 },
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 10, every: 0.9 },
      { enemy: 'mink', count: 4, every: 2, after: 4 },
      { enemy: 'hawk', count: 4, every: 2.2, after: 6 },
    ],
    bonusPeas: 90,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 14, every: 0.7 },
      { enemy: 'fox', count: 4, every: 1.2, after: 5 },
      { enemy: 'hawk', count: 5, every: 2, after: 3 },
    ],
    bonusPeas: 100,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.6 },
      { enemy: 'mink', count: 5, every: 1.5, after: 3 },
      { enemy: 'fox', count: 3, every: 1.2, after: 8 },
      { enemy: 'hawk', count: 5, every: 2, after: 5 },
    ],
    bonusPeas: 0,
  },
];

export const LEVEL3_WAVES: Wave[] = [
  { time: 'night', groups: [{ enemy: 'raccoon', count: 6, every: 1.8 }], bonusPeas: 60 },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.4 },
      { enemy: 'hawk', count: 2, every: 3, after: 3 },
    ],
    bonusPeas: 70,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 10, every: 1 },
      { enemy: 'turtle', count: 1, every: 1, after: 3 }, // the first snapping turtle!
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 10, every: 0.9 },
      { enemy: 'hawk', count: 5, every: 2, after: 4 },
    ],
    bonusPeas: 90,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 14, every: 0.6 },
      { enemy: 'fox', count: 4, every: 1, after: 3 },
      { enemy: 'turtle', count: 2, every: 6, after: 2 },
      { enemy: 'skunk', count: 2, every: 4, after: 6 }, // the first skunks! (don't splash them)
    ],
    bonusPeas: 100,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 12, every: 0.7 },
      { enemy: 'mink', count: 5, every: 1.4, after: 3 },
      { enemy: 'hawk', count: 6, every: 1.8, after: 4 },
      { enemy: 'skunk', count: 2, every: 5, after: 2 },
    ],
    bonusPeas: 110,
  },
  // The Night Bandit arrives with a crowd.
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 14, every: 0.8 },
      { enemy: 'hawk', count: 4, every: 2, after: 6 },
      { enemy: 'bandit', count: 1, every: 1, after: 8 },
    ],
    bonusPeas: 0,
  },
];

// World 2. Each level ends with one of the big bosses.

// Hawk Hill: hawks, hawks, and more hawks, then the Storm Hawk herself.
export const LEVEL4_WAVES: Wave[] = [
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 5, every: 2 },
      { enemy: 'hawk', count: 2, every: 3, after: 4 },
    ],
    bonusPeas: 70,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.5 },
      { enemy: 'hawk', count: 3, every: 2.5, after: 3 },
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.2 },
      { enemy: 'hawk', count: 5, every: 2, after: 2 },
    ],
    bonusPeas: 90,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 10, every: 1 },
      { enemy: 'fox', count: 4, every: 1.5, after: 3 },
      { enemy: 'hawk', count: 5, every: 2, after: 5 },
    ],
    bonusPeas: 100,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 12, every: 0.9 },
      { enemy: 'mink', count: 4, every: 2, after: 3 },
      { enemy: 'hawk', count: 6, every: 1.8, after: 4 },
      { enemy: 'skunk', count: 2, every: 4, after: 5 },
    ],
    bonusPeas: 110,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 10, every: 0.7 },
      { enemy: 'raccoon', count: 4, every: 1.5, after: 8, variant: 'armored' }, // the first armored raccoons!
      { enemy: 'fox', count: 5, every: 1.2, after: 4 },
      { enemy: 'hawk', count: 8, every: 1.5, after: 3 },
    ],
    bonusPeas: 120,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'hawk', count: 10, every: 1.4, after: 2 },
      { enemy: 'turtle', count: 1, every: 1, after: 5 },
    ],
    bonusPeas: 130,
  },
  // The Storm Hawk swoops in, calling more hawks as she comes.
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'fox', count: 4, every: 1.2, after: 6 },
      { enemy: 'hawk', count: 6, every: 2, after: 4 },
      { enemy: 'stormHawk', count: 1, every: 1, after: 10 },
    ],
    bonusPeas: 0,
  },
];

// Fox Run: long straight stretches for foxes to sprint down, and minks in the grass.
export const LEVEL5_WAVES: Wave[] = [
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 5, every: 1.8 },
      { enemy: 'fox', count: 2, every: 2, after: 4 },
    ],
    bonusPeas: 70,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 6, every: 1.5 },
      { enemy: 'fox', count: 4, every: 1.5, after: 2 },
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.2 },
      { enemy: 'mink', count: 3, every: 2, after: 3 },
    ],
    bonusPeas: 90,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'fox', count: 8, every: 1 },
      { enemy: 'raccoon', count: 8, every: 1.2, after: 3 },
      { enemy: 'hawk', count: 3, every: 2.5, after: 5 },
    ],
    bonusPeas: 100,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 12, every: 0.9 },
      { enemy: 'fox', count: 10, every: 1, after: 3 },
      { enemy: 'skunk', count: 2, every: 5, after: 4 },
    ],
    bonusPeas: 110,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 14, every: 0.8 },
      { enemy: 'fox', count: 5, every: 0.9, after: 4 },
      { enemy: 'fox', count: 3, every: 1.5, after: 10, variant: 'rabid' }, // rabid foxes: even faster!
      { enemy: 'hawk', count: 5, every: 2, after: 3 },
      { enemy: 'turtle', count: 1, every: 1, after: 6 },
    ],
    bonusPeas: 120,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 14, every: 0.7 },
      { enemy: 'mink', count: 4, every: 1.6, after: 3 },
      { enemy: 'fox', count: 6, every: 1, after: 6 },
      { enemy: 'hawk', count: 4, every: 2, after: 5 },
    ],
    bonusPeas: 130,
  },
  // The Silver Fox races in with a pack of foxes.
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'fox', count: 6, every: 1, after: 3 },
      { enemy: 'hawk', count: 4, every: 2.2, after: 6 },
      { enemy: 'silverFox', count: 1, every: 1, after: 9 },
    ],
    bonusPeas: 0,
  },
];

// Snapper Swamp: turtles climb out of the big pond, the Night Bandit drops by, and Old
// Snapper himself comes last.
export const LEVEL6_WAVES: Wave[] = [
  { time: 'day', groups: [{ enemy: 'raccoon', count: 6, every: 1.6 }], bonusPeas: 100 },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.3 },
      { enemy: 'turtle', count: 1, every: 1, after: 3 },
    ],
    bonusPeas: 110,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 10, every: 1 },
      { enemy: 'fox', count: 3, every: 1.5, after: 3 },
      { enemy: 'hawk', count: 2, every: 3, after: 5 },
    ],
    bonusPeas: 120,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 12, every: 0.9 },
      { enemy: 'raccoon', count: 3, every: 2, after: 12, variant: 'regrow' }, // regrowing raccoons: keep pecking!
      { enemy: 'mink', count: 3, every: 1.8, after: 3 },
      { enemy: 'turtle', count: 1, every: 1, after: 4 },
    ],
    bonusPeas: 130,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 14, every: 0.8 },
      { enemy: 'raccoon', count: 3, every: 2, after: 12, variant: 'armored' },
      { enemy: 'fox', count: 5, every: 1.1, after: 3 },
      { enemy: 'hawk', count: 4, every: 2, after: 4 },
      { enemy: 'turtle', count: 2, every: 6, after: 2 },
      { enemy: 'skunk', count: 3, every: 4, after: 5 },
    ],
    bonusPeas: 150,
  },
  // The Night Bandit drops by.
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 12, every: 0.8 },
      { enemy: 'hawk', count: 3, every: 2, after: 6 },
      { enemy: 'turtle', count: 1, every: 1, after: 3 },
      { enemy: 'bandit', count: 1, every: 1, after: 8 },
    ],
    bonusPeas: 170,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'fox', count: 6, every: 1, after: 4 },
      { enemy: 'hawk', count: 5, every: 1.8, after: 3 },
      { enemy: 'turtle', count: 3, every: 5, after: 2 },
    ],
    bonusPeas: 190,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 18, every: 0.6 },
      { enemy: 'mink', count: 5, every: 1.3, after: 3 },
      { enemy: 'fox', count: 5, every: 1, after: 8 },
      { enemy: 'hawk', count: 5, every: 1.8, after: 5 },
    ],
    bonusPeas: 220,
  },
  // Old Snapper climbs out of the pond.
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'turtle', count: 3, every: 5, after: 2 },
      { enemy: 'hawk', count: 4, every: 2, after: 6 },
      { enemy: 'oldSnapper', count: 1, every: 1, after: 8 },
    ],
    bonusPeas: 0,
  },
];
