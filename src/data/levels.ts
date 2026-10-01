import level1 from '../../maps/level1.tmj?raw';
import level2 from '../../maps/level2.tmj?raw';
import level3 from '../../maps/level3.tmj?raw';
import level4 from '../../maps/level4.tmj?raw';
import level5 from '../../maps/level5.tmj?raw';
import level6 from '../../maps/level6.tmj?raw';
import { LEVEL1_WAVES, LEVEL2_WAVES, LEVEL3_WAVES, LEVEL4_WAVES, LEVEL5_WAVES, LEVEL6_WAVES, type Wave } from './waves';

// The levels, in the order you play them. To add one: make a map in maps/ with Tiled
// (see maps/README.md), write its waves in waves.ts, and add it to the end of this list.
// `npm test` checks every level loads, keeps its nests clear, and can be won on Easy.

export interface LevelInfo {
  name: string;
  map: string; // the .tmj file's text
  waves: Wave[];
}

export const LEVELS: LevelInfo[] = [
  { name: 'Backyard Pond', map: level1, waves: LEVEL1_WAVES },
  { name: 'Veggie Patch', map: level2, waves: LEVEL2_WAVES },
  { name: 'Night Woods', map: level3, waves: LEVEL3_WAVES },
  { name: 'Hawk Hill', map: level4, waves: LEVEL4_WAVES },
  { name: 'Fox Run', map: level5, waves: LEVEL5_WAVES },
  { name: 'Snapper Swamp', map: level6, waves: LEVEL6_WAVES },
];
