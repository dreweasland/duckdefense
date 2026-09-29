// Every sound in the game. To use a real recording instead of the built-in placeholder,
// put a file named after the sound in src/sounds/ (for example src/sounds/quack.mp3).
// See src/sounds/README.md for recording tips.

export type SoundKey =
  | 'splash'
  | 'peck'
  | 'flap'
  | 'quack'
  | 'nope'
  | 'chasedOff'
  | 'pea'
  | 'heartLost'
  | 'shoo'
  | 'place'
  | 'sell'
  | 'move'
  | 'noPeas'
  | 'waveStart'
  | 'waveCleared'
  | 'craig'
  | 'bossArrives'
  | 'whistle'
  | 'bossDefeated'
  | 'win'
  | 'lose'
  | 'tap';

export interface SoundInfo {
  when: string; // when it plays (so you know what to record)
  volume: number; // 0 to 1
}

export const SOUNDS: Record<SoundKey, SoundInfo> = {
  splash: { when: "Sunny's water ball hits", volume: 0.5 },
  peck: { when: 'Potato, Chester, or Curtis pecks', volume: 0.4 },
  flap: { when: "Potato's Wing Flap", volume: 0.6 },
  quack: { when: "Chester's Alarm Quack", volume: 0.8 },
  nope: { when: 'Curtis holds a predator ("Nope.")', volume: 0.6 },
  chasedOff: { when: 'A predator runs away', volume: 0.5 },
  pea: { when: 'A pea lands in the pea counter', volume: 0.4 },
  heartLost: { when: 'A predator gets into the duck house (should be funny!)', volume: 0.7 },
  shoo: { when: 'Craig shoos a predator away', volume: 0.6 },
  place: { when: 'A duck is placed in a nest', volume: 0.6 },
  sell: { when: 'A duck is sold', volume: 0.5 },
  move: { when: 'A duck hops to a new nest', volume: 0.5 },
  noPeas: { when: "Tapping a nest without enough peas", volume: 0.5 },
  waveStart: { when: 'The play button starts a wave', volume: 0.5 },
  waveCleared: { when: 'A wave is cleared', volume: 0.6 },
  craig: { when: "Craig's Guardian Blessing", volume: 0.7 },
  bossArrives: { when: 'The Night Bandit shows up', volume: 0.8 },
  whistle: { when: 'The Night Bandit whistles for minions', volume: 0.6 },
  bossDefeated: { when: 'The Night Bandit runs away', volume: 0.8 },
  win: { when: 'You win a level (a victory cheer!)', volume: 0.8 },
  lose: { when: 'You lose a level (should be silly, not sad)', volume: 0.7 },
  tap: { when: 'Tapping a button or a duck card', volume: 0.4 },
};

/** Sounds that can fire many times a second are limited to one per this many ms. */
export const MIN_GAP_MS: Partial<Record<SoundKey, number>> = {
  splash: 90,
  peck: 70,
  chasedOff: 80,
  pea: 60,
  quack: 150,
};
