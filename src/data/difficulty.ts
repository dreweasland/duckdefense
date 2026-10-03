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
  scoreMultiplier: number; // the leaderboard score is multiplied by this
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy',
    startingPeas: 350,
    hearts: 20,
    enemySpeed: 0.7,
    enemyHealth: 1,
    scoreMultiplier: 1,
  },
  normal: {
    label: 'Normal',
    startingPeas: 200, // enough for two ducks, since one can't stop a raccoon alone
    hearts: 10,
    enemySpeed: 1,
    enemyHealth: 1,
    scoreMultiplier: 2,
  },
  // Hard: for players who've beaten Normal. Half the hearts (so a boss getting in is the end)
  // and quicker predators. `npm test` checks every level can still be won by a sensible team.
  hard: {
    label: 'Hard',
    startingPeas: 200,
    hearts: 5,
    enemySpeed: 1.1,
    enemyHealth: 1,
    scoreMultiplier: 3,
  },
};
