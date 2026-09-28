import type { EnemyKind } from './enemies';

// A wave is one or more groups of predators. Each group sends `count` predators,
// one every `every` seconds, starting `after` seconds into the wave (default 0).

export interface SpawnGroup {
  enemy: EnemyKind;
  count: number;
  every: number;
  after?: number;
}

export interface Wave {
  groups: SpawnGroup[];
  bonusPeas: number; // peas earned for clearing the wave
}

export const LEVEL1_WAVES: Wave[] = [
  { groups: [{ enemy: 'raccoon', count: 3, every: 2.5 }], bonusPeas: 50 },
  { groups: [{ enemy: 'raccoon', count: 5, every: 2 }], bonusPeas: 60 },
  { groups: [{ enemy: 'raccoon', count: 8, every: 1.5 }], bonusPeas: 70 },
  {
    groups: [
      { enemy: 'raccoon', count: 8, every: 0.9 },
      { enemy: 'raccoon', count: 8, every: 0.9, after: 10 },
    ],
    bonusPeas: 80,
  },
  { groups: [{ enemy: 'raccoon', count: 22, every: 0.6 }], bonusPeas: 0 },
];
