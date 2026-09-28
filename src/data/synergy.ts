import type { DuckKind } from './ducks';

// The Pecking Loop, from the real flock: Sunny chases Chester, Potato chases
// Sunny, and Curtis ignores everyone. A duck placed near the duck it chases
// attacks faster.

export const CHASES: Partial<Record<DuckKind, DuckKind>> = {
  sunny: 'chester',
  potato: 'sunny',
};

export const PECKING_LOOP = {
  nearDistance: 250, // pixels between ducks to count as "near"
  attackSpeedBonus: 0.2, // +20% attack speed
};
