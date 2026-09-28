// Predator stats. Speed is in pixels per second (the map is 1280 wide).

export type EnemyKind = 'raccoon';

export interface EnemyStats {
  name: string;
  maxHp: number; // health when it arrives
  speed: number; // how fast it walks the path (Easy mode slows this down)
  peas: number; // peas you earn for chasing it off
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  // The baseline predator.
  raccoon: {
    name: 'Raccoon',
    maxHp: 80,
    speed: 80,
    peas: 10,
  },
};
