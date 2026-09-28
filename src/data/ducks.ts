// Duck stats. Distances are in pixels (the map is 1280 wide). Times are in seconds.

export type DuckKind = 'sunny' | 'potato' | 'chester' | 'curtis';

export interface DuckStats {
  name: string;
  cost: number; // peas to place this duck
  range: number; // how far away the duck can reach a predator
  damage: number; // how much health each hit takes off
  attackInterval: number; // seconds between hits (smaller = faster)
  splashRadius: number; // predators this close to the target get hit too (0 = no splash)

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

// The order ducks appear in the duck picker.
export const DUCK_ORDER: readonly DuckKind[] = ['sunny', 'potato', 'chester', 'curtis'];

export const DUCKS: Record<DuckKind, DuckStats> = {
  // Sunny, the Blue Swedish veteran: steady all-rounder with a small splash.
  sunny: {
    name: 'Sunny',
    cost: 100,
    range: 150,
    damage: 12,
    attackInterval: 0.75,
    splashRadius: 40,
  },

  // Potato, the Black Swedish chaser: fast pecks, and his untucked wing
  // gives a Wing Flap that knocks predators back.
  potato: {
    name: 'Potato',
    cost: 120,
    range: 120,
    damage: 6,
    attackInterval: 0.3,
    splashRadius: 0,
    wingFlap: { everyNthAttack: 5, pushBack: 50 },
  },

  // Chester, the elder Magpie: a weak peck, but his Alarm Quack freezes
  // every predator in range.
  chester: {
    name: 'Chester',
    cost: 150,
    range: 160,
    damage: 5,
    attackInterval: 1,
    splashRadius: 0,
    alarmQuack: { cooldown: 6, stunTime: 1.5 },
  },

  // Curtis, the unbothered Magpie: short reach and a light peck, but he holds
  // the line, stopping each predator that walks up to him. (He'll also ignore
  // fear and slow debuffs once predators can cause them.)
  curtis: {
    name: 'Curtis',
    cost: 80,
    range: 90,
    damage: 4,
    attackInterval: 1,
    splashRadius: 0,
    holdTheLine: { holdTime: 2 },
  },
};
