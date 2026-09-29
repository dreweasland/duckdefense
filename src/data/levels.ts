import level1 from '../../maps/level1.tmj?raw';
import level2 from '../../maps/level2.tmj?raw';
import level3 from '../../maps/level3.tmj?raw';
import { LEVEL1_WAVES, LEVEL2_WAVES, LEVEL3_WAVES, type Wave } from './waves';

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
];
