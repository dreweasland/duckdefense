// Predator stats. Speed is in pixels per second (the map is 1280 wide).

export type EnemyKind = 'raccoon' | 'hawk';

export interface EnemyStats {
  name: string;
  maxHp: number; // health when it arrives
  speed: number; // how fast it walks the path (Easy mode slows this down)
  peas: number; // peas you earn for chasing it off
  flying: boolean; // flyers skip the path and dive straight at the house
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  // The baseline predator.
  raccoon: {
    name: 'Raccoon',
    maxHp: 80,
    speed: 80,
    peas: 10,
    flying: false,
  },

  // Flies in from a "sky" point on the map straight at the duck house.
  // Only ducks with canHitFlying can hit it.
  hawk: {
    name: 'Hawk',
    maxHp: 40,
    speed: 90,
    peas: 15,
    flying: true,
  },
};
