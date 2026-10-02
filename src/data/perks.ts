// Pond Perks: in the Endless Pond, every few waves you pick one of three perks.
// Perks stack (pick the same one again and it gets stronger), up to `max` times.
// Add a perk by giving it a name, words, a picture, and what it changes (see PerkEffect).

export type PerkId =
  | 'sharpBeaks'
  | 'longNecks'
  | 'quickWings'
  | 'peaHarvest'
  | 'earlyRiser'
  | 'nightOwls'
  | 'braveFlock'
  | 'extraLoud'
  | 'stickyMud'
  | 'patchedRoof'
  | 'peaPile'
  // Boss rewards: big perks offered after a boss wave. Each can be picked once.
  | 'craigsWatch'
  | 'soggySplash'
  | 'skyQuack'
  | 'pricklyCurtis'
  | 'dizzyFlap'
  | 'newNests';

/** What a perk does each time it's picked. Changes that are multipliers add up (+0.1 twice = +20%). */
export interface PerkEffect {
  damage?: number; // every duck hits this much harder (0.1 = +10%)
  range?: number; // every duck reaches this much farther
  attackSpeed?: number; // every duck attacks this much faster
  killPeas?: number; // chased-off predators drop this many more peas
  dayBonus?: number; // day waves pay this much more bonus peas
  nightDamage?: number; // ducks hit this much harder at night
  scare?: number; // ducks stay scared this much less (0.5 = half as long)
  stun?: number; // Chester's quack freezes this much longer
  slow?: number; // Curtis slows predators this much more
  hearts?: number; // hearts added now (and the most the duck house can be fixed to)
  peas?: number; // peas, right now
  // Boss rewards change a rule instead of a number:
  craigEvery?: number; // Craig's blessing comes back after this many waves (instead of ENDLESS.craigEvery)
  soak?: { speed: number; time: number }; // predators Sunny splashes move at this share of their speed for this many seconds
  quackPush?: number; // Chester's quack blows flying predators back this many pixels
  prickle?: number; // predators in Curtis's slow zone lose this share of their full health every second (0.02 = 2%)
  flapStun?: number; // predators Potato flaps stay dizzy (frozen) for this many seconds
  nests?: boolean; // opens the extra nests (ENDLESS.bonusNests)
}

export interface PerkInfo {
  name: string;
  description: string;
  icon: string; // a picture from src/art/sprites.ts
  tint?: number; // a color for the picture (the star is white until tinted)
  max: number; // how many times it can be picked
  boss?: boolean; // a boss reward: only offered after a boss wave
  effect: PerkEffect;
}

export const PERKS: Record<PerkId, PerkInfo> = {
  sharpBeaks: { name: 'Sharp Beaks', description: 'Every duck hits 10% harder.', icon: 'star', tint: 0xffd23f, max: 5, effect: { damage: 0.1 } },
  longNecks: { name: 'Long Necks', description: 'Every duck reaches 8% farther.', icon: 'power-splash', max: 3, effect: { range: 0.08 } },
  quickWings: { name: 'Quick Wings', description: 'Every duck attacks 8% faster.', icon: 'icon-bolt', max: 4, effect: { attackSpeed: 0.08 } },
  peaHarvest: { name: 'Pea Harvest', description: 'Chased-off predators drop 25% more peas.', icon: 'raccoon', max: 3, effect: { killPeas: 0.25 } },
  earlyRiser: { name: 'Early Riser', description: 'Day waves pay 50% more bonus peas.', icon: 'icon-sun', max: 2, effect: { dayBonus: 0.5 } },
  nightOwls: { name: 'Night Owls', description: 'Ducks hit 20% harder at night.', icon: 'icon-moon', max: 3, effect: { nightDamage: 0.2 } },
  braveFlock: { name: 'Brave Flock', description: 'Scared ducks get over it twice as fast.', icon: 'power-hold', max: 1, effect: { scare: 0.5 } },
  extraLoud: { name: 'Extra Loud', description: "Chester's quack freezes predators 30% longer.", icon: 'duck-chester', max: 2, effect: { stun: 0.3 } },
  stickyMud: { name: 'Sticky Mud', description: 'Predators near Curtis trudge even slower.', icon: 'duck-curtis', max: 2, effect: { slow: 0.2 } },
  patchedRoof: { name: 'Patched Roof', description: '3 more hearts for the duck house.', icon: 'icon-heart', max: 3, effect: { hearts: 3 } },
  peaPile: { name: 'Pea Pile', description: '300 peas, right now!', icon: 'icon-pea', max: 99, effect: { peas: 300 } },

  // Boss rewards. After a boss wave you pick one of these instead (until they're all taken).
  craigsWatch: {
    name: "Craig's Watch",
    description: "Craig's blessing comes back every 5 waves.",
    icon: 'duck-craig',
    max: 1,
    boss: true,
    effect: { craigEvery: 5 },
  },
  soggySplash: {
    name: 'Soggy Splash',
    description: "Sunny's splashes soak predators (hawks too), so they slow down.",
    icon: 'duck-sunny',
    max: 1,
    boss: true,
    effect: { soak: { speed: 0.7, time: 2 } },
  },
  skyQuack: {
    name: 'Sky Quack',
    description: "Chester's quack blows hawks backward.",
    icon: 'duck-chester',
    max: 1,
    boss: true,
    effect: { quackPush: 120 },
  },
  pricklyCurtis: {
    name: 'Prickly Curtis',
    description: 'Predators near Curtis get prickled the whole time.',
    icon: 'duck-curtis',
    max: 1,
    boss: true,
    effect: { prickle: 0.02 },
  },
  dizzyFlap: {
    name: 'Dizzy Flap',
    description: "Potato's Wing Flap leaves predators seeing stars.",
    icon: 'duck-potato',
    max: 1,
    boss: true,
    effect: { flapStun: 0.5 },
  },
  newNests: { name: 'New Nests', description: 'Two more nests to put ducks in!', icon: 'nest', max: 1, boss: true, effect: { nests: true } },
};

// A boss shrugs off most of Prickly Curtis (it loses this share of what other predators lose).
export const BOSS_PRICKLE = 0.25;

export const PERK_ORDER = Object.keys(PERKS) as PerkId[];

// How many perks you get to pick from each time.
export const PERK_CHOICES = 3;
