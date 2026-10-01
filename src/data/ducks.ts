// Duck stats. Distances are in pixels (the map is 1280 wide). Times are in seconds.

export type DuckKind = 'sunny' | 'potato' | 'chester' | 'curtis';

export interface DuckStats {
  name: string;
  // Shown in the game when you tap a duck. Keep it short and fun!
  power: {
    name: string;
    description: string;
    icon: 'splash' | 'flap' | 'quack' | 'hold'; // picture on the duck's card
    stat: string; // what the damage report counts for this power, e.g. "Froze" (predators frozen)
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
    radius?: number; // also blows back every predator this close to the target (Tornado Potato)
  };
  alarmQuack?: {
    cooldown: number; // seconds between quacks
    stunTime: number; // seconds every predator in range is frozen
    weaken?: number; // frozen predators take this much more damage from everyone (0.5 = +50%)
  };
  slowZone?: {
    slow: number; // ground predators in range walk at this fraction of their speed (0.5 = half)
  };
  fearless?: boolean; // never scared by hawks or the Night Bandit
  flyerDamage?: number; // multiplies damage against flying predators (2 = double)
  braveAura?: { radius: number }; // other ducks this close are never scared either

  // Two upgrades, bought in order from the duck's panel. Each lists only what changes.
  upgrades: [Upgrade, Upgrade];
  // Then a final upgrade: pick ONE of these two paths. A duck keeps the path it picks.
  finals: [Upgrade, Upgrade];
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
    canHitFlying?: boolean;
    flyerDamage?: number;
    braveAura?: DuckStats['braveAura'];
  };
}

// Selling a duck gives back this share of what it cost (0.75 = 75%).
export const SELL_REFUND = 0.75;

// After moving to a new nest, a duck needs this many seconds to settle before it attacks.
export const MOVE_SETTLE_TIME = 1;

// After a Wing Flap knocks a predator back, it can't be knocked back again for this many
// seconds, so a row of Potatoes can't juggle a predator in place forever.
export const WING_FLAP_RECOVERY = 1;

// After an Alarm Quack's freeze wears off, a predator is on guard and can't be frozen again
// for this share of the time it was frozen (0.5 = half as long). Without it, two loud
// Chesters taking turns could keep a predator frozen until it's chased off.
export const FREEZE_RECOVERY = 0.5;

// The order ducks appear in the duck picker.
export const DUCK_ORDER: readonly DuckKind[] = ['sunny', 'potato', 'chester', 'curtis'];

export const DUCKS: Record<DuckKind, DuckStats> = {
  // Sunny, the Blue Swedish veteran: steady all-rounder with a small splash.
  sunny: {
    name: 'Sunny',
    power: { name: 'Splash!', description: 'Throws water that splashes a whole group.', icon: 'splash', stat: 'Splashed' },
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
    finals: [
      { name: 'Tidal Sunny', cost: 260, description: 'A giant splash that soaks a whole crowd.', changes: { splashRadius: 95, damage: 20 } },
      { name: 'Eagle-Eye Sunny', cost: 260, description: 'Sees way farther. Double damage to hawks.', changes: { range: 240, damage: 20, flyerDamage: 2 } },
    ],
  },

  // Potato, the Black Swedish chaser: fast pecks, and his untucked wing
  // gives a Wing Flap that knocks predators back.
  potato: {
    name: 'Potato',
    power: { name: 'Wing Flap', description: 'Super fast pecks. Every 5th one flaps predators backward.', icon: 'flap', stat: 'Flapped' },
    cost: 100, // same as Sunny, so a Normal game can open with one of each
    range: 140, // a little shorter than Sunny; his strength is speed
    damage: 6,
    attackInterval: 0.3,
    splashRadius: 0,
    canHitFlying: true,
    wingFlap: { everyNthAttack: 5, pushBack: 50 },
    flyerDamage: 2, // the chaser is the flock's hawk specialist: double damage to anything that flies
    upgrades: [
      { name: 'Speedy Potato', cost: 100, description: 'Pecks even faster.', changes: { attackInterval: 0.24 } },
      {
        name: 'Super Potato',
        cost: 170,
        description: 'Flaps every 4th peck and pushes harder.',
        changes: { damage: 8, wingFlap: { everyNthAttack: 4, pushBack: 80 } },
      },
    ],
    finals: [
      {
        name: 'Tornado Potato',
        cost: 280,
        description: 'Every 3rd peck, a gust blows back every predator nearby.',
        changes: { damage: 10, wingFlap: { everyNthAttack: 3, pushBack: 110, radius: 90 } },
      },
      { name: 'Rapid Potato', cost: 280, description: 'Pecks twice as fast!', changes: { attackInterval: 0.13, damage: 9 } },
    ],
  },

  // Chester, the elder Magpie: a weak peck, but his Alarm Quack freezes
  // every predator in range.
  chester: {
    name: 'Chester',
    power: { name: 'Alarm Quack', description: 'QUACK! Freezes every predator nearby, even hawks.', icon: 'quack', stat: 'Froze' },
    cost: 110, // he barely pecks, so he has to be cheap enough to be worth a nest
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
    finals: [
      { name: 'Thunder Chester', cost: 300, description: 'His quack reaches way, way farther.', changes: { range: 260 } },
      {
        name: 'Wise Old Chester',
        cost: 300,
        description: 'Frozen predators take 50% more damage from everyone.',
        changes: { alarmQuack: { weaken: 0.5 } },
      },
    ],
  },

  // Curtis, the unbothered Magpie: a light peck, but nothing scares him, and
  // predators near him slow to a trudge. He's the duck that keeps working when
  // hawks and the Night Bandit scare everyone else.
  curtis: {
    name: 'Curtis',
    power: { name: 'Hold the Line', description: 'Never gets scared. Predators near him slow to a trudge.', icon: 'hold', stat: 'Slowed' },
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
    finals: [
      { name: 'Boulder Curtis', cost: 220, description: 'Predators crawl, in an even bigger zone.', changes: { range: 220, slowZone: { slow: 0.15 } } },
      {
        name: 'Guardian Curtis',
        cost: 220,
        description: 'Ducks near him are never scared, just like him.',
        changes: { damage: 10, braveAura: { radius: 200 } },
      },
    ],
  },
};
