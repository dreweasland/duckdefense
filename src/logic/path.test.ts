import { describe, expect, it } from 'vitest';
import { makePath, pointAt } from './path';

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
});
