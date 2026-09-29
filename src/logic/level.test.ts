import { describe, expect, it } from 'vitest';
import { FOUNTAIN } from '../data/dayNight';
import { DUCKS } from '../data/ducks';
import { HUD_AREAS, type Area } from '../data/layout';
import { LEVELS } from '../data/levels';
import { distance, type Point } from './geometry';
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

    it('keeps nests and the duck house out from under the buttons and counters', () => {
      for (const area of HUD_AREAS) {
        for (const slot of level.slots) expect(circleHitsArea(slot, NEST_RADIUS, area), JSON.stringify(slot)).toBe(false);
        expect(areasOverlap(houseBox(door), area)).toBe(false);
      }
    });
  });
}

describe('parseLevel', () => {
  it('explains what is missing when a layer is absent', () => {
    const map = JSON.stringify({ width: 1, height: 1, tilewidth: 40, tileheight: 40, layers: [] });
    expect(() => parseLevel(map)).toThrow('object layer named "path"');
  });
});
