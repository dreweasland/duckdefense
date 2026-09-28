// Duck stats. Distances are in pixels (the map is 1280 wide). Times are in seconds.

export type DuckKind = 'sunny';

export interface DuckStats {
  name: string;
  range: number; // how far away the duck can reach a predator
  damage: number; // how much health each hit takes off
  attackInterval: number; // seconds between hits (smaller = faster)
  splashRadius: number; // predators this close to the target get hit too (0 = no splash)
}

export const DUCKS: Record<DuckKind, DuckStats> = {
  // Sunny, the Blue Swedish veteran: steady all-rounder with a small splash.
  sunny: {
    name: 'Sunny',
    range: 150,
    damage: 12,
    attackInterval: 0.75,
    splashRadius: 40,
  },
};
