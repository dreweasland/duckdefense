// Special map tiles. Level designers place them in Tiled (see maps/README.md);
// these numbers say what they do.

export type NestKind = 'hill' | 'water';

export const TILES = {
  // Mud on the path: ground predators slog through it.
  mud: {
    name: 'Mud',
    description: 'Predators slog through mud at half speed.',
    speed: 0.5, // predators in mud move at this fraction of their speed (0.5 = half)
  },
  // Brambles on the path: prickly! Ground predators lose health while they're in them.
  brambles: {
    name: 'Brambles',
    description: 'Ouch! Predators lose health while they walk through the thorns.',
    damagePerSecond: 8,
  },
  // Special nests: a nest point in Tiled with its class (or type) set to one of these.
  nests: {
    hill: { name: 'Hill nest', description: 'reaches 20% farther', range: 0.2, damage: 0 },
    water: { name: 'Waterside nest', description: 'hits 15% harder', range: 0, damage: 0.15 },
  } satisfies Record<NestKind, { name: string; description: string; range: number; damage: number }>,
  // (Nest descriptions finish the sentence "A duck in this nest ...".)
};
