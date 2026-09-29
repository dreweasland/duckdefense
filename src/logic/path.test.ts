import { describe, expect, it } from 'vitest';
import { joinPath, makePath, pointAt } from './path';

// An L-shaped path: 100 px right, then 50 px down.
const path = makePath([
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
]);

describe('path', () => {
  it('adds up the length of every segment', () => {
    expect(path.length).toBe(150);
  });

  it('finds points partway along a segment', () => {
    expect(pointAt(path, 40)).toEqual({ x: 40, y: 0 });
  });

  it('turns the corner onto the next segment', () => {
    expect(pointAt(path, 120)).toEqual({ x: 100, y: 20 });
  });

  it('stays at the ends when walking too far either way', () => {
    expect(pointAt(path, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAt(path, 999)).toEqual({ x: 100, y: 50 });
  });

  it('rejects a path with only one point', () => {
    expect(() => makePath([{ x: 0, y: 0 }])).toThrow();
  });

  it('joins from off the path to the nearest spot on it, then follows it to the end', () => {
    const route = joinPath({ x: 50, y: 30 }, path);
    expect(route.points).toEqual([{ x: 50, y: 30 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
    expect(route.length).toBe(30 + 50 + 50);
  });

  it('picks the spot closer to the house when two are equally near', () => {
    // (80, 20) is 20 px from the first stretch and 20 px from the second.
    const route = joinPath({ x: 80, y: 20 }, path);
    expect(route.points.slice(0, 2)).toEqual([{ x: 80, y: 20 }, { x: 100, y: 20 }]);
    expect(pointAt(route, route.length)).toEqual({ x: 100, y: 50 });
  });
});
