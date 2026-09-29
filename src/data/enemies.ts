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
  pushResistance?: number; // how much of a Wing Flap's knockback it shrugs off (0.8 = only moves 20%)
  // Scares ducks near it, so they stop attacking for a moment (Curtis is never scared).
  scares?: {
    radius: number; // how close a duck has to be
    time: number; // seconds a duck stays scared
    when: 'swooping' | 'whistling'; // as it flies past a duck, or when it whistles for minions
  };
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
    scares: { radius: 70, time: 1.5, when: 'swooping' },
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
    pushResistance: 0.8, // too heavy to push far, so Potato can't pin it in place
    scares: { radius: 150, time: 1.2, when: 'whistling' },
    summons: { enemy: 'raccoon', count: 2, every: 7 },
  },
};
