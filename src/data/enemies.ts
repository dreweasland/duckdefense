// Predator stats. Speed is in pixels per second (the map is 1280 wide).

import type { DuckKind } from './ducks';

export type EnemyKind = 'raccoon' | 'fox' | 'mink' | 'turtle' | 'hawk' | 'bandit' | 'stormHawk' | 'silverFox' | 'oldSnapper';

export interface EnemyStats {
  name: string;
  // Shown when you tap a predator in the "coming next" preview. Keep it short and fun!
  description: string;
  beatenBy: DuckKind; // the duck whose picture shows as the best answer to it
  maxHp: number; // health when it arrives
  speed: number; // how fast it walks the path (Easy mode slows this down)
  peas: number; // peas you earn for chasing it off
  hearts: number; // hearts it costs if it reaches the duck house
  flying: boolean; // flyers skip the path and dive straight at the house
  boss?: boolean; // gets a big health bar and a dramatic entrance
  // What a boss says: when it shows up, and when it calls for help (if it does).
  quips?: { arrive: string; summon?: string };
  pushResistance?: number; // how much of a Wing Flap's knockback it shrugs off (0.8 = only moves 20%)
  stunResistance?: number; // how much of an Alarm Quack's freeze it shrugs off (0.6 = frozen 40% as long)
  armor?: number; // every hit does this much less damage (but always at least 1)
  fromPond?: boolean; // climbs out of the pond and cuts across to the path, instead of walking the whole way
  // Hides in the grass: ducks only spot it when it's close (spotRange x their reach), unless
  // Chester's Alarm Quack has flushed it out. Splash still hits it.
  sneaky?: {
    spotRange: number; // 0.5 = ducks spot it at half their usual reach
    revealTime: number; // seconds it stays spotted after an Alarm Quack
  };
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
    description: 'Hungry and sneaky. Wants the snacks in the duck house.',
    beatenBy: 'sunny',
    maxHp: 80,
    speed: 80,
    peas: 10,
    hearts: 1,
    flying: false,
  },

  // Fast and fragile. Too quick to stay frozen for long, so slow it down with Curtis instead.
  fox: {
    name: 'Fox',
    description: 'Super fast! Too quick to freeze for long. Curtis slows it down.',
    beatenBy: 'curtis',
    maxHp: 45,
    speed: 150,
    peas: 12,
    hearts: 1,
    flying: false,
    stunResistance: 0.6,
  },

  // Small and slippery: hides in the grass until it's close, or until Chester quacks.
  mink: {
    name: 'Mink',
    description: "Hides in the grass! Ducks only see it up close. Chester's quack finds it.",
    beatenBy: 'chester',
    maxHp: 55,
    speed: 95,
    peas: 14,
    hearts: 1,
    flying: false,
    sneaky: { spotRange: 0.5, revealTime: 3 },
  },

  // Slow, with a huge amount of health and a hard shell. Climbs out of the pond partway
  // along the path. Little pecks barely scratch it; Sunny's big splashes work best.
  turtle: {
    name: 'Snapping Turtle',
    description: 'Climbs out of the pond! Its shell blocks little pecks. Big splashes work best.',
    beatenBy: 'sunny',
    maxHp: 320,
    speed: 30,
    peas: 30,
    hearts: 1,
    flying: false,
    armor: 4,
    pushResistance: 0.6,
    fromPond: true,
  },

  // Flies in from a "sky" point on the map straight at the duck house.
  // Only ducks with canHitFlying can hit it.
  hawk: {
    name: 'Hawk',
    description: 'Flies straight at the duck house and scares ducks it swoops over.',
    beatenBy: 'potato',
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
    description: 'The boss! Whistles for raccoon friends and scares ducks. Curtis is not scared.',
    beatenBy: 'curtis',
    maxHp: 1200,
    speed: 40,
    peas: 200,
    hearts: 5,
    flying: false,
    boss: true,
    quips: { arrive: 'Snacks for me!', summon: 'Tweet-tweet!' },
    pushResistance: 0.8, // too heavy to push far, so Potato can't pin it in place
    scares: { radius: 150, time: 1.2, when: 'whistling' },
    summons: { enemy: 'raccoon', count: 2, every: 7 },
  },

  // Boss: a giant hawk. Only ducks that hit flyers can hurt it (Chester can still freeze it).
  // Calls in hawks and scares every duck it swoops near.
  stormHawk: {
    name: 'The Storm Hawk',
    description: 'A giant hawk! It calls more hawks and scares ducks. Sunny and Potato can hit it.',
    beatenBy: 'potato',
    maxHp: 700,
    speed: 50,
    peas: 200,
    hearts: 5,
    flying: true,
    boss: true,
    quips: { arrive: 'SCREEEE!', summon: 'Come, my hawks!' },
    pushResistance: 0.8,
    stunResistance: 0.3,
    scares: { radius: 120, time: 2, when: 'swooping' },
    summons: { enemy: 'hawk', count: 2, every: 6 },
  },

  // Boss: a fast, silvery fox who shrugs off nearly all of Chester's freeze and calls in
  // more foxes. Curtis's slow is the answer.
  silverFox: {
    name: 'The Silver Fox',
    description: "Super fast, and quacks barely freeze it! It calls more foxes. Curtis slows it down.",
    beatenBy: 'curtis',
    maxHp: 900,
    speed: 90,
    peas: 200,
    hearts: 5,
    flying: false,
    boss: true,
    quips: { arrive: 'Too slow, ducks!', summon: 'Yip yip!' },
    pushResistance: 0.8,
    stunResistance: 0.85,
    summons: { enemy: 'fox', count: 3, every: 6 },
  },

  // Boss: an enormous old snapping turtle from the pond. Its thick shell turns little pecks
  // into almost nothing, and nothing can push it back. Big splashes and trained ducks win.
  oldSnapper: {
    name: 'Old Snapper',
    description: 'A huge old turtle from the pond! Its shell blocks little pecks. Big splashes win.',
    beatenBy: 'sunny',
    maxHp: 2000,
    speed: 22,
    peas: 250,
    hearts: 5,
    flying: false,
    boss: true,
    quips: { arrive: 'SNAP. SNAP.' },
    armor: 6,
    pushResistance: 1,
    stunResistance: 0.5,
    fromPond: true,
  },
};
