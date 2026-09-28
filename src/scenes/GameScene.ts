import Phaser from 'phaser';
import level1 from '../../maps/level1.tmj?raw';
import { drawCraig, drawDuck, drawFountain, drawHawk, drawPea, drawRaccoon } from '../art/placeholders';
import { BATTERY, FOUNTAIN } from '../data/dayNight';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import { LEVEL1_WAVES } from '../data/waves';
import { chasePartner, enemyPosition, isFlying, type Enemy } from '../logic/battle';
import {
  buyDuck,
  canBuy,
  canUseBlessing,
  createGame,
  isNight,
  mapFromLevel,
  startWave,
  update,
  useBlessing,
  type Game,
  type GameEvent,
} from '../logic/game';
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
  night: 0x0b1a3a,
  battery: 0xffd43b,
  shield: 0xffe9a0,
  slowed: 0x9fd8ff,
  peckingLoop: 0xff7aa2,
};

// Draw order: the night sky darkens the map, but not the buttons and counters.
const DEPTH = { shield: 40, night: 50, floatText: 60, banner: 90, hud: 100 };

const TEXT_FONT = 'Arial Black, Arial, sans-serif';
const PATH_WIDTH = 48;
const SLOT_RADIUS = 34; // big tap targets for small fingers
const PICKER_RADIUS = 40;
const HP_BAR_WIDTH = 44;
const BATTERY_BAR_WIDTH = 150;
const NIGHT_ALPHA = 0.4;
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
  slowRing: Phaser.GameObjects.Arc;
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
  private shield!: Phaser.GameObjects.Arc;
  private goButton!: Phaser.GameObjects.Container;
  private craigButton!: Phaser.GameObjects.Container;
  private peasText!: Phaser.GameObjects.Text;
  private heartsText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private batteryFill!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private fountainSpray?: Phaser.GameObjects.Container;
  private peckingLoopLines!: Phaser.GameObjects.Graphics;
  private peckingLoopHearts: Phaser.GameObjects.Text[] = [];
  private shownNight = false;

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
    this.peckingLoopHearts = [];
    this.fountainSpray = undefined;

    this.drawPonds();
    this.drawPath();
    this.drawFountain();
    this.peckingLoopLines = this.add.graphics();
    this.house = this.drawHouse(this.level.path[this.level.path.length - 1]!);
    this.shield = this.add
      .circle(this.house.x, this.house.y - 10, 85, COLORS.shield, 0.35)
      .setStrokeStyle(4, 0xffffff, 0.8)
      .setDepth(DEPTH.shield)
      .setVisible(false);
    this.level.slots.forEach((slot) => this.drawSlot(slot));

    const { width, height } = this.scale;
    this.shownNight = isNight(this.state);
    this.nightOverlay = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.night, this.shownNight ? NIGHT_ALPHA : 0)
      .setDepth(DEPTH.night);

    this.drawPicker();
    this.drawHud();
    this.goButton = this.drawGoButton();
    this.craigButton = this.drawCraigButton();
    this.refreshHud();
  }

  update(_time: number, deltaMs: number): void {
    const events = update(this.state, Math.min(deltaMs / 1000, MAX_STEP));
    events.forEach((event) => this.handleEvent(event));
    this.syncEnemySprites();

    // These change smoothly, so update them every frame.
    this.batteryFill.width = BATTERY_BAR_WIDTH * (this.state.battery / BATTERY.capacity);
    this.fountainSpray?.setVisible(!!this.state.battle.fountain?.on);
    this.shield.setVisible(this.state.shieldTime > 0);

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

  private drawFountain(): void {
    const at = this.state.battle.fountain?.position;
    if (!at) return;
    // Faint ring showing how far the spray reaches.
    this.add.circle(at.x, at.y, FOUNTAIN.range).setStrokeStyle(2, COLORS.slowed, 0.35);
    this.fountainSpray = drawFountain(this, at.x, at.y).spray;
  }

  private drawHouse(at: Point): Phaser.GameObjects.Container {
    // Triangle points are measured from the triangle's top-left corner.
    const walls = this.add.rectangle(0, 0, 90, 70, COLORS.house);
    const roof = this.add.triangle(0, -55, 0, 40, 55, 0, 110, 40, COLORS.roof);
    const door = this.add.ellipse(0, 15, 30, 40, 0x3b2413);
    return this.add.container(at.x, at.y, [walls, roof, door]);
  }

  // --- HUD: peas, hearts, wave, day/night, battery ---

  private drawHud(): void {
    const style = { fontFamily: TEXT_FONT, fontSize: '32px', color: '#ffffff', stroke: '#1d3b2a', strokeThickness: 6 };
    drawPea(this, 600, 44, 14).setDepth(DEPTH.hud);
    this.peasText = this.add.text(622, 44, '', style).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.add.text(760, 44, '♥', { ...style, color: '#ff5c7a' }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.heartsText = this.add.text(782, 44, '', style).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.waveText = this.add.text(900, 44, '', style).setOrigin(0, 0.5).setDepth(DEPTH.hud);

    // Solar battery meter.
    const y = 90;
    this.add.text(600, y, '⚡', { ...style, fontSize: '22px', color: '#ffd43b' }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.add
      .rectangle(620, y, BATTERY_BAR_WIDTH, 16, 0x000000, 0.5)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(DEPTH.hud);
    this.batteryFill = this.add.rectangle(620, y, 0, 16, COLORS.battery).setOrigin(0, 0.5).setDepth(DEPTH.hud);
  }

  private refreshHud(): void {
    const game = this.state;
    this.peasText.setText(String(game.peas));
    this.heartsText.setText(String(game.hearts));
    const wave = Math.min(game.waveIndex + 1, game.waves.length);
    this.waveText.setText(`${isNight(game) ? '☾' : '☀'} Wave ${wave}/${game.waves.length}`);
    for (const button of this.pickerButtons) {
      button.container.setAlpha(canBuy(game, button.kind) ? 1 : 0.4);
      button.ring.setVisible(button.kind === this.selected);
    }
    this.goButton.setVisible(game.phase === 'building');
    this.craigButton.setAlpha(canUseBlessing(game) ? 1 : 0.3);

    // Fade the sky when the (next) wave switches between day and night.
    const night = isNight(game);
    if (night !== this.shownNight) {
      this.shownNight = night;
      this.tweens.add({ targets: this.nightOverlay, fillAlpha: night ? NIGHT_ALPHA : 0, duration: 1200 });
    }
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
      const parts: Phaser.GameObjects.GameObject[] = [ring, back, duck, pea, cost];
      if (DUCKS[kind].canHitFlying) {
        // A little hawk badge: this duck can hit flyers.
        const badge = this.add.circle(30, -28, 14, 0x87ceeb).setStrokeStyle(2, 0xffffff);
        parts.push(badge, drawHawk(this, 30, -28).setScale(0.4).setAngle(-90));
      }
      const container = this.add.container(x, y, parts).setDepth(DEPTH.hud);

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
      this.drawPeckingLoop();
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

  /** A pink line with a heart between each duck and the duck it chases (the Pecking Loop bonus). */
  private drawPeckingLoop(): void {
    this.peckingLoopLines.clear();
    for (const heart of this.peckingLoopHearts) {
      this.tweens.killTweensOf(heart);
      heart.destroy();
    }
    this.peckingLoopHearts = [];
    for (const duck of this.state.battle.ducks) {
      const partner = chasePartner(this.state.battle, duck);
      if (!partner) continue;
      const a = duck.position;
      const b = partner.position;
      this.peckingLoopLines.lineStyle(5, COLORS.peckingLoop, 0.8).lineBetween(a.x, a.y, b.x, b.y);
      const heart = this.add
        .text((a.x + b.x) / 2, (a.y + b.y) / 2, '♥', {
          fontFamily: TEXT_FONT,
          fontSize: '28px',
          color: '#ff7aa2',
          stroke: '#ffffff',
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      this.tweens.add({ targets: heart, scale: 1.3, duration: 500, yoyo: true, repeat: -1 });
      this.peckingLoopHearts.push(heart);
    }
  }

  // --- Predators ---

  private addEnemySprite(enemy: Enemy): void {
    const pos = enemyPosition(enemy);
    const body = this.add.container(pos.x, pos.y);
    const slowRing = this.add.circle(0, 0, 28).setStrokeStyle(4, COLORS.slowed, 0.9).setVisible(false);
    let art: Phaser.GameObjects.Container;
    if (isFlying(enemy)) {
      // Point the hawk at where it's diving.
      const [from, to] = enemy.path.points;
      art = drawHawk(this, 0, 0).setRotation(Math.atan2(to!.y - from!.y, to!.x - from!.x));
    } else {
      art = drawRaccoon(this, 0, 0);
    }
    const hpBack = this.add.rectangle(0, -34, HP_BAR_WIDTH, 6, COLORS.hpBack, 0.6);
    const hpFill = this.add.rectangle(-HP_BAR_WIDTH / 2, -34, HP_BAR_WIDTH, 6, COLORS.hpFill).setOrigin(0, 0.5);
    const dizzy = this.add
      .text(0, -52, '✦ ✦', { fontFamily: 'Arial', fontSize: '18px', color: '#ffe066' })
      .setOrigin(0.5)
      .setVisible(false);
    body.add([slowRing, art, hpBack, hpFill, dizzy]);
    this.enemySprites.set(enemy.id, { body, hpFill, dizzy, slowRing });
  }

  private syncEnemySprites(): void {
    for (const enemy of this.state.battle.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) continue;
      const pos = enemyPosition(enemy);
      sprite.body.setPosition(pos.x, pos.y);
      sprite.hpFill.width = HP_BAR_WIDTH * Math.max(0, enemy.hp / enemy.maxHp);
      sprite.dizzy.setVisible(enemy.stopTime > 0);
      sprite.slowRing.setVisible(enemy.slowed);
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
      case 'shooed':
        this.removeEnemySprite(event.enemy.id, true);
        this.floatText({ x: this.house.x, y: this.house.y - 100 }, 'Shoo!', '#fff3b0');
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
      .setOrigin(0.5)
      .setDepth(DEPTH.floatText);
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
        align: 'center',
        wordWrap: { width: width - 160 },
      })
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(DEPTH.banner);
    this.tweens.chain({
      targets: text,
      tweens: [
        { scale: 1, duration: 300, ease: 'Back.Out' },
        { alpha: 0, delay: 1200, duration: 400 },
      ],
      onComplete: () => text.destroy(),
    });
  }

  // --- Buttons ---

  private drawGoButton(): Phaser.GameObjects.Container {
    const circle = this.add.circle(0, 0, 44, COLORS.go).setStrokeStyle(4, 0xffffff);
    const arrow = this.add.triangle(4, 0, 0, 0, 0, 36, 30, 18, 0xffffff);
    const button = this.add.container(1200, 70, [circle, arrow]).setDepth(DEPTH.hud);
    circle.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (startWave(this.state)) this.refreshHud();
    });
    this.tweens.add({ targets: button, scale: 1.08, duration: 600, yoyo: true, repeat: -1 });
    return button;
  }

  /** Craig's Guardian Blessing: tap her once per level to shield the duck house. */
  private drawCraigButton(): Phaser.GameObjects.Container {
    const back = this.add.circle(0, 0, 50, 0x2c4a3a, 0.8).setStrokeStyle(4, COLORS.shield);
    const craig = drawCraig(this, 0, 4).setScale(0.8);
    const button = this.add.container(110, 640, [back, craig]).setDepth(DEPTH.hud);
    this.tweens.add({ targets: craig, y: -2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    back.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!useBlessing(this.state)) return;
      this.showBanner('Craig is watching over the duck house!');
      this.tweens.add({ targets: this.shield, scale: { from: 0, to: 1 }, duration: 400, ease: 'Back.Out' });
      this.refreshHud();
    });
    return button;
  }
}
