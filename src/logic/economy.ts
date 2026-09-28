import { STARTING_PEAS, type Difficulty } from '../data/economy';

export function startingPeas(difficulty: Difficulty): number {
  return STARTING_PEAS[difficulty];
}

export function canAfford(peas: number, cost: number): boolean {
  return peas >= cost;
}
