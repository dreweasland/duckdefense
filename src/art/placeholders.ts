import Phaser from 'phaser';
import type { DuckKind } from '../data/ducks';

// Placeholder shape art until the kids' drawings replace it. Each function
// returns a container centered on (x, y), roughly 50 px across.

const BLACK = 0x1f1f1f;
const WHITE = 0xf4f4f4;
const ORANGE_BILL = 0xe39b3a;

export function drawDuck(scene: Phaser.Scene, kind: DuckKind, x: number, y: number): Phaser.GameObjects.Container {
  const add = scene.add;
  switch (kind) {
    case 'sunny': // Blue Swedish: slate blue with a white bib
      return add.container(x, y, [
        add.ellipse(0, 4, 50, 40, 0x5b7fa6),
        add.ellipse(6, 10, 18, 16, WHITE),
        add.circle(10, -16, 14, 0x5b7fa6),
        add.ellipse(26, -14, 18, 8, 0x2f3b45),
        add.circle(14, -19, 3, 0x000000),
      ]);
    case 'potato': // Black Swedish with his signature untucked wing
      return add.container(x, y, [
        add.ellipse(-14, -14, 30, 14, 0x6b6b6b).setAngle(-40),
        add.ellipse(0, 4, 50, 40, BLACK),
        add.ellipse(6, 10, 18, 16, WHITE),
        add.circle(10, -16, 14, BLACK),
        add.ellipse(26, -14, 18, 8, 0x111111),
        add.circle(14, -19, 4, WHITE),
        add.circle(14, -19, 2, 0x000000),
      ]);
    case 'chester': // Magpie elder: white with a black cap and back
      return add.container(x, y, [
        add.ellipse(0, 4, 50, 40, WHITE).setStrokeStyle(2, 0xbbbbbb),
        add.ellipse(-10, 0, 26, 22, BLACK),
        add.circle(10, -16, 14, WHITE).setStrokeStyle(2, 0xbbbbbb),
        add.ellipse(10, -24, 26, 12, BLACK),
        add.ellipse(26, -14, 18, 8, ORANGE_BILL),
        add.circle(14, -17, 3, 0x000000),
      ]);
    case 'curtis': // Magpie, bigger and unbothered (half-closed eyes)
      return add.container(x, y, [
        add.ellipse(0, 4, 50, 40, WHITE).setStrokeStyle(2, 0xbbbbbb),
        add.ellipse(-8, 2, 30, 24, BLACK),
        add.circle(10, -16, 14, WHITE).setStrokeStyle(2, 0xbbbbbb),
        add.ellipse(10, -25, 20, 8, BLACK),
        add.ellipse(26, -14, 18, 8, ORANGE_BILL),
        add.rectangle(14, -17, 8, 3, 0x000000),
      ]).setScale(1.15);
  }
}

export function drawRaccoon(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const add = scene.add;
  return add.container(x, y, [
    add.circle(0, 0, 22, 0x7d7d7d),
    add.rectangle(0, -4, 40, 10, 0x222222),
    add.circle(-8, -4, 3, 0xffffff),
    add.circle(8, -4, 3, 0xffffff),
  ]);
}

/** A little green pea, for showing costs and the pea count. */
export function drawPea(scene: Phaser.Scene, x: number, y: number, radius = 10): Phaser.GameObjects.Arc {
  return scene.add.circle(x, y, radius, 0x7ccd4a).setStrokeStyle(2, 0x3f7a22);
}

/** A big, chunky tap target with a label. Calls onTap when pressed. */
export function drawBigButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: number,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const back = scene.add.rectangle(0, 0, 280, 100, color).setStrokeStyle(6, 0xffffff);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '44px',
      color: '#ffffff',
      stroke: '#1d3b2a',
      strokeThickness: 6,
    })
    .setOrigin(0.5);
  back.setInteractive({ useHandCursor: true }).once('pointerdown', onTap);
  return scene.add.container(x, y, [back, text]);
}

/** A hawk seen from above, facing right (+x). Rotate it to face where it's flying. */
export function drawHawk(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const add = scene.add;
  const brown = 0x7a5230;
  return add.container(x, y, [
    // Triangle points are measured from each triangle's top-left corner.
    add.triangle(-2, -12, 0, 24, 24, 24, 4, 0, brown), // wing, swept back
    add.triangle(-2, 12, 0, 0, 24, 0, 4, 24, brown), // other wing
    add.ellipse(0, 0, 34, 14, 0x9b6b3d),
    add.triangle(-20, 0, 0, 0, 10, 6, 0, 12, 0x5a3a1e),
    add.circle(14, 0, 7, 0xe8dcc8),
    add.triangle(21, 0, 0, 0, 6, 3, 0, 6, 0xf2c029),
  ]);
}

/** Craig, the family's first duck: a female mallard, glowing as a spirit guide. */
export function drawCraig(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const add = scene.add;
  const brown = 0xa0784f;
  return add.container(x, y, [
    add.circle(0, 0, 44, 0xfff3b0, 0.35),
    add.ellipse(0, 6, 54, 38, brown),
    add.ellipse(-8, 2, 30, 20, 0x7a5634),
    add.rectangle(-6, 12, 22, 7, 0x3355cc).setStrokeStyle(2, 0xffffff),
    add.circle(12, -14, 14, brown),
    add.rectangle(14, -16, 20, 3, 0x4a3320),
    add.ellipse(28, -12, 18, 8, 0xd9822b),
    add.circle(15, -18, 3, 0x000000),
  ]);
}

/** The solar-powered pond fountain: a stone basin with a spray that shows while it has power. */
export function drawFountain(
  scene: Phaser.Scene,
  x: number,
  y: number,
): { container: Phaser.GameObjects.Container; spray: Phaser.GameObjects.Container } {
  const add = scene.add;
  const spray = add.container(0, 0, [
    add.circle(0, -26, 6, 0xcfefff),
    add.circle(-10, -16, 4, 0xcfefff),
    add.circle(10, -16, 4, 0xcfefff),
    add.rectangle(0, -12, 4, 22, 0xcfefff),
  ]);
  scene.tweens.add({ targets: spray, scaleY: 1.25, duration: 300, yoyo: true, repeat: -1 });
  const container = add.container(x, y, [add.ellipse(0, 0, 44, 22, 0x9aa5ad).setStrokeStyle(3, 0x6c7780), spray]);
  return { container, spray };
}
