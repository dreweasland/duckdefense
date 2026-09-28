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
