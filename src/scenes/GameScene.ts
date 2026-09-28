import Phaser from 'phaser';
import level1 from '../../maps/level1.tmj?raw';
import { DUCKS } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import {
  createBattle,
  enemyPosition,
  placeDuck,
  spawnEnemy,
  step,
  type Battle,
  type BattleEvent,
} from '../logic/battle';
import type { Point } from '../logic/geometry';
import { parseLevel, type Level } from '../logic/level';
import { makePath } from '../logic/path';

// Placeholder colors until the kids' art arrives.
const COLORS = {
  path: 0xc2a36b,
  pond: 0x4aa3df,
  slot: 0xffffff,
  sunny: 0x5b7fa6,
  bib: 0xffffff,
  bill: 0x2f3b45,
  raccoon: 0x7d7d7d,
  mask: 0x222222,
  splash: 0x9fd8ff,
  house: 0x8b5a2b,
  roof: 0xc0392b,
  hpBack: 0x000000,
  hpFill: 0x6ee06e,
  go: 0x2ecc71,
};

const PATH_WIDTH = 48;
const SLOT_RADIUS = 34; // big tap targets for small fingers
const HP_BAR_WIDTH = 44;
const MAX_STEP = 0.1; // seconds; stops predators teleporting after a stalled frame

interface EnemySprite {
  body: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
}

type Phase = 'placing' | 'running' | 'done';

export class GameScene extends Phaser.Scene {
  private level!: Level;
  private battle!: Battle;
  private phase: Phase = 'placing';
  private enemySprites = new Map<number, EnemySprite>();
  private duckSprites = new Map<number, Phaser.GameObjects.Container>();
  private house!: Phaser.GameObjects.Container;
  private raccoonReachedHouse = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    // scene.restart() reuses this object, so reset everything here.
    this.level = parseLevel(level1);
    this.battle = createBattle(makePath(this.level.path));
    this.phase = 'placing';
    this.enemySprites.clear();
    this.duckSprites.clear();
    this.raccoonReachedHouse = false;

    this.drawPonds();
    this.drawPath();
    this.house = this.drawHouse(this.level.path[this.level.path.length - 1]!);
    this.level.slots.forEach((slot) => this.drawSlot(slot));
    this.drawGoButton();
  }

  update(_time: number, deltaMs: number): void {
    if (this.phase !== 'running') return;

    const events = step(this.battle, Math.min(deltaMs / 1000, MAX_STEP));
    events.forEach((event) => this.handleEvent(event));
    this.syncEnemySprites();

    if (this.battle.enemies.length === 0) {
      this.phase = 'done';
      this.time.delayedCall(700, () => this.showResult());
    }
  }

  // --- Map ---

  private drawPonds(): void {
    for (const pond of this.level.ponds) {
      this.add.ellipse(pond.center.x, pond.center.y, pond.radiusX * 2, pond.radiusY * 2, COLORS.pond);
    }
  }

  private drawPath(): void {
    const g = this.add.graphics();
    g.lineStyle(PATH_WIDTH, COLORS.path);
    g.strokePoints(this.level.path);
    // Round off the corners.
    g.fillStyle(COLORS.path);
    this.level.path.forEach((p) => g.fillCircle(p.x, p.y, PATH_WIDTH / 2));
  }

  private drawHouse(at: Point): Phaser.GameObjects.Container {
    const walls = this.add.rectangle(0, 0, 90, 70, COLORS.house);
    const roof = this.add.triangle(0, -55, 0, 40, 55, 0, 110, 40, COLORS.roof);
    const door = this.add.ellipse(0, 15, 30, 40, 0x3b2413);
    return this.add.container(at.x, at.y, [walls, roof, door]);
  }

  // --- Ducks ---

  private drawSlot(slot: Point): void {
    const circle = this.add
      .circle(slot.x, slot.y, SLOT_RADIUS, COLORS.slot, 0.2)
      .setStrokeStyle(3, COLORS.slot, 0.7)
      .setInteractive({ useHandCursor: true });
    const plus = this.add
      .text(slot.x, slot.y, '+', { fontFamily: 'Arial', fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0.8);

    circle.once('pointerdown', () => {
      circle.destroy();
      plus.destroy();
      this.placeSunny(slot);
    });
  }

  private placeSunny(at: Point): void {
    const duck = placeDuck(this.battle, 'sunny', at);
    const stats = DUCKS.sunny;

    // Faint ring so kids can see how far Sunny reaches.
    this.add.circle(at.x, at.y, stats.range).setStrokeStyle(2, 0xffffff, 0.25);

    const body = this.add.ellipse(0, 4, 50, 40, COLORS.sunny);
    const bib = this.add.ellipse(6, 10, 18, 16, COLORS.bib);
    const head = this.add.circle(10, -16, 14, COLORS.sunny);
    const bill = this.add.ellipse(26, -14, 18, 8, COLORS.bill);
    const eye = this.add.circle(14, -19, 3, 0x000000);
    const sprite = this.add.container(at.x, at.y, [body, bib, head, bill, eye]);
    this.duckSprites.set(duck.id, sprite);

    // Plop in.
    sprite.setScale(0);
    this.tweens.add({ targets: sprite, scale: 1, duration: 250, ease: 'Back.Out' });
  }

  // --- Predators ---

  private spawnRaccoon(): void {
    const enemy = spawnEnemy(this.battle, 'raccoon');

    const body = this.add.circle(0, 0, 22, COLORS.raccoon);
    const mask = this.add.rectangle(0, -4, 40, 10, COLORS.mask);
    const eyeL = this.add.circle(-8, -4, 3, 0xffffff);
    const eyeR = this.add.circle(8, -4, 3, 0xffffff);
    const hpBack = this.add.rectangle(0, -34, HP_BAR_WIDTH, 6, COLORS.hpBack, 0.6);
    const hpFill = this.add.rectangle(-HP_BAR_WIDTH / 2, -34, HP_BAR_WIDTH, 6, COLORS.hpFill).setOrigin(0, 0.5);
    const pos = enemyPosition(this.battle, enemy);
    const container = this.add.container(pos.x, pos.y, [body, mask, eyeL, eyeR, hpBack, hpFill]);

    this.enemySprites.set(enemy.id, { body: container, hpFill });
  }

  private syncEnemySprites(): void {
    for (const enemy of this.battle.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) continue;
      const pos = enemyPosition(this.battle, enemy);
      sprite.body.setPosition(pos.x, pos.y);
      sprite.hpFill.width = HP_BAR_WIDTH * Math.max(0, enemy.hp / ENEMIES[enemy.kind].maxHp);
    }
  }

  // --- Battle events ---

  private handleEvent(event: BattleEvent): void {
    switch (event.type) {
      case 'attack':
        this.showSplash(event.duckId, event.target);
        break;
      case 'defeated':
        this.removeEnemySprite(event.enemy.id, true);
        break;
      case 'reachedHouse':
        this.raccoonReachedHouse = true;
        this.removeEnemySprite(event.enemy.id, false);
        this.tweens.add({ targets: this.house, angle: { from: -6, to: 6 }, duration: 80, yoyo: true, repeat: 3 });
        break;
    }
  }

  private showSplash(duckId: number, at: Point): void {
    const duck = this.duckSprites.get(duckId);
    if (duck) {
      this.tweens.add({ targets: duck, scale: 1.15, duration: 80, yoyo: true });
    }
    const splash = this.add.circle(at.x, at.y, 8).setStrokeStyle(4, COLORS.splash);
    this.tweens.add({
      targets: splash,
      radius: DUCKS.sunny.splashRadius,
      alpha: 0,
      duration: 250,
      onComplete: () => splash.destroy(),
    });
  }

  private removeEnemySprite(id: number, ranAway: boolean): void {
    const sprite = this.enemySprites.get(id);
    if (!sprite) return;
    this.enemySprites.delete(id);
    this.tweens.add({
      targets: sprite.body,
      scale: ranAway ? 0 : 0.4,
      alpha: 0,
      angle: ranAway ? 360 : 0,
      duration: 400,
      onComplete: () => sprite.body.destroy(),
    });
  }

  // --- Buttons and results ---

  private drawGoButton(): void {
    const circle = this.add.circle(0, 0, 44, COLORS.go).setStrokeStyle(4, 0xffffff);
    const arrow = this.add.triangle(4, 0, 0, 0, 0, 36, 30, 18, 0xffffff);
    const button = this.add.container(1200, 70, [circle, arrow]);
    circle.setInteractive({ useHandCursor: true }).once('pointerdown', () => {
      button.destroy();
      this.phase = 'running';
      this.spawnRaccoon();
    });
    this.tweens.add({ targets: button, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
  }

  private showResult(): void {
    const { width, height } = this.scale;
    const message = this.raccoonReachedHouse
      ? 'Uh oh! The raccoon raided the snack bin!'
      : 'Hooray! The raccoon ran away!';

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35);
    this.add
      .text(width / 2, height / 2 - 60, message, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '48px',
        color: '#ffe066',
        stroke: '#3b2a00',
        strokeThickness: 8,
        align: 'center',
        wordWrap: { width: width - 160 },
      })
      .setOrigin(0.5);

    // Big "play again" button.
    const circle = this.add.circle(width / 2, height / 2 + 80, 56, COLORS.go).setStrokeStyle(4, 0xffffff);
    this.add
      .text(width / 2, height / 2 + 78, '↻', { fontFamily: 'Arial', fontSize: '72px', color: '#ffffff' })
      .setOrigin(0.5);
    circle.setInteractive({ useHandCursor: true }).once('pointerdown', () => this.scene.restart());
  }
}
