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
  | 'peaPile';

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
}

export interface PerkInfo {
  name: string;
  description: string;
  icon: string; // a picture from src/art/sprites.ts
  tint?: number; // a color for the picture (the star is white until tinted)
  max: number; // how many times it can be picked
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
};

export const PERK_ORDER = Object.keys(PERKS) as PerkId[];

// How many perks you get to pick from each time.
export const PERK_CHOICES = 3;
