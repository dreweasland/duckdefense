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

export interface Level {
  width: number;
  height: number;
  /** Predators walk from path[0] to the last point, where the duck house is. */
  path: Point[];
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
  if (lines.length !== 1) {
    throw new Error(`The "path" layer needs exactly one polyline, but has ${lines.length}`);
  }
  const line = lines[0]!;
  const path = line.polyline!.map((p) => ({ x: line.x + p.x, y: line.y + p.y }));
  if (path.length < 2) {
    throw new Error('The path polyline needs at least 2 points');
  }

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
