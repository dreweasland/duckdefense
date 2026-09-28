import { distance, type Point } from './geometry';

/** The route predators walk, from the first point to the last (the duck house). */
export interface Path {
  readonly points: readonly Point[];
  readonly length: number;
}

export function makePath(points: readonly Point[]): Path {
  if (points.length < 2) {
    throw new Error('A path needs at least 2 points');
  }
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1]!, points[i]!);
  }
  return { points, length };
}

/** Where you end up after walking `dist` pixels along the path. Clamped to the ends. */
export function pointAt(path: Path, dist: number): Point {
  const { points } = path;
  let remaining = Math.max(0, dist);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segment = distance(a, b);
    if (remaining <= segment) {
      const t = segment === 0 ? 0 : remaining / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segment;
  }
  const last = points[points.length - 1]!;
  return { x: last.x, y: last.y };
}
