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
  holdTheLine?: {
    holdTime: number; // seconds a predator is stopped when it walks into range (once per predator)
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
  },

  // Curtis, the unbothered Magpie: short reach and a light peck, but he holds
  // the line, stopping each predator that walks up to him. (He'll also ignore
  // fear and slow debuffs once predators can cause them.)
  curtis: {
    name: 'Curtis',
    power: { name: 'Hold the Line', description: 'Stops each predator that walks up to him. Nope.', icon: 'hold' },
    cost: 80,
    range: 130, // most slots are 110 from the path, so this gives him a stretch to guard
    damage: 4,
    attackInterval: 1,
    splashRadius: 0,
    canHitFlying: false,
    holdTheLine: { holdTime: 2 },
  },
};
