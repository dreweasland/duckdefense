import Phaser from 'phaser';

/**
 * Cheaper rounded rectangles for Graphics.
 *
 * Phaser draws each corner of a rounded rectangle as an arc, and its WebGL renderer turns
 * every arc into 100 points and re-triangulates the whole shape every frame (Graphics has
 * no cache). The HUD is full of rounded rectangles (pills, cards, buttons), so that added up
 * to a couple of milliseconds a frame. These versions draw the same shape as a polygon with
 * a few points per corner, which looks identical at our sizes and costs a fraction.
 *
 * Installed once at startup (see main.ts), so every scene's `fillRoundedRect` and
 * `strokeRoundedRect` get it without changing any drawing code.
 */

/** Points per corner. 8 keeps the biggest corners in the game (radius 28) within a quarter of a unit of a true arc. */
const SEGMENTS = 8;

type Radius = number | { tl?: number; tr?: number; bl?: number; br?: number };

function corners(radius: Radius): { tl: number; tr: number; bl: number; br: number } {
  if (typeof radius === 'number') return { tl: radius, tr: radius, bl: radius, br: radius };
  return { tl: radius.tl ?? 20, tr: radius.tr ?? 20, bl: radius.bl ?? 20, br: radius.br ?? 20 };
}

/** The outline of a rounded rectangle, clockwise from the top-left corner. */
function outline(x: number, y: number, width: number, height: number, radius: Radius): Phaser.Geom.Point[] {
  const r = corners(radius);
  const points: Phaser.Geom.Point[] = [];
  // Each corner is a quarter circle around its center, swept from `from` for 90 degrees.
  const arc = (cx: number, cy: number, cr: number, from: number) => {
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = from + (Math.PI / 2) * (i / SEGMENTS);
      points.push(new Phaser.Geom.Point(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr));
    }
  };
  arc(x + r.tl, y + r.tl, r.tl, Math.PI);
  arc(x + width - r.tr, y + r.tr, r.tr, -Math.PI / 2);
  arc(x + width - r.br, y + height - r.br, r.br, 0);
  arc(x + r.bl, y + height - r.bl, r.bl, Math.PI / 2);
  return points;
}

export function installCheapRoundedRects(): void {
  const proto = Phaser.GameObjects.Graphics.prototype;
  proto.fillRoundedRect = function (this: Phaser.GameObjects.Graphics, x, y, width, height, radius = 20) {
    return this.fillPoints(outline(x, y, width, height, radius), true);
  };
  proto.strokeRoundedRect = function (this: Phaser.GameObjects.Graphics, x, y, width, height, radius = 20) {
    return this.strokePoints(outline(x, y, width, height, radius), true, true);
  };
}
