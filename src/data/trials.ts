import type { Challenge } from './challenges';

// Level Trials: extra ways to beat a level once you've won it. Each one bends the rules
// (some ducks stay home, fewer peas, extra predators...) and earns a ribbon on the level's
// card. They use the same rules as the Daily Challenge twists, so anything a twist can do,
// a trial can do. One list per level, in level order; two trials each is a good number
// (the level sheet has room for three).
//
// The first trial on each level leaves Sunny out or picks a small team, so players learn
// what the other ducks are for. The second changes the rules some other way.
//
// The `id` is saved with your progress, so don't change one once the game is live
// (names and words are fine to change). Naming is a job for the chief quack officer.

export interface Trial extends Challenge {
  id: string;
}

export const TRIALS: Trial[][] = [
  // Level 1: Backyard Pond
  [
    {
      id: 'potatoPatrol',
      name: 'Potato Patrol',
      description: 'Only Potato is playing. Fast pecks and Wing Flaps!',
      ducks: ['potato'],
    },
    {
      id: 'fourDucks',
      name: 'Four Ducks',
      description: 'Only four ducks can be out at once. Make them count (upgrades help)!',
      maxDucks: 4,
    },
  ],
  // Level 2: Veggie Patch
  [
    {
      id: 'minkFinders',
      name: 'Mink Finders',
      description: "Only Chester and Potato are playing, with extra peas to start. Chester's quack finds the minks!",
      ducks: ['chester', 'potato'],
      startingPeas: 1.3,
    },
    {
      id: 'peaPinch',
      name: 'Pea Pinch',
      description: 'You start with half the peas. Every pea counts!',
      startingPeas: 0.5,
    },
  ],
  // Level 3: Night Woods
  [
    {
      id: 'sunnysDayOff',
      name: "Sunny's Day Off",
      description: 'Sunny is taking the day off. Curtis is never scared of the Night Bandit!',
      ducks: ['potato', 'chester', 'curtis'],
    },
    {
      id: 'darkestNight',
      name: 'Darkest Night',
      description: 'Every wave is at night, and the duck house only has half its hearts.',
      allNight: true,
      hearts: 0.5,
    },
  ],
  // Level 4: Hawk Hill
  [
    {
      id: 'hawkHunters',
      name: 'Hawk Hunters',
      description: 'Only Potato and Curtis are playing. Potato hits hawks, Curtis keeps his cool!',
      ducks: ['potato', 'curtis'],
    },
    {
      id: 'fragileHouse',
      name: 'Fragile House',
      description: 'The duck house only has a few hearts. Nothing gets through!',
      hearts: 0.3,
    },
  ],
  // Level 5: Fox Run
  [
    {
      id: 'foxTrot',
      name: 'Fox Trot',
      description: 'Every predator is faster, and only Sunny and Curtis are playing. Slow them down!',
      ducks: ['sunny', 'curtis'],
      enemySpeed: 1.25,
    },
    {
      id: 'foxRush',
      name: 'Fox Rush',
      description: 'Extra foxes dash in every wave!',
      extra: { enemy: 'fox', count: 3, every: 1.5, after: 2 },
    },
  ],
  // Level 6: Snapper Swamp
  [
    {
      id: 'noSplash',
      name: 'No Splash',
      description: "Sunny's staying home. Can pecks and quacks crack Old Snapper's shell?",
      ducks: ['potato', 'chester', 'curtis'],
    },
    {
      id: 'lightsOut',
      name: 'Lights Out',
      description: "Every wave is at night, and Craig's taking a nap. You're on your own!",
      allNight: true,
      noCraig: true,
    },
  ],
];

/** The trial with this id, if there is one, and which level it's on. */
export function findTrial(id: string): { trial: Trial; level: number } | undefined {
  for (const [level, trials] of TRIALS.entries()) {
    const trial = trials.find((t) => t.id === id);
    if (trial) return { trial, level };
  }
  return undefined;
}
