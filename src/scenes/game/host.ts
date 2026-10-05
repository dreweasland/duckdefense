import type Phaser from 'phaser';
import type { Difficulty } from '../../data/difficulty';
import type { EnemyKind } from '../../data/enemies';
import type { VariantKind } from '../../data/variants';
import type { Duck, Enemy } from '../../logic/battle';
import type { Game, PreviewEntry } from '../../logic/game';
import type { Point } from '../../logic/geometry';

// The game screen is built from parts (src/scenes/game/*.ts): the boss bar, Craig's hints,
// the Big Move buttons, the Endless Pond's extras, and so on. Each part gets the scene as a
// GameHost: a Phaser scene (for add, tweens, time...) plus the few shared things below.
// Keep this list short; a part that needs more than this probably wants to own it.

/** A placed duck's picture and its trimmings. */
export interface DuckSprite {
  root: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  range: Phaser.GameObjects.Arc;
  /** Gold chevrons showing how many upgrades the duck has. */
  badge: Phaser.GameObjects.Graphics;
  /** Display size before upgrades (ducks grow a little with each one). */
  baseSize: number;
  /** Blue glow while the fountain's spray is refreshing this duck. */
  refresh: Phaser.GameObjects.Image;
  /** The hat it's wearing (kept on its head every frame). */
  hat?: Phaser.GameObjects.Image;
  /** Endless Pond: a gold star showing its training level. */
  training?: Phaser.GameObjects.Container;
}

/** A predator's picture and its trimmings. */
export interface EnemySprite {
  root: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  ripple?: Phaser.GameObjects.Ellipse;
  hpBar: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
  dizzy: Phaser.GameObjects.Container;
  lastX: number;
  flashUntil: number;
  /** Its waddle (or wing flap), which plays in slow motion in mud. */
  waddle: Phaser.Tweens.Tween;
  /** When it next splashes in mud or gets prickled by brambles (so the effects come in little bursts). */
  nextTileFx: number;
}

/** The particle emitters, made once per level and reused. */
export interface Effects {
  splash: Phaser.GameObjects.Particles.ParticleEmitter;
  feathers: Phaser.GameObjects.Particles.ParticleEmitter;
  puff: Phaser.GameObjects.Particles.ParticleEmitter;
  stars: Phaser.GameObjects.Particles.ParticleEmitter;
  sparkles: Phaser.GameObjects.Particles.ParticleEmitter;
  fountainSpray: Phaser.GameObjects.Particles.ParticleEmitter;
  fireflies: Phaser.GameObjects.Particles.ParticleEmitter;
  mudSplash: Phaser.GameObjects.Particles.ParticleEmitter;
  thorns: Phaser.GameObjects.Particles.ParticleEmitter;
}

export interface GameHost extends Phaser.Scene {
  readonly state: Game;
  readonly difficulty: Difficulty;
  readonly fx: Effects;
  /** The duck house's picture (for effects around it). */
  readonly house: Phaser.GameObjects.Image;
  /** The pill showing the hearts (it bounces when they change). */
  readonly heartsPill: Phaser.GameObjects.Container;
  readonly enemySprites: ReadonlyMap<number, EnemySprite>;
  /** A placed duck and its picture, if it's still on the map. */
  duckSprite(duckId: number): { sprite: DuckSprite; duck: Duck } | undefined;
  addEnemySprite(enemy: Enemy): void;

  // Popups: one at a time. Opening one closes the last.
  /** The open card or panel, if any. Parts that open one set it, so the scene can close it. */
  popup?: Phaser.GameObjects.Container;
  /** Shows a card as the open popup; it fades away on its own after `life` milliseconds. */
  showPopup(popup: Phaser.GameObjects.Container, life: number): void;
  closePopup(): void;
  popIn(target: Phaser.GameObjects.Container): void;
  /** An invisible sheet over the whole screen that catches taps (to close a panel). */
  tapCatcher(depth: number, onTap: () => void): Phaser.GameObjects.Zone;
  /** Stops moving a duck, if one was being moved. */
  cancelMove(): void;

  // Feedback the whole screen shares.
  refreshHud(): void;
  showBanner(message: string, bonus?: number): void;
  flyPea(from: Point, amount: number): void;
  floatText(at: Point, message: string, color: string): void;
  /** An expanding ring, for splashes, quacks, and Big Moves. */
  ring(x: number, y: number, radius: number, color: number, duration: number): void;
  /** A predator's picture, fit inside a box. */
  enemyIcon(kind: EnemyKind, x: number, y: number, maxWidth: number, maxHeight: number, variant?: VariantKind): Phaser.GameObjects.Image;
  /** A "coming next" chip: the predator, how many, and NEW if it's the first time. */
  drawPreviewChip(entry: PreviewEntry, x: number, y: number, scale?: number): Phaser.GameObjects.Container;
  /** Draws a nest at a slot (the Endless Pond's New Nests perk adds some mid-game). */
  drawNest(slot: Point): void;
  /** The extra nests the New Nests perk would add on this map. */
  readonly bonusNests: readonly Point[];
}
