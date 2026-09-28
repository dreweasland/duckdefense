import Phaser from 'phaser';
import level1 from '../../maps/level1.tmj?raw';
import { drawDuck, drawPea, drawRaccoon } from '../art/placeholders';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import { LEVEL1_WAVES } from '../data/waves';
import { enemyPosition, type Enemy } from '../logic/battle';
import { buyDuck, canBuy, createGame, mapFromLevel, startWave, update, type Game, type GameEvent } from '../logic/game';
import type { Point } from '../logic/geometry';
import { parseLevel, type Level } from '../logic/level';

// Placeholder colors until the kids' art arrives.
const COLORS = {
  path: 0xc2a36b,
  pond: 0x4aa3df,
  slot: 0xffffff,
  splash: 0x9fd8ff,
  quack: 0xffe066,
  house: 0x8b5a2b,
  roof: 0xc0392b,
  hpBack: 0x000000,
  hpFill: 0x6ee06e,
  go: 0x2ecc71,
  selected: 0xffe066,
};

const TEXT_FONT = 'Arial Black, Arial, sans-serif';
const PATH_WIDTH = 48;
const SLOT_RADIUS = 34; // big tap targets for small fingers
const PICKER_RADIUS = 40;
const HP_BAR_WIDTH = 44;
const MAX_STEP = 0.1; // seconds; stops predators teleporting after a stalled frame

// Said by the raccoon when it gets into the duck house. Losing a heart should be funny.
const RACCOON_QUIPS = ['Nom nom!', 'Yoink!', 'Snack time!', 'Crunch!', 'Mine now!'];

export interface GameSceneData {
  difficulty: Difficulty;
}

interface EnemySprite {
  body: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
  dizzy: Phaser.GameObjects.Text;
}

interface PickerButton {
  kind: DuckKind;
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
}

export class GameScene extends Phaser.Scene {
  private difficulty: Difficulty = 'easy';
  private level!: Level;
  private state!: Game;
  private selected: DuckKind = 'sunny';
  private enemySprites = new Map<number, EnemySprite>();
  private duckSprites = new Map<number, Phaser.GameObjects.Container>();
  private pickerButtons: PickerButton[] = [];
  private house!: Phaser.GameObjects.Container;
  private goButton!: Phaser.GameObjects.Container;
  private peasText!: Phaser.GameObjects.Text;
  private heartsText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  init(data: Partial<GameSceneData>): void {
    this.difficulty = data.difficulty ?? 'easy';
  }

  create(): void {
    // Scene restarts reuse this object, so reset everything here.
    this.level = parseLevel(level1);
    this.state = createGame(mapFromLevel(this.level), LEVEL1_WAVES, this.difficulty);
    this.selected = 'sunny';
    this.enemySprites.clear();
    this.duckSprites.clear();
    this.pickerButtons = [];

    this.drawPonds();
    this.drawPath();
    this.house = this.drawHouse(this.level.path[this.level.path.length - 1]!);
    this.level.slots.forEach((slot) => this.drawSlot(slot));
    this.drawPicker();
    this.drawHud();
    this.goButton = this.drawGoButton();
    this.refreshHud();
  }

  update(_time: number, deltaMs: number): void {
    const events = update(this.state, Math.min(deltaMs / 1000, MAX_STEP));
    events.forEach((event) => this.handleEvent(event));
    this.syncEnemySprites();
    if (events.length > 0) this.refreshHud();
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
    // Triangle points are measured from the triangle's top-left corner.
    const walls = this.add.rectangle(0, 0, 90, 70, COLORS.house);
    const roof = this.add.triangle(0, -55, 0, 40, 55, 0, 110, 40, COLORS.roof);
    const door = this.add.ellipse(0, 15, 30, 40, 0x3b2413);
    return this.add.container(at.x, at.y, [walls, roof, door]);
  }

  // --- HUD: peas, hearts, wave ---

  private drawHud(): void {
    const style = { fontFamily: TEXT_FONT, fontSize: '32px', color: '#ffffff', stroke: '#1d3b2a', strokeThickness: 6 };
    drawPea(this, 600, 44, 14);
    this.peasText = this.add.text(622, 44, '', style).setOrigin(0, 0.5);
    this.add.text(760, 44, '♥', { ...style, color: '#ff5c7a' }).setOrigin(0.5);
    this.heartsText = this.add.text(782, 44, '', style).setOrigin(0, 0.5);
    this.waveText = this.add.text(900, 44, '', style).setOrigin(0, 0.5);
  }

  private refreshHud(): void {
    const game = this.state;
    this.peasText.setText(String(game.peas));
    this.heartsText.setText(String(game.hearts));
    const wave = Math.min(game.waveIndex + 1, game.waves.length);
    this.waveText.setText(`Wave ${wave}/${game.waves.length}`);
    for (const button of this.pickerButtons) {
      button.container.setAlpha(canBuy(game, button.kind) ? 1 : 0.4);
      button.ring.setVisible(button.kind === this.selected);
    }
    this.goButton.setVisible(game.phase === 'building');
  }

  // --- Duck picker ---

  private drawPicker(): void {
    DUCK_ORDER.forEach((kind, i) => {
      const x = 55 + i * 95;
      const y = 50;
      const ring = this.add.circle(0, 0, PICKER_RADIUS + 5).setStrokeStyle(6, COLORS.selected);
      const back = this.add.circle(0, 0, PICKER_RADIUS, 0x000000, 0.25);
      const duck = drawDuck(this, kind, 0, 4).setScale(kind === 'curtis' ? 0.9 : 0.8);
      const pea = drawPea(this, -16, 48, 8);
      const cost = this.add
        .text(-4, 48, String(DUCKS[kind].cost), { fontFamily: TEXT_FONT, fontSize: '20px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      const container = this.add.container(x, y, [ring, back, duck, pea, cost]);

      back.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = kind;
        this.refreshHud();
      });
      this.pickerButtons.push({ kind, container, ring });
    });
  }

  // --- Placing ducks ---

  private drawSlot(slot: Point): void {
    const circle = this.add
      .circle(slot.x, slot.y, SLOT_RADIUS, COLORS.slot, 0.2)
      .setStrokeStyle(3, COLORS.slot, 0.7)
      .setInteractive({ useHandCursor: true });
    const plus = this.add
      .text(slot.x, slot.y, '+', { fontFamily: 'Arial', fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0.8);

    circle.on('pointerdown', () => {
      const duck = buyDuck(this.state, this.selected, slot);
      if (!duck) {
        // Not enough peas: wiggle the pea counter.
        this.tweens.add({ targets: this.peasText, x: '+=6', duration: 50, yoyo: true, repeat: 3 });
        return;
      }
      circle.destroy();
      plus.destroy();
      this.drawPlacedDuck(duck.id, duck.kind, slot);
      this.refreshHud();
    });
  }

  private drawPlacedDuck(id: number, kind: DuckKind, at: Point): void {
    // Faint ring so kids can see how far the duck reaches.
    this.add.circle(at.x, at.y, DUCKS[kind].range).setStrokeStyle(2, 0xffffff, 0.25);
    const sprite = drawDuck(this, kind, at.x, at.y);
    this.duckSprites.set(id, sprite);

    // Plop in.
    const scale = sprite.scale;
    sprite.setScale(0);
    this.tweens.add({ targets: sprite, scale, duration: 250, ease: 'Back.Out' });
  }

  // --- Predators ---

  private addEnemySprite(enemy: Enemy): void {
    const pos = enemyPosition(enemy);
    const body = drawRaccoon(this, pos.x, pos.y);
    const hpBack = this.add.rectangle(0, -34, HP_BAR_WIDTH, 6, COLORS.hpBack, 0.6);
    const hpFill = this.add.rectangle(-HP_BAR_WIDTH / 2, -34, HP_BAR_WIDTH, 6, COLORS.hpFill).setOrigin(0, 0.5);
    const dizzy = this.add
      .text(0, -52, '✦ ✦', { fontFamily: 'Arial', fontSize: '18px', color: '#ffe066' })
      .setOrigin(0.5)
      .setVisible(false);
    body.add([hpBack, hpFill, dizzy]);
    this.enemySprites.set(enemy.id, { body, hpFill, dizzy });
  }

  private syncEnemySprites(): void {
    for (const enemy of this.state.battle.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) continue;
      const pos = enemyPosition(enemy);
      sprite.body.setPosition(pos.x, pos.y);
      sprite.hpFill.width = HP_BAR_WIDTH * Math.max(0, enemy.hp / enemy.maxHp);
      sprite.dizzy.setVisible(enemy.stopTime > 0);
    }
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

  // --- Game events ---

  private handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'spawned':
        this.addEnemySprite(event.enemy);
        break;
      case 'attack':
        this.showAttack(event.duckId, event.target, event.wingFlap);
        break;
      case 'alarmQuack':
        this.showAlarmQuack(event.duckId);
        break;
      case 'held':
        this.showHeld(event.duckId);
        break;
      case 'defeated':
        this.removeEnemySprite(event.enemy.id, true);
        this.floatText(event.position, `+${ENEMIES[event.enemy.kind].peas}`, '#b6f28a');
        break;
      case 'reachedHouse':
        this.removeEnemySprite(event.enemy.id, false);
        this.showHouseRaid();
        break;
      case 'waveCleared':
        this.showBanner(`Wave ${event.waveIndex + 1} done!${event.bonus > 0 ? `  +${event.bonus}` : ''}`);
        break;
      case 'won':
      case 'lost':
        this.time.delayedCall(900, () =>
          this.scene.start('ResultScene', { won: event.type === 'won', difficulty: this.difficulty }),
        );
        break;
    }
  }

  private bounce(duckId: number): void {
    const duck = this.duckSprites.get(duckId);
    if (!duck || this.tweens.isTweening(duck)) return;
    this.tweens.add({ targets: duck, scale: duck.scale * 1.15, duration: 80, yoyo: true });
  }

  private showAttack(duckId: number, at: Point, wingFlap: boolean): void {
    this.bounce(duckId);
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const splashRadius = duck ? DUCKS[duck.kind].splashRadius : 0;
    const ring = this.add.circle(at.x, at.y, 8).setStrokeStyle(4, COLORS.splash);
    this.tweens.add({
      targets: ring,
      radius: Math.max(splashRadius, 20),
      alpha: 0,
      duration: 250,
      onComplete: () => ring.destroy(),
    });
    if (wingFlap) this.floatText(at, 'FLAP!', '#ffffff');
  }

  private showAlarmQuack(duckId: number): void {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    if (!duck) return;
    this.bounce(duckId);
    const { x, y } = duck.position;
    const ring = this.add.circle(x, y, 20).setStrokeStyle(6, COLORS.quack);
    this.tweens.add({
      targets: ring,
      radius: DUCKS[duck.kind].range,
      alpha: 0,
      duration: 500,
      onComplete: () => ring.destroy(),
    });
    this.floatText({ x, y: y - 30 }, 'QUACK!', '#ffe066');
  }

  private showHeld(duckId: number): void {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    if (duck) this.floatText({ x: duck.position.x, y: duck.position.y - 30 }, 'Nope.', '#ffffff');
  }

  private showHouseRaid(): void {
    this.tweens.add({
      targets: this.house,
      angle: { from: -6, to: 6 },
      duration: 80,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.house.setAngle(0),
    });
    const quip = RACCOON_QUIPS[Math.floor(Math.random() * RACCOON_QUIPS.length)]!;
    this.floatText({ x: this.house.x, y: this.house.y - 90 }, quip, '#ffffff');
    this.tweens.add({ targets: this.heartsText, scale: 1.4, duration: 120, yoyo: true });
  }

  private floatText(at: Point, message: string, color: string): void {
    const text = this.add
      .text(at.x, at.y, message, { fontFamily: TEXT_FONT, fontSize: '24px', color, stroke: '#1d3b2a', strokeThickness: 5 })
      .setOrigin(0.5);
    this.tweens.add({ targets: text, y: at.y - 40, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private showBanner(message: string): void {
    const { width, height } = this.scale;
    const text = this.add
      .text(width / 2, height / 2, message, {
        fontFamily: TEXT_FONT,
        fontSize: '56px',
        color: '#ffe066',
        stroke: '#3b2a00',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.chain({
      targets: text,
      tweens: [
        { scale: 1, duration: 300, ease: 'Back.Out' },
        { alpha: 0, delay: 1200, duration: 400 },
      ],
      onComplete: () => text.destroy(),
    });
  }

  // --- Start-wave button ---

  private drawGoButton(): Phaser.GameObjects.Container {
    const circle = this.add.circle(0, 0, 44, COLORS.go).setStrokeStyle(4, 0xffffff);
    const arrow = this.add.triangle(4, 0, 0, 0, 0, 36, 30, 18, 0xffffff);
    const button = this.add.container(1200, 70, [circle, arrow]);
    circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (startWave(this.state)) this.refreshHud();
    });
    this.tweens.add({ targets: button, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
    return button;
  }
}
