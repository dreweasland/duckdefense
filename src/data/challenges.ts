import type { DuckKind } from './ducks';
import type { SpawnGroup } from './waves';

// Daily Challenge twists. Every day, everyone gets the same level with the same twist,
// and a leaderboard just for that day. Add a new twist to the end of the list and it
// joins the rotation. `npm test` checks every twist can still be won on Easy on every level.
// (Level Trials in src/data/trials.ts use the same rules, one level at a time.)

export interface Challenge {
  name: string; // short, it goes on a button
  description: string; // one sentence, shown when the level starts
  ducks?: DuckKind[]; // only these ducks can be placed (leave out for all of them)
  startingPeas?: number; // multiplies the starting peas (1.5 = half as many again)
  hearts?: number; // multiplies the hearts (0.5 = half as many)
  enemySpeed?: number; // multiplies every predator's speed
  allNight?: boolean; // every wave happens at night
  noSelling?: boolean; // placed ducks can't be sold (moving is fine)
  noCraig?: boolean; // Craig takes the day off
  maxDucks?: number; // only this many ducks can be out at once (sell one to place another)
  // Added to every wave, on top of the level's usual predators.
  extra?: SpawnGroup;
}

export const CHALLENGES: Challenge[] = [
  {
    name: 'Hawk Day',
    description: 'Extra hawks swoop in every wave. Bring ducks that can hit them!',
    extra: { enemy: 'hawk', count: 2, every: 3, after: 2 },
  },
  {
    name: 'Speedy Critters',
    description: 'Every predator is faster today, but you start with extra peas.',
    enemySpeed: 1.2,
    startingPeas: 1.3,
  },
  {
    name: 'All Night Long',
    description: 'Every wave is at night, so the sun never charges the fountain.',
    allNight: true,
  },
  {
    name: 'Blue Team',
    description: 'Only Sunny and Potato are playing today.',
    ducks: ['sunny', 'potato'],
  },
  {
    name: 'Magpie Club',
    description: 'Only Chester, Curtis, and Sunny are playing today.',
    ducks: ['sunny', 'chester', 'curtis'],
  },
  {
    name: 'Thin Wallet',
    description: 'You start with fewer peas. Spend them wisely!',
    startingPeas: 0.6,
  },
  {
    name: 'Glass House',
    description: 'The duck house only has half its hearts. Careful!',
    hearts: 0.5,
  },
  {
    name: 'No Take-Backs',
    description: "No selling ducks, and Craig is taking a nap. Plan ahead!",
    noSelling: true,
    noCraig: true,
  },
  {
    name: 'Turtle Parade',
    description: 'A snapping turtle climbs out of the pond every wave.',
    extra: { enemy: 'turtle', count: 1, every: 1, after: 3 },
  },
  {
    name: 'Mink Mischief',
    description: 'Sneaky minks join every wave. Chester can find them!',
    extra: { enemy: 'mink', count: 2, every: 2, after: 2 },
  },
  {
    name: 'Skunk Alert',
    description: "Skunks join every wave. Don't splash them! Potato pecks them off.",
    extra: { enemy: 'skunk', count: 2, every: 3, after: 3 },
  },
  {
    name: 'Hard Hats',
    description: 'Armored raccoons join every wave. Little pecks bounce off, so hit hard.',
    extra: { enemy: 'raccoon', count: 3, every: 2, after: 2, variant: 'armored' },
  },
];
