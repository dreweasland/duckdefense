// Predator variants: a twist on any predator, set on a wave's spawn group (`variant`).
// An Armored Raccoon is still a raccoon, just with a hard hat. Bosses never get them.
// The Endless Pond starts mixing them in from a certain wave (see src/data/endless.ts).

export type VariantKind = 'armored' | 'rabid' | 'sneaky' | 'regrow';

export interface VariantInfo {
  name: string; // goes in front of the predator's name: "Armored Raccoon"
  description: string; // shown with the predator's own words when you tap it in the preview
  tint: number; // the predator is tinted this color so you can tell
  peas: number; // multiplies the peas it drops (1.5 = half as many again)
  // What changes. Leave one out and it doesn't change.
  armor?: number; // added to its armor: every hit does this much less (but always at least 1)
  speed?: number; // multiplies its speed
  health?: number; // multiplies its health
  sneaky?: { spotRange: number; revealTime: number }; // hides in the grass like a mink (see enemies.ts)
  regrow?: {
    perSecond: number; // share of its full health it heals every second (0.08 = 8%)
    after: number; // once nothing has hit it for this many seconds
  };
}

export const VARIANTS: Record<VariantKind, VariantInfo> = {
  armored: {
    name: 'Armored',
    description: 'Wears a hard hat that blocks part of every hit. Big hits get through.',
    tint: 0xa9b8cc,
    peas: 1.5,
    armor: 3,
  },
  rabid: {
    name: 'Rabid',
    description: 'Runs nearly twice as fast, but falls over sooner. Curtis slows it down.',
    tint: 0xffa07a,
    peas: 1.5,
    speed: 1.7,
    health: 0.7,
  },
  sneaky: {
    name: 'Sneaky',
    description: "Hides in the grass like a mink. Chester's quack finds it.",
    tint: 0xb6e8a0,
    peas: 1.5,
    sneaky: { spotRange: 0.5, revealTime: 3 },
  },
  regrow: {
    name: 'Regrowing',
    description: 'Gets better when nobody is hitting it. Keep up the pecking!',
    tint: 0xd8b4ff,
    peas: 1.5,
    regrow: { perSecond: 0.08, after: 1.5 },
  },
};

export const VARIANT_ORDER = Object.keys(VARIANTS) as VariantKind[];
