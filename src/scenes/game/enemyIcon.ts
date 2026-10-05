import type Phaser from 'phaser';
import type { EnemyKind } from '../../data/enemies';
import { VARIANTS, type VariantKind } from '../../data/variants';

/** A predator's picture, fit inside a box (hawks look down from above, so they get a square). */
export function enemyIcon(
  scene: Phaser.Scene,
  kind: EnemyKind,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  variant?: VariantKind,
): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, kind);
  const fit = Math.min(maxWidth / image.width, maxHeight / image.height);
  if (variant) image.setTint(VARIANTS[variant].tint);
  return image.setScale(fit);
}
