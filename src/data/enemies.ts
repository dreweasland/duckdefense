// Predator stats. Speed is in pixels per second (the map is 1280 wide).

export type EnemyKind = 'raccoon' | 'hawk' | 'bandit';

export interface EnemyStats {
  name: string;
  maxHp: number; // health when it arrives
  speed: number; // how fast it walks the path (Easy mode slows this down)
  peas: number; // peas you earn for chasing it off
  hearts: number; // hearts it costs if it reaches the duck house
  flying: boolean; // flyers skip the path and dive straight at the house
  boss?: boolean; // gets a big health bar and a dramatic entrance
  tooBigToHold?: boolean; // Curtis can't hold it
  summons?: {
    enemy: EnemyKind;
    count: number; // how many it calls each time
    every: number; // seconds between calls (paused while it's stunned)
  };
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  // The baseline predator.
  raccoon: {
    name: 'Raccoon',
    maxHp: 80,
    speed: 80,
    peas: 10,
    hearts: 1,
    flying: false,
  },

  // Flies in from a "sky" point on the map straight at the duck house.
  // Only ducks with canHitFlying can hit it.
  hawk: {
    name: 'Hawk',
    maxHp: 40,
    speed: 90,
    peas: 15,
    hearts: 1,
    flying: true,
  },

  // Boss: a masked mega-raccoon who whistles for raccoon minions.
  bandit: {
    name: 'The Night Bandit',
    maxHp: 1200,
    speed: 40,
    peas: 200,
    hearts: 5,
    flying: false,
    boss: true,
    tooBigToHold: true,
    summons: { enemy: 'raccoon', count: 2, every: 7 },
  },
};
