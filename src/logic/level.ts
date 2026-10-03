import { TILES, type NestKind } from '../data/tiles';
import type { Ellipse, Point } from './geometry';

export type { Ellipse } from './geometry';

// The parts of Tiled's .tmj format we use. Tiled writes much more; the rest is ignored.
interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  ellipse?: boolean;
  polyline?: Point[];
  type?: string; // Tiled's "Class" (called "Type" in older versions)
  class?: string;
}

interface TiledLayer {
  name: string;
  type: string;
  objects?: TiledObject[];
}

interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
}

// Every path has to end at the duck house. Tiled's snapping isn't perfect, so ends this close
// together count as the same spot (and are snapped to the first path's end).
export const PATH_END_TOLERANCE = 12;

export interface Level {
  width: number;
  height: number;
  /**
   * The first trail predators walk, from path[0] to the last point, where the duck house is.
   * (The same as paths[0]; most of the game only needs to know where the house is.)
   */
  path: Point[];
  /** Every trail, each ending at the duck house. Spawn groups pick one (see src/data/waves.ts). */
  paths: Point[][];
  /** Where ducks can be placed. */
  slots: Point[];
  ponds: Ellipse[];
  /** Where flying predators enter. They dive straight at the duck house. */
  sky: Point[];
  /** Mud patches on the path: ground predators slow down in them. */
  mud: Ellipse[];
  /** Bramble patches on the path: ground predators get prickled in them. */
  brambles: Ellipse[];
  /** Nests with something special about them (hill nests reach farther, waterside nests hit harder). */
  specialNests: { at: Point; kind: NestKind }[];
}

/** Turns the text of a Tiled .tmj file into a Level. See maps/README.md for the layer rules. */
export function parseLevel(tmjText: string): Level {
  const map = JSON.parse(tmjText) as TiledMap;

  const lines = requireLayer(map, 'path').filter((o) => o.polyline);
  if (lines.length === 0) {
    throw new Error('The "path" layer needs at least one polyline');
  }
  const paths = lines.map((line) => line.polyline!.map((p) => ({ x: line.x + p.x, y: line.y + p.y })));
  for (const trail of paths) {
    if (trail.length < 2) throw new Error('Every path polyline needs at least 2 points');
  }
  // Every trail ends at the duck house: the first trail's end.
  const house = paths[0]![paths[0]!.length - 1]!;
  for (const [i, trail] of paths.entries()) {
    const end = trail[trail.length - 1]!;
    if (Math.hypot(end.x - house.x, end.y - house.y) > PATH_END_TOLERANCE) {
      throw new Error(
        `Path ${i + 1} ends at (${end.x}, ${end.y}) but the duck house is at (${house.x}, ${house.y}): every path has to end at the duck house`,
      );
    }
    trail[trail.length - 1] = { ...house };
  }
  const path = paths[0]!;

  const slotObjects = requireLayer(map, 'slots').filter((o) => o.point);
  const slots = slotObjects.map((o) => ({ x: o.x, y: o.y }));
  const specialNests: Level['specialNests'] = [];
  for (const o of slotObjects) {
    const kind = o.class || o.type;
    if (!kind) continue;
    if (!(kind in TILES.nests)) {
      throw new Error(`A nest at (${o.x}, ${o.y}) has class "${kind}". Nest classes can be: ${Object.keys(TILES.nests).join(', ')}`);
    }
    specialNests.push({ at: { x: o.x, y: o.y }, kind: kind as NestKind });
  }
  if (slots.length === 0) {
    throw new Error('The "slots" layer needs at least one point');
  }

  const ellipses = (layer: string): Ellipse[] =>
    (findLayer(map, layer) ?? [])
      .filter((o) => o.ellipse)
      .map((o) => ({
        center: { x: o.x + o.width / 2, y: o.y + o.height / 2 },
        radiusX: o.width / 2,
        radiusY: o.height / 2,
      }));
  const ponds = ellipses('pond');

  const sky = (findLayer(map, 'sky') ?? []).filter((o) => o.point).map((o) => ({ x: o.x, y: o.y }));

  return {
    width: map.width * map.tilewidth,
    height: map.height * map.tileheight,
    path,
    paths,
    slots,
    ponds,
    sky,
    mud: ellipses('mud'),
    brambles: ellipses('brambles'),
    specialNests,
  };
}

function findLayer(map: TiledMap, name: string): TiledObject[] | undefined {
  return map.layers.find((l) => l.name === name && l.type === 'objectgroup')?.objects;
}

function requireLayer(map: TiledMap, name: string): TiledObject[] {
  const objects = findLayer(map, name);
  if (!objects) {
    throw new Error(`The map needs an object layer named "${name}"`);
  }
  return objects;
}
