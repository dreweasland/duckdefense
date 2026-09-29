import Phaser from 'phaser';
import { closestPointOnPolyline, distance, type Point } from '../logic/geometry';
import type { Ellipse } from '../logic/level';
import { makePath, pointAt } from '../logic/path';
import { BACKDROP, DEPTH, RENDER_SCALE, WORLD, entityDepth } from '../ui/theme';

/** Small seeded random number generator, so scenery lands in the same spots every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How far past the world's edges the forest ring and patches reach (wide or tall screens). */
const OUTSKIRTS = 420;

export function drawGrass(scene: Phaser.Scene, seed: number): void {
  // Covers the whole backdrop so no edge ever shows, whatever the screen shape.
  scene.add
    .tileSprite(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height, 'grass')
    .setTileScale(1 / RENDER_SCALE)
    // Line the tile pattern up with the world's corner, so it looks the same as before.
    .setTilePosition(-BACKDROP.x * RENDER_SCALE, -BACKDROP.y * RENDER_SCALE)
    .setDepth(DEPTH.ground);

  // Soft light and shadow patches so the lawn isn't flat.
  const rng = seededRandom(seed);
  const g = scene.add.graphics().setDepth(DEPTH.ground);
  for (let i = 0; i < 28; i++) {
    const light = rng() < 0.5;
    g.fillStyle(light ? 0xfff6c0 : 0x1f4d1a, light ? 0.07 : 0.08).fillEllipse(
      -OUTSKIRTS + rng() * (WORLD.width + OUTSKIRTS * 2),
      -OUTSKIRTS + rng() * (WORLD.height + OUTSKIRTS * 2),
      160 + rng() * 260,
      110 + rng() * 180,
    );
  }
}

/**
 * A ring of forest and meadow just outside the world, seen on screens wider or taller
 * than 16:9. Nothing here is part of the level.
 */
export function drawOutskirts(scene: Phaser.Scene, seed: number): void {
  const rng = seededRandom(seed);
  const outside = (inset: number) => {
    for (;;) {
      const x = -OUTSKIRTS + rng() * (WORLD.width + OUTSKIRTS * 2);
      const y = -OUTSKIRTS + rng() * (WORLD.height + OUTSKIRTS * 2);
      if (x < -inset || x > WORLD.width + inset || y < -inset || y > WORLD.height + inset) return { x, y };
    }
  };
  const place = (key: string, count: number, inset: number, w: number, h: number, spin: boolean) => {
    for (let i = 0; i < count; i++) {
      const p = outside(inset);
      const scale = 0.85 + rng() * 0.35;
      const image = scene.add.image(p.x, p.y, key).setDisplaySize(w * scale, h * scale).setDepth(entityDepth(p.y));
      if (spin) image.setAngle(rng() * 360);
      else image.setFlipX(rng() < 0.5);
    }
  };
  place('tree', 40, 70, 160, 160, true);
  place('bush', 24, 30, 84, 70, false);
  place('rock', 10, 10, 44, 32, false);
  for (const key of ['flower-white', 'flower-pink', 'flower-purple']) place(key, 18, 0, 22, 22, true);
}

export function drawPath(scene: Phaser.Scene, points: Point[], seed: number): void {
  // Draw the path running on past its start, off into the forest, so it doesn't just end.
  const [first, second] = points;
  if (first && second) {
    const dir = unit(first, second);
    points = [{ x: first.x - dir.x * OUTSKIRTS, y: first.y - dir.y * OUTSKIRTS }, ...points];
  }
  const g = scene.add.graphics().setDepth(DEPTH.path);
  const layer = (width: number, color: number) => {
    g.lineStyle(width, color).strokePoints(points);
    g.fillStyle(color);
    points.forEach((p) => g.fillCircle(p.x, p.y, width / 2));
  };
  layer(60, 0x7a5530); // edge
  layer(50, 0xc99d64); // dirt
  layer(28, 0xd9b27c); // worn middle

  // Pebbles.
  const rng = seededRandom(seed);
  const path = makePath(points);
  for (let d = 0; d < path.length; d += 22) {
    const p = pointAt(path, d + rng() * 10);
    const x = p.x + (rng() - 0.5) * 38;
    const y = p.y + (rng() - 0.5) * 38;
    const size = 3 + rng() * 4;
    g.fillStyle(rng() < 0.5 ? 0xa57b4a : 0xe6c898).fillEllipse(x, y, size * 1.4, size);
  }
}

export function drawPond(scene: Phaser.Scene, pond: Ellipse, seed: number): void {
  const { center: c, radiusX: rx, radiusY: ry } = pond;
  const g = scene.add.graphics().setDepth(DEPTH.pond);
  g.fillStyle(0x000000, 0.15).fillEllipse(c.x, c.y + 6, rx * 2 + 36, ry * 2 + 36);
  g.fillStyle(0xdcc592).fillEllipse(c.x, c.y, rx * 2 + 30, ry * 2 + 30); // sandy shore
  g.lineStyle(3, 0xa8905c).strokeEllipse(c.x, c.y, rx * 2 + 30, ry * 2 + 30);
  g.fillStyle(0x2f7fc0).fillEllipse(c.x, c.y, rx * 2, ry * 2); // deep edge
  g.fillStyle(0x4aa3df).fillEllipse(c.x, c.y + 4, rx * 2 - 16, ry * 2 - 14);
  g.fillStyle(0x6cc0f0).fillEllipse(c.x, c.y + 8, rx * 2 - 70, ry * 2 - 50); // sunlit middle
  g.lineStyle(3, 0x1f5f94, 0.6).strokeEllipse(c.x, c.y, rx * 2, ry * 2);

  // Shimmering highlights.
  const shine = scene.add.graphics().setDepth(DEPTH.pond);
  shine.fillStyle(0xffffff, 1);
  shine.fillEllipse(c.x - rx * 0.45, c.y - ry * 0.5, rx * 0.4, 6);
  shine.fillEllipse(c.x + rx * 0.3, c.y + ry * 0.35, rx * 0.3, 5);
  shine.fillEllipse(c.x + rx * 0.55, c.y - ry * 0.3, rx * 0.15, 4);
  shine.setAlpha(0.3);
  scene.tweens.add({ targets: shine, alpha: 0.55, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

  const rng = seededRandom(seed);
  // Lily pads, kept away from the middle (where the fountain goes).
  for (let placed = 0, tries = 0; placed < 4 && tries < 60; tries++) {
    const a = rng() * Math.PI * 2;
    const r = 0.45 + rng() * 0.35;
    const x = c.x + Math.cos(a) * rx * r;
    const y = c.y + Math.sin(a) * ry * r;
    if (distance({ x, y }, c) < 55) continue;
    scene.add
      .image(x, y, placed === 0 ? 'lily-flower' : 'lily')
      .setDisplaySize(34, 34)
      .setAngle(rng() * 360)
      .setDepth(DEPTH.pond);
    placed++;
  }
  // Reeds around the rim.
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2;
    const x = c.x + Math.cos(a) * (rx + 8);
    const y = c.y + Math.sin(a) * (ry + 8);
    const reed = scene.add.image(x, y, 'reeds').setDisplaySize(30, 50).setOrigin(0.5, 0.9).setFlipX(rng() < 0.5);
    reed.setDepth(entityDepth(y));
  }
}

export interface DecorAvoid {
  path?: Point[];
  slots?: Point[];
  ponds?: Ellipse[];
  house?: Point;
  /** UI areas to keep clear. */
  blocked?: Rect[];
}

/** Scatters trees, bushes, rocks, and flowers wherever they won't get in the way. */
export function scatterDecor(scene: Phaser.Scene, avoid: DecorAvoid, seed: number): void {
  const rng = seededRandom(seed);
  const isClear = (p: Point, margin: number) => {
    if (avoid.path && distance(p, closestPointOnPolyline(p, avoid.path)) < 40 + margin) return false;
    if (avoid.slots?.some((s) => distance(p, s) < 48 + margin)) return false;
    if (avoid.house && distance(p, avoid.house) < 100 + margin) return false;
    for (const pond of avoid.ponds ?? []) {
      const dx = (p.x - pond.center.x) / (pond.radiusX + 28 + margin);
      const dy = (p.y - pond.center.y) / (pond.radiusY + 28 + margin);
      if (dx * dx + dy * dy < 1) return false;
    }
    for (const r of avoid.blocked ?? []) {
      if (p.x > r.x - margin && p.x < r.x + r.width + margin && p.y > r.y - margin && p.y < r.y + r.height + margin) {
        return false;
      }
    }
    return true;
  };
  const place = (
    key: string,
    count: number,
    margin: number,
    size: { w: number; h: number },
    pick: () => Point,
    options: { flip?: boolean; spin?: boolean } = {},
  ) => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 40; tries++) {
      const p = pick();
      if (!isClear(p, margin)) continue;
      const scale = 0.85 + rng() * 0.3;
      const image = scene.add
        .image(p.x, p.y, key)
        .setDisplaySize(size.w * scale, size.h * scale)
        .setDepth(entityDepth(p.y));
      if (options.flip) image.setFlipX(rng() < 0.5);
      if (options.spin) image.setAngle(rng() * 360);
      placed++;
    }
  };
  const anywhere = () => ({ x: rng() * WORLD.width, y: rng() * WORLD.height });
  const nearEdge = () => {
    const side = Math.floor(rng() * 3);
    if (side === 0) return { x: -20 + rng() * 60, y: 160 + rng() * 580 };
    if (side === 1) return { x: WORLD.width - 40 + rng() * 60, y: 160 + rng() * 580 };
    return { x: rng() * WORLD.width, y: WORLD.height - 20 + rng() * 50 };
  };

  place('tree', 6, 60, { w: 160, h: 160 }, nearEdge, { spin: true });
  place('bush', 9, 26, { w: 84, h: 70 }, anywhere, { flip: true });
  place('rock', 8, 14, { w: 44, h: 32 }, anywhere, { flip: true });
  for (const key of ['flower-white', 'flower-pink', 'flower-purple']) {
    place(key, 14, 4, { w: 22, h: 22 }, anywhere, { spin: true });
  }
}

function unit(from: Point, to: Point): Point {
  const length = distance(from, to) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/**
 * Tree canopy over the spot where predators appear, so they walk out of the woods
 * instead of popping into view on wide screens.
 */
export function drawPathEntrance(scene: Phaser.Scene, points: Point[], seed: number): void {
  const [start, next] = points;
  if (!start || !next) return;
  const rng = seededRandom(seed);
  const dir = unit(start, next);
  const side = { x: -dir.y, y: dir.x };
  // One tree right over the spawn point, with more around and behind it.
  const spots = [
    { back: 110, across: 0 },
    { back: 150, across: -95 },
    { back: 150, across: 95 },
    { back: 40, across: -72 },
    { back: 40, across: 72 },
    { back: -5, across: 0 },
  ];
  for (const { back, across } of spots) {
    const x = start.x - dir.x * back + side.x * across;
    const y = start.y - dir.y * back + side.y * across;
    scene.add
      .image(x, y, 'tree')
      .setDisplaySize(170, 170)
      .setAngle(rng() * 360)
      .setDepth(DEPTH.effects - 2); // above the predators walking underneath
  }
}
