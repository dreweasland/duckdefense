import type { DuckKind } from './ducks';

// Flock powers ("Big Moves" in the game): one per kind of duck, used by tapping its round
// button in the column down the right edge during a wave. A power is ready once a duck of that kind is out, then needs a
// rest (the cooldown, in seconds) after each use. Every duck of the kind joins in.
// Keep them big and dramatic: the point is to give the player something to do mid-wave.

export interface PowerInfo {
  name: string; // short, it goes on a banner
  description: string; // what it does, in a few words (shown when the button is tapped too soon)
  cooldown: number; // seconds between uses
}

export const POWERS: Record<DuckKind, PowerInfo> = {
  sunny: {
    name: 'Tidal Wave',
    description: 'Every Sunny throws a giant splash: predators in her reach take a huge hit and get soaked.',
    cooldown: 30,
  },
  potato: {
    name: 'Flap Storm',
    description: 'Every Potato flaps up a storm: predators in his reach are blown back and left dizzy.',
    cooldown: 25,
  },
  chester: {
    name: 'Mega Quack',
    description: 'QUAAACK! Every predator on the map freezes, and hiding ones are flushed out.',
    cooldown: 40,
  },
  curtis: {
    name: 'Hold the Line',
    description: 'For a while nothing scares the flock, and every predator trudges at half speed.',
    cooldown: 35,
  },
};

// What each power does. (Reach means the duck's own range, upgrades and nests included.)
export const POWER_EFFECTS = {
  tidalWave: {
    damage: 3, // times the Sunny's usual damage, to every predator in her reach
    soak: { speed: 0.6, time: 3 }, // then they move at this share of their speed for this long
  },
  flapStorm: {
    pushBack: 140, // pixels back along the path (heavy predators shrug off some of it)
    stun: 0.6, // seconds dizzy
  },
  megaQuack: {
    stunTime: 2.5, // seconds every predator on the map is frozen (quick ones shake it off sooner)
  },
  holdTheLine: {
    time: 6, // seconds it lasts
    slow: 0.5, // ground predators move at this share of their speed meanwhile
  },
};
