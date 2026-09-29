// Easy vs Normal. Easy must be playable (and winnable) by a 6-year-old.

export type Difficulty = 'easy' | 'normal';

export interface DifficultySettings {
  label: string;
  startingPeas: number; // peas at the start of the level
  hearts: number; // predators that can reach the duck house before you lose
  enemySpeed: number; // multiplies every predator's speed (0.5 = half speed)
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: {
    label: 'Easy',
    startingPeas: 350,
    hearts: 20,
    enemySpeed: 0.7,
  },
  normal: {
    label: 'Normal',
    startingPeas: 200, // enough for two ducks, since one can't stop a raccoon alone
    hearts: 10,
    enemySpeed: 1,
  },
};
