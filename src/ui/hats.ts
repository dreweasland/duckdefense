import Phaser from 'phaser';
import { HAT_SIZE, HAT_SPOT } from '../art/sprites';
import type { DuckKind } from '../data/ducks';
import type { HatKind } from '../data/hats';

/** A hat picture. Size and position it on a duck with placeHat. */
export function hatImage(scene: Phaser.Scene, hat: HatKind): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, `hat-${hat}`).setOrigin(0.5, HAT_SIZE.anchorY);
}

/**
 * Moves a hat onto a duck picture's head, following its size, facing, tilt, tint, and
 * see-through-ness. Call it again whenever the duck moves (GameScene does every frame).
 * The duck picture must use the default (centered) origin.
 */
export function placeHat(hat: Phaser.GameObjects.Image, duck: Phaser.GameObjects.Image): void {
  const size = duck.displayWidth;
  const flip = duck.flipX ? -1 : 1;
  const dx = HAT_SPOT.x * size * flip;
  const dy = HAT_SPOT.y * duck.displayHeight;
  const cos = Math.cos(duck.rotation);
  const sin = Math.sin(duck.rotation);
  const width = HAT_SPOT.width * size;
  hat
    .setPosition(duck.x + dx * cos - dy * sin, duck.y + dx * sin + dy * cos)
    .setDisplaySize(width, width * (HAT_SIZE.height / HAT_SIZE.width))
    .setFlipX(duck.flipX)
    .setRotation(duck.rotation)
    .setAlpha(duck.alpha)
    .setVisible(duck.visible);
  if (duck.isTinted) hat.setTint(duck.tintTopLeft);
  else hat.clearTint();
}

/** A duck picture wearing its hat (if any), as one container you can move, bob, and scale together. */
export function duckWithHat(
  scene: Phaser.Scene,
  kind: DuckKind,
  x: number,
  y: number,
  size: number,
  hat: HatKind | undefined,
): Phaser.GameObjects.Container {
  const duck = scene.add.image(0, 0, `duck-${kind}`).setDisplaySize(size, size);
  const parts: Phaser.GameObjects.GameObject[] = [duck];
  if (hat) {
    const image = hatImage(scene, hat);
    placeHat(image, duck);
    parts.push(image);
  }
  return scene.add.container(x, y, parts);
}
