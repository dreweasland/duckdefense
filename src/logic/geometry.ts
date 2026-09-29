export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The point on segment a-b closest to p. */
export function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** The point on a line through `points` closest to p. */
export function closestPointOnPolyline(p: Point, points: readonly Point[]): Point {
  let best = points[0]!;
  for (let i = 1; i < points.length; i++) {
    const candidate = closestPointOnSegment(p, points[i - 1]!, points[i]!);
    if (distance(p, candidate) < distance(p, best)) best = candidate;
  }
  return best;
}
