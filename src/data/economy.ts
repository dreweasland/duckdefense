// Peas are the currency. Tweak these numbers to make the game easier or harder.

export type Difficulty = 'easy' | 'normal';

// How many peas you start each level with.
export const STARTING_PEAS: Record<Difficulty, number> = {
  easy: 300, // generous, so younger players can place lots of ducks right away
  normal: 150,
};
