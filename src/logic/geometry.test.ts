import { describe, expect, it } from 'vitest';
import { closestPointOnPolyline, closestPointOnSegment } from './geometry';

describe('closest points', () => {
  it('drops straight onto a segment', () => {
    expect(closestPointOnSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 });
  });

  it('stops at the ends of a segment', () => {
    expect(closestPointOnSegment({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('finds the nearest part of a bent line', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(closestPointOnPolyline({ x: 14, y: 6 }, line)).toEqual({ x: 10, y: 6 });
  });
});
