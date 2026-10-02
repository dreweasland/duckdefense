import { describe, expect, it } from 'vitest';
import { FOUNTAIN } from '../data/dayNight';
import { DUCKS } from '../data/ducks';
import { ENDLESS } from '../data/endless';
import { ENDLESS_PERKS_AREA, ENDLESS_REPAIR_AREA, HUD_AREAS, type Area } from '../data/layout';
import { LEVELS } from '../data/levels';
import { distance, inEllipse, type Point } from './geometry';
import { parseLevel } from './level';
import { makePath, pointAt } from './path';

const NEST_RADIUS = 36;
// The duck house drawing covers roughly this box around the end of the path.
const houseBox = (door: Point): Area => ({ x: door.x - 75, y: door.y - 105, width: 150, height: 145 });

function circleHitsArea(c: Point, r: number, a: Area): boolean {
  const nx = Math.max(a.x, Math.min(c.x, a.x + a.width));
  const ny = Math.max(a.y, Math.min(c.y, a.y + a.height));
  return distance(c, { x: nx, y: ny }) < r;
}

function areasOverlap(a: Area, b: Area): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const [index, info] of LEVELS.entries()) {
  describe(`level ${index + 1}: ${info.name}`, () => {
    const level = parseLevel(info.map);
    const path = makePath(level.path);
    const samples = Array.from({ length: Math.ceil(path.length / 5) + 1 }, (_, i) => pointAt(path, i * 5));
    const door = level.path[level.path.length - 1]!;

    it('is the size of the game screen', () => {
      expect(level).toMatchObject({ width: 1280, height: 720 });
    });

    it('has a path, nests, and a pond', () => {
      expect(level.path.length).toBeGreaterThanOrEqual(2);
      expect(level.slots.length).toBeGreaterThanOrEqual(8);
      expect(level.ponds.length).toBeGreaterThanOrEqual(1);
    });

    it('starts the path off-screen, so predators walk in', () => {
      const start = level.path[0]!;
      expect(start.x < 0 || start.x > 1280 || start.y < 0 || start.y > 720).toBe(true);
    });

    it('has places for hawks to fly in from, if any wave has hawks', () => {
      const hasHawks = info.waves.some((w) => w.groups.some((g) => g.enemy === 'hawk'));
      if (hasHawks) expect(level.sky.length).toBeGreaterThan(0);
    });

    it('lets ducks that hit hawks reach every hawk route from at least two nests', () => {
      // Uses the shortest reach of any duck that can hit hawks (Potato), so every
      // hawk-hitter works near where hawks fly, including by the duck house.
      const reach = Math.min(...Object.values(DUCKS).filter((d) => d.canHitFlying).map((d) => d.range));
      for (const from of level.sky) {
        const route = makePath([from, door]);
        const points = Array.from({ length: Math.ceil(route.length / 5) + 1 }, (_, i) => pointAt(route, i * 5));
        const covering = level.slots.filter((slot) => points.some((p) => distance(slot, p) <= reach));
        expect(covering.length, `hawks from ${JSON.stringify(from)}`).toBeGreaterThanOrEqual(2);
      }
    });

    it("puts at least two nests inside the fountain's refreshing spray", () => {
      const fountain = level.ponds[0]!.center;
      const refreshed = level.slots.filter((slot) => distance(slot, fountain) <= FOUNTAIN.range);
      expect(refreshed.length).toBeGreaterThanOrEqual(2);
    });

    it('keeps every nest off the path', () => {
      for (const slot of level.slots) {
        for (const p of samples) expect(distance(slot, p)).toBeGreaterThan(55);
      }
    });

    it('keeps nests apart from each other', () => {
      level.slots.forEach((a, i) =>
        level.slots.slice(i + 1).forEach((b) => expect(distance(a, b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`).toBeGreaterThanOrEqual(75)),
      );
    });

    it('keeps nests out of the pond', () => {
      for (const slot of level.slots) {
        for (const pond of level.ponds) {
          const dx = (slot.x - pond.center.x) / (pond.radiusX + 40);
          const dy = (slot.y - pond.center.y) / (pond.radiusY + 40);
          expect(dx * dx + dy * dy, JSON.stringify(slot)).toBeGreaterThan(1);
        }
      }
    });

    it('keeps the pond (and its sandy shore) off the path', () => {
      for (const pond of level.ponds) {
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
          const edge = { x: pond.center.x + Math.cos(a) * (pond.radiusX + 15), y: pond.center.y + Math.sin(a) * (pond.radiusY + 15) };
          for (const p of samples) expect(distance(edge, p)).toBeGreaterThan(29);
        }
      }
    });

    it('puts every mud and bramble patch on the path, and keeps nests out of them', () => {
      for (const patch of [...level.mud, ...level.brambles]) {
        expect(samples.some((p) => inEllipse(p, patch)), `patch at ${JSON.stringify(patch.center)}`).toBe(true);
        for (const slot of level.slots) expect(inEllipse(slot, patch), JSON.stringify(slot)).toBe(false);
      }
    });

    it('keeps nests and the duck house out from under the buttons and counters', () => {
      for (const area of HUD_AREAS) {
        for (const slot of level.slots) expect(circleHitsArea(slot, NEST_RADIUS, area), JSON.stringify(slot)).toBe(false);
        expect(areasOverlap(houseBox(door), area)).toBe(false);
      }
    });
  });
}

describe('the Endless Pond map', () => {
  it('keeps nests out from under the Pond Perks counter and the fix-the-duck-house button', () => {
    const level = parseLevel(LEVELS[ENDLESS.level]!.map);
    for (const area of [ENDLESS_PERKS_AREA, ENDLESS_REPAIR_AREA]) {
      for (const slot of level.slots) expect(circleHitsArea(slot, NEST_RADIUS, area), JSON.stringify(slot)).toBe(false);
    }
  });
});

describe("the Endless Pond's extra nests (the New Nests boss reward)", () => {
  const level = parseLevel(LEVELS[ENDLESS.level]!.map);
  const path = makePath(level.path);
  const samples = Array.from({ length: Math.ceil(path.length / 5) + 1 }, (_, i) => pointAt(path, i * 5));
  const door = level.path[level.path.length - 1]!;

  it('are clear of the path, the pond, the other nests, the duck house, and the buttons', () => {
    const nests = ENDLESS.bonusNests;
    nests.forEach((nest, i) => {
      for (const p of samples) expect(distance(nest, p)).toBeGreaterThan(55);
      for (const other of [...level.slots, ...nests.slice(i + 1)]) expect(distance(nest, other)).toBeGreaterThanOrEqual(75);
      for (const pond of level.ponds) expect(inEllipse(nest, { ...pond, radiusX: pond.radiusX + 40, radiusY: pond.radiusY + 40 })).toBe(false);
      for (const area of [...HUD_AREAS, ENDLESS_PERKS_AREA, ENDLESS_REPAIR_AREA, houseBox(door)]) {
        expect(circleHitsArea(nest, NEST_RADIUS, area), JSON.stringify(nest)).toBe(false);
      }
    });
  });
});

describe('parseLevel', () => {
  const map = (slot: object) =>
    JSON.stringify({
      width: 32,
      height: 18,
      tilewidth: 40,
      tileheight: 40,
      layers: [
        { name: 'path', type: 'objectgroup', objects: [{ x: 0, y: 0, width: 0, height: 0, polyline: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }] },
        { name: 'slots', type: 'objectgroup', objects: [{ x: 50, y: 80, width: 0, height: 0, point: true, ...slot }] },
      ],
    });

  it('reads special nests from a nest point\'s class (or type, in older Tiled)', () => {
    expect(parseLevel(map({ class: 'hill' })).specialNests).toEqual([{ at: { x: 50, y: 80 }, kind: 'hill' }]);
    expect(parseLevel(map({ type: 'water' })).specialNests).toEqual([{ at: { x: 50, y: 80 }, kind: 'water' }]);
    expect(parseLevel(map({})).specialNests).toEqual([]);
  });

  it('explains which nest classes exist when one is misspelled', () => {
    expect(() => parseLevel(map({ class: 'hil' }))).toThrow('Nest classes can be: hill, water');
  });

  it('explains what is missing when a layer is absent', () => {
    const map = JSON.stringify({ width: 1, height: 1, tilewidth: 40, tileheight: 40, layers: [] });
    expect(() => parseLevel(map)).toThrow('object layer named "path"');
  });
});
