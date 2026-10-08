// Easy, Normal, and Hard. Easy must be playable (and winnable) by a 6-year-old.

export type Difficulty = 'easy' | 'normal' | 'hard';

/** The difficulties in order, easiest first (the order of the title screen's buttons). */
export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** Whether something (from a web address or a saved game, say) is one of the difficulties. */
export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

export interface DifficultySettings {
  label: string;
  startingPeas: number; // peas at the start of the level
  hearts: number; // predators that can reach the duck house before you lose
  enemySpeed: number; // multiplies every predator's speed (0.5 = half speed)
  enemyHealth: number; // multiplies every predator's health (1.2 = 20% tougher)
  peas: number; // multiplies the peas from chasing off predators and clearing waves (0.7 = a lot fewer)
  // Predators get tougher as a level goes on: by the last wave they have this much health
  // (on top of enemyHealth), ramping up evenly from the first wave. 1 = no ramp. Hits the end
  // of a level, where a good player has everything upgraded, without making the first waves
  // harder. (The Endless Pond ramps on its own and ignores this.)
  lateHealth: number;
  scoreMultiplier: number; // the leaderboard score is multiplied by this
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy',
    startingPeas: 350,
    hearts: 20,
    enemySpeed: 0.7,
    enemyHealth: 1,
    peas: 1,
    lateHealth: 1,
    scoreMultiplier: 1,
  },
  normal: {
    label: 'Normal',
    startingPeas: 200, // enough for two ducks, since one can't stop a raccoon alone
    hearts: 10,
    enemySpeed: 1,
    enemyHealth: 1,
    peas: 1,
    lateHealth: 1,
    scoreMultiplier: 2,
  },
  // Hard: for players who've beaten Normal. Half the hearts (so a boss getting in is the end),
  // quicker predators, fewer peas (so upgrades have to be chosen instead of bought for
  // everyone), and predators that keep getting tougher through the level, so a fully upgraded
  // flock is still tested by the last waves. `npm test` checks every level can be won by a
  // player who knows the game (a good team, upgrades in the best nests, Big Moves, Craig);
  // the simulator's wins are narrow, so raise these numbers only after making it smarter.
  hard: {
    label: 'Hard',
    startingPeas: 200,
    hearts: 5,
    enemySpeed: 1.1,
    enemyHealth: 1,
    peas: 0.8,
    lateHealth: 1.3,
    scoreMultiplier: 3,
  },
};
