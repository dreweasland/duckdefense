// Duck stats. Distances are in pixels (the map is 1280 wide). Times are in seconds.

export type DuckKind = 'sunny' | 'potato' | 'chester' | 'curtis';

export interface DuckStats {
  name: string;
  // Shown in the game when you tap a duck. Keep it short and fun!
  power: {
    name: string;
    description: string;
    icon: 'splash' | 'flap' | 'quack' | 'hold'; // picture on the duck's card
  };
  cost: number; // peas to place this duck
  range: number; // how far away the duck can reach a predator
  damage: number; // how much health each hit takes off
  attackInterval: number; // seconds between hits (smaller = faster)
  splashRadius: number; // predators this close to the target get hit too (0 = no splash)
  canHitFlying: boolean; // can this duck hit hawks?

  // Special abilities. Leave one out and the duck doesn't have it.
  wingFlap?: {
    everyNthAttack: number; // e.g. 5 = every 5th hit is a Wing Flap
    pushBack: number; // pixels the predator gets knocked back along the path
  };
  alarmQuack?: {
    cooldown: number; // seconds between quacks
    stunTime: number; // seconds every predator in range is frozen
  };
  slowZone?: {
    slow: number; // ground predators in range walk at this fraction of their speed (0.5 = half)
  };
  fearless?: boolean; // never scared by hawks or the Night Bandit

  // Two upgrades, bought in order from the duck's panel. Each lists only what changes.
  upgrades: [Upgrade, Upgrade];
}

export interface Upgrade {
  name: string; // the duck's new name, e.g. "Seasoned Sunny"
  cost: number; // peas
  description: string; // what gets better, in a few words
  changes: {
    range?: number;
    damage?: number;
    attackInterval?: number;
    splashRadius?: number;
    wingFlap?: Partial<NonNullable<DuckStats['wingFlap']>>;
    alarmQuack?: Partial<NonNullable<DuckStats['alarmQuack']>>;
    slowZone?: Partial<NonNullable<DuckStats['slowZone']>>;
  };
}

// Selling a duck gives back this share of what it cost (0.75 = 75%).
export const SELL_REFUND = 0.75;

// After moving to a new nest, a duck needs this many seconds to settle before it attacks.
export const MOVE_SETTLE_TIME = 1;

// The order ducks appear in the duck picker.
export const DUCK_ORDER: readonly DuckKind[] = ['sunny', 'potato', 'chester', 'curtis'];

export const DUCKS: Record<DuckKind, DuckStats> = {
  // Sunny, the Blue Swedish veteran: steady all-rounder with a small splash.
  sunny: {
    name: 'Sunny',
    power: { name: 'Splash!', description: 'Throws water that splashes a whole group.', icon: 'splash' },
    cost: 100,
    range: 150,
    damage: 12,
    attackInterval: 0.75,
    splashRadius: 40,
    canHitFlying: true,
    upgrades: [
      { name: 'Seasoned Sunny', cost: 90, description: 'Hits harder, bigger splash.', changes: { damage: 16, splashRadius: 55 } },
      { name: 'Legendary Sunny', cost: 160, description: 'Reaches farther, throws faster.', changes: { range: 175, attackInterval: 0.6 } },
    ],
  },

  // Potato, the Black Swedish chaser: fast pecks, and his untucked wing
  // gives a Wing Flap that knocks predators back.
  potato: {
    name: 'Potato',
    power: { name: 'Wing Flap', description: 'Super fast pecks. Every 5th one flaps predators backward.', icon: 'flap' },
    cost: 120,
    range: 140, // a little shorter than Sunny; his strength is speed
    damage: 6,
    attackInterval: 0.3,
    splashRadius: 0,
    canHitFlying: true,
    wingFlap: { everyNthAttack: 5, pushBack: 50 },
    upgrades: [
      { name: 'Speedy Potato', cost: 100, description: 'Pecks even faster.', changes: { attackInterval: 0.24 } },
      {
        name: 'Super Potato',
        cost: 170,
        description: 'Flaps every 4th peck and pushes harder.',
        changes: { damage: 8, wingFlap: { everyNthAttack: 4, pushBack: 80 } },
      },
    ],
  },

  // Chester, the elder Magpie: a weak peck, but his Alarm Quack freezes
  // every predator in range.
  chester: {
    name: 'Chester',
    power: { name: 'Alarm Quack', description: 'QUACK! Freezes every predator nearby, even hawks.', icon: 'quack' },
    cost: 150,
    range: 160,
    damage: 5,
    attackInterval: 1,
    splashRadius: 0,
    canHitFlying: false, // but his Alarm Quack still stuns hawks
    alarmQuack: { cooldown: 6, stunTime: 1.5 },
    upgrades: [
      { name: 'Loud Chester', cost: 110, description: 'Freezes predators for longer.', changes: { alarmQuack: { stunTime: 2.2 } } },
      {
        name: 'Grand Old Chester',
        cost: 180,
        description: 'Quacks more often and reaches farther.',
        changes: { range: 190, alarmQuack: { cooldown: 4 } },
      },
    ],
  },

  // Curtis, the unbothered Magpie: a light peck, but nothing scares him, and
  // predators near him slow to a trudge. He's the duck that keeps working when
  // hawks and the Night Bandit scare everyone else.
  curtis: {
    name: 'Curtis',
    power: { name: 'Hold the Line', description: 'Never gets scared. Predators near him slow to a trudge.', icon: 'hold' },
    cost: 80,
    range: 160, // his slow zone: big enough to cover a bend in the path
    damage: 4,
    attackInterval: 1,
    splashRadius: 0,
    canHitFlying: false,
    slowZone: { slow: 0.35 },
    fearless: true,
    upgrades: [
      { name: 'Stubborn Curtis', cost: 70, description: 'Predators trudge even slower.', changes: { slowZone: { slow: 0.25 } } },
      { name: 'Unmovable Curtis', cost: 140, description: 'Bigger slow zone, harder peck.', changes: { range: 190, damage: 8 } },
    ],
  },
};
