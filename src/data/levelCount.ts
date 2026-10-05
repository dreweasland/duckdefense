import { LEVEL_WAVES } from './waves';

// How many levels there are. The leaderboard server uses this without loading the maps.
// A test checks it matches the LEVELS list in levels.ts, so add a level's waves to LEVEL_WAVES too.
export const LEVEL_COUNT = LEVEL_WAVES.length;
