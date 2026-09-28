import type { Point } from './geometry';

// The parts of Tiled's .tmj format we use. Tiled writes much more; the rest is ignored.
interface TiledObject {
  x: number;
  y: number;
  width: number;
  height: number;
  point?: boolean;
  ellipse?: boolean;
  polyline?: Point[];
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

export interface Ellipse {
  center: Point;
  radiusX: number;
  radiusY: number;
}

export interface Level {
  width: number;
  height: number;
  /** Predators walk from path[0] to the last point, where the duck house is. */
  path: Point[];
  /** Where ducks can be placed. */
  slots: Point[];
  ponds: Ellipse[];
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

  const slots = requireLayer(map, 'slots')
    .filter((o) => o.point)
    .map((o) => ({ x: o.x, y: o.y }));
  if (slots.length === 0) {
    throw new Error('The "slots" layer needs at least one point');
  }

  const ponds = (findLayer(map, 'pond') ?? [])
    .filter((o) => o.ellipse)
    .map((o) => ({
      center: { x: o.x + o.width / 2, y: o.y + o.height / 2 },
      radiusX: o.width / 2,
      radiusY: o.height / 2,
    }));

  return {
    width: map.width * map.tilewidth,
    height: map.height * map.tileheight,
    path,
    slots,
    ponds,
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
