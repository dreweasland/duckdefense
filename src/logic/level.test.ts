import { describe, expect, it } from 'vitest';
import level1 from '../../maps/level1.tmj?raw';
import { distance } from './geometry';
import { parseLevel } from './level';
import { makePath, pointAt } from './path';

describe('level 1', () => {
  const level = parseLevel(level1);

  it('is the size of the game screen', () => {
    expect(level).toMatchObject({ width: 1280, height: 720 });
  });

  it('has a path, slots, and a pond', () => {
    expect(level.path.length).toBeGreaterThanOrEqual(2);
    expect(level.slots.length).toBeGreaterThan(0);
    expect(level.ponds.length).toBe(1);
  });

  it('keeps every slot off the path', () => {
    const path = makePath(level.path);
    for (const slot of level.slots) {
      // Walk the path in small steps and check the slot never gets too close.
      for (let d = 0; d <= path.length; d += 5) {
        expect(distance(slot, pointAt(path, d))).toBeGreaterThan(55);
      }
    }
  });
});

describe('parseLevel', () => {
  it('explains what is missing when a layer is absent', () => {
    const map = JSON.stringify({ width: 1, height: 1, tilewidth: 40, tileheight: 40, layers: [] });
    expect(() => parseLevel(map)).toThrow('object layer named "path"');
  });
});
