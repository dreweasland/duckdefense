import type { EnemyKind } from './enemies';

// A wave is one or more groups of predators. Each group sends `count` predators,
// one every `every` seconds, starting `after` seconds into the wave (default 0).
// Night waves are harder (see src/data/dayNight.ts).

export interface SpawnGroup {
  enemy: EnemyKind;
  count: number;
  every: number;
  after?: number;
}

export interface Wave {
  time: 'day' | 'night';
  groups: SpawnGroup[];
  bonusPeas: number; // peas earned for clearing the wave
}

export const LEVEL1_WAVES: Wave[] = [
  { time: 'day', groups: [{ enemy: 'raccoon', count: 3, every: 2.5 }], bonusPeas: 50 },
  { time: 'day', groups: [{ enemy: 'raccoon', count: 5, every: 2 }], bonusPeas: 60 },
  { time: 'night', groups: [{ enemy: 'raccoon', count: 7, every: 1.5 }], bonusPeas: 70 },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 6, every: 1.2 },
      { enemy: 'hawk', count: 3, every: 3, after: 4 },
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 10, every: 1 },
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
  { time: 'night', groups: [{ enemy: 'raccoon', count: 6, every: 1.6 }], bonusPeas: 80 },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 8, every: 1.1 },
      { enemy: 'hawk', count: 4, every: 2.5, after: 4 },
    ],
    bonusPeas: 80,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 12, every: 0.9 },
      { enemy: 'hawk', count: 4, every: 2.2, after: 6 },
    ],
    bonusPeas: 90,
  },
  {
    time: 'day',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'hawk', count: 5, every: 2, after: 3 },
    ],
    bonusPeas: 100,
  },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 20, every: 0.6 },
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
  { time: 'night', groups: [{ enemy: 'raccoon', count: 12, every: 1 }], bonusPeas: 80 },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 10, every: 0.9 },
      { enemy: 'hawk', count: 5, every: 2, after: 4 },
    ],
    bonusPeas: 90,
  },
  { time: 'day', groups: [{ enemy: 'raccoon', count: 18, every: 0.6 }], bonusPeas: 100 },
  {
    time: 'night',
    groups: [
      { enemy: 'raccoon', count: 16, every: 0.7 },
      { enemy: 'hawk', count: 6, every: 1.8, after: 4 },
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
