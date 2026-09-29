import Phaser from 'phaser';
import { drawGrass, drawOutskirts, drawPath, drawPathEntrance, drawPond, scatterDecor } from '../art/terrain';
import { BATTERY, FOUNTAIN } from '../data/dayNight';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import { HUD_AREAS } from '../data/layout';
import { LEVELS } from '../data/levels';
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
import { closestPointOnPolyline, type Point } from '../logic/geometry';
import { parseLevel, type Level } from '../logic/level';
import { BACKDROP, COLORS, DEPTH, WORLD, entityDepth, setupCamera, textStyle } from '../ui/theme';
import { drawCard, drawPill, drawRoundButton, popSpeechBubble } from '../ui/widgets';

const DUCK_SIZE = 84;
const NEST_SIZE = 72;
const HP_BAR_WIDTH = 46;
const BATTERY_BAR_WIDTH = 88;
const BOSS_BAR_WIDTH = 360;
const NIGHT_ALPHA = 0.45;
const MAX_STEP = 0.1; // seconds; stops predators teleporting after a stalled frame

// HUD positions.
const PEA_ICON = { x: 596, y: 38 };
// Duck picker cards along the top-left, kept short so the path below stays visible.
const CARD = { width: 84, height: 90, y: 48, spacing: 92 };
const GO_BUTTON = { x: 1200, y: 70 };
const CRAIG_BUTTON = { x: 100, y: 640 };

// Said by the raccoon when it gets into the duck house. Losing a heart should be funny.
const RACCOON_QUIPS = ['Nom nom!', 'Yoink!', 'Snack time!', 'Crunch!', 'Mine now!'];

export interface GameSceneData {
  difficulty: Difficulty;
  /** Index into LEVELS (0 = the first level). */
  level?: number;
}

interface DuckSprite {
  root: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
}

interface EnemySprite {
  root: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  ripple?: Phaser.GameObjects.Ellipse;
  hpBar: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
  dizzy: Phaser.GameObjects.Container;
  lastX: number;
  flashUntil: number;
}

interface PickerCard {
  kind: DuckKind;
  container: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Graphics;
}

interface Effects {
  splash: Phaser.GameObjects.Particles.ParticleEmitter;
  feathers: Phaser.GameObjects.Particles.ParticleEmitter;
  puff: Phaser.GameObjects.Particles.ParticleEmitter;
  stars: Phaser.GameObjects.Particles.ParticleEmitter;
  sparkles: Phaser.GameObjects.Particles.ParticleEmitter;
  fountainSpray: Phaser.GameObjects.Particles.ParticleEmitter;
  fireflies: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class GameScene extends Phaser.Scene {
  private difficulty: Difficulty = 'easy';
  private levelIndex = 0;
  private level!: Level;
  private state!: Game;
  private selected: DuckKind = 'sunny';
  private duckSprites = new Map<number, DuckSprite>();
  private enemySprites = new Map<number, EnemySprite>();
  private pickerCards: PickerCard[] = [];
  private fx!: Effects;
  private house!: Phaser.GameObjects.Image;
  private shield!: Phaser.GameObjects.Container;
  private goButton!: Phaser.GameObjects.Container;
  private craigButton!: Phaser.GameObjects.Container;
  private craigGlow!: Phaser.GameObjects.Image;
  private peasText!: Phaser.GameObjects.Text;
  private heartsText!: Phaser.GameObjects.Text;
  private heartsPill!: Phaser.GameObjects.Container;
  private waveText!: Phaser.GameObjects.Text;
  private dayIcon!: Phaser.GameObjects.Image;
  private batteryFill!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private nightLights: Phaser.GameObjects.Image[] = [];
  private peckingLoop!: Phaser.GameObjects.Container;
  private shownNight = false;
  private bossBar?: { container: Phaser.GameObjects.Container; fill: Phaser.GameObjects.Rectangle; enemyId: number };

  constructor() {
    super('GameScene');
  }

  init(data: Partial<GameSceneData>): void {
    this.difficulty = data.difficulty ?? 'easy';
    this.levelIndex = Math.min(data.level ?? 0, LEVELS.length - 1);
  }

  create(): void {
    setupCamera(this);
    // Scene restarts reuse this object, so reset everything here.
    const info = LEVELS[this.levelIndex]!;
    this.level = parseLevel(info.map);
    this.state = createGame(mapFromLevel(this.level), info.waves, this.difficulty);
    this.selected = 'sunny';
    this.duckSprites.clear();
    this.enemySprites.clear();
    this.pickerCards = [];
    this.nightLights = [];
    this.bossBar = undefined;

    this.drawWorld();
    this.fx = this.createEffects();
    this.peckingLoop = this.add.container(0, 0).setDepth(DEPTH.entities - 0.5);
    this.level.slots.forEach((slot) => this.drawNest(slot));
    this.drawNight();
    this.drawShield();

    this.drawPicker();
    this.drawHud();
    this.goButton = this.drawGoButton();
    this.craigButton = this.drawCraigButton();
    this.refreshHud();
    this.time.delayedCall(350, () => this.showBanner(`Level ${this.levelIndex + 1}: ${info.name}`));
  }

  update(time: number, deltaMs: number): void {
    const events = update(this.state, Math.min(deltaMs / 1000, MAX_STEP));
    events.forEach((event) => this.handleEvent(event));
    this.syncEnemySprites(time);

    // These change smoothly, so update them every frame.
    const charge = this.state.battery / BATTERY.capacity;
    this.batteryFill.width = BATTERY_BAR_WIDTH * charge;
    this.batteryFill.fillColor = charge < 0.25 ? 0xff6b5a : COLORS.gold;
    this.fx.fountainSpray.emitting = !!this.state.battle.fountain?.on && this.state.phase === 'wave';
    const shielded = this.state.shieldTime > 0;
    this.shield.setVisible(shielded);
    this.fx.sparkles.emitting = shielded;

    if (events.length > 0) this.refreshHud();
  }

  // --- World -------------------------------------------------------------

  private drawWorld(): void {
    // Different seeds per level, so each level's scenery is different (but always the same).
    const seed = 11 + this.levelIndex * 100;
    drawGrass(this, seed);
    drawOutskirts(this, seed + 3);
    drawPath(this, this.level.path, seed + 1);
    drawPathEntrance(this, this.level.path, seed + 4);
    this.level.ponds.forEach((pond, i) => drawPond(this, pond, seed + 9 + i));

    const fountain = this.state.battle.fountain;
    if (fountain) {
      // Faint ring showing how far the spray reaches.
      this.add
        .circle(fountain.position.x, fountain.position.y, FOUNTAIN.range)
        .setStrokeStyle(3, COLORS.water, 0.3)
        .setDepth(DEPTH.pond);
      this.add.image(fountain.position.x, fountain.position.y, 'fountain').setDisplaySize(58, 58).setDepth(DEPTH.pond);
    }

    const door = this.level.path[this.level.path.length - 1]!;
    this.add.ellipse(door.x, door.y + 20, 150, 34, 0x000000, 0.2).setDepth(DEPTH.path);
    this.house = this.add
      .image(door.x, door.y + 22, 'house')
      .setDisplaySize(150, 144)
      .setOrigin(0.5, 0.88)
      .setDepth(entityDepth(door.y + 22));

    scatterDecor(
      this,
      { path: this.level.path, slots: this.level.slots, ponds: this.level.ponds, house: door, blocked: HUD_AREAS },
      seed + 2,
    );
  }

  private createEffects(): Effects {
    const burst = (texture: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number) =>
      this.add.particles(0, 0, texture, { emitting: false, ...config }).setDepth(depth);

    const fountainAt = this.state.battle.fountain?.position ?? { x: -100, y: -100 };
    return {
      splash: burst(
        'dot',
        {
          speed: { min: 60, max: 170 },
          angle: { min: 200, max: 340 },
          gravityY: 420,
          lifespan: 420,
          scale: { start: 0.55, end: 0 },
          tint: [0x9fd8ff, 0xffffff, 0x5bb3e8],
        },
        DEPTH.effects,
      ),
      feathers: burst(
        'feather',
        {
          speed: { min: 40, max: 130 },
          rotate: { min: 0, max: 360 },
          gravityY: 60,
          lifespan: 900,
          scale: { start: 0.6, end: 0.3 },
          alpha: { start: 1, end: 0 },
          tint: [0x30343b, 0x5b606a],
        },
        DEPTH.effects,
      ),
      puff: burst(
        'glow',
        {
          speed: { min: 20, max: 70 },
          lifespan: 550,
          scale: { start: 0.12, end: 0.3 },
          alpha: { start: 0.7, end: 0 },
          tint: 0xe8e4dc,
        },
        DEPTH.effects,
      ),
      stars: burst(
        'star',
        { speed: { min: 50, max: 140 }, lifespan: 500, scale: { start: 0.5, end: 0 }, tint: 0xffe066 },
        DEPTH.effects,
      ),
      sparkles: this.add
        .particles(this.house.x, this.house.y - 50, 'star', {
          emitting: false,
          emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 100) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          lifespan: 800,
          frequency: 90,
          scale: { start: 0.35, end: 0 },
          tint: [0xffe066, 0xffffff],
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(DEPTH.shield + 1),
      fountainSpray: this.add
        .particles(fountainAt.x, fountainAt.y - 6, 'dot', {
          emitting: false,
          speed: { min: 50, max: 110 },
          angle: { min: 250, max: 290 },
          gravityY: 260,
          lifespan: 650,
          frequency: 40,
          scale: { start: 0.4, end: 0.1 },
          alpha: { start: 0.9, end: 0 },
          tint: [0xcfefff, 0x9fd8ff],
        })
        .setDepth(DEPTH.pond + 0.5),
      fireflies: this.add
        .particles(0, 0, 'glow', {
          emitting: false,
          emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 130, WORLD.width, WORLD.height - 130) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          lifespan: 3200,
          frequency: 260,
          speed: { min: 4, max: 16 },
          scale: { start: 0.05, end: 0.02 },
          alpha: { values: [0, 1, 0.3, 1, 0] },
          tint: 0xfff27a,
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(DEPTH.lights),
    };
  }

  private drawNight(): void {
    this.shownNight = isNight(this.state);
    const alpha = this.shownNight ? 1 : 0;
    this.nightOverlay = this.add
      .rectangle(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height, COLORS.night, alpha * NIGHT_ALPHA)
      .setDepth(DEPTH.night);

    // Warm glow from the duck house window, and a cool glow from the fountain.
    const light = (x: number, y: number, size: number, tint: number) => {
      const image = this.add
        .image(x, y, 'glow')
        .setDisplaySize(size, size)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(alpha * 0.8)
        .setDepth(DEPTH.lights);
      this.nightLights.push(image);
    };
    light(this.house.x, this.house.y - 88, 120, 0xffc861);
    const fountain = this.state.battle.fountain;
    if (fountain) light(fountain.position.x, fountain.position.y, 150, 0x6cc0f0);
    this.fx.fireflies.emitting = this.shownNight;
  }

  private setNight(night: boolean): void {
    if (night === this.shownNight) return;
    this.shownNight = night;
    this.tweens.add({ targets: this.nightOverlay, fillAlpha: night ? NIGHT_ALPHA : 0, duration: 1400 });
    this.tweens.add({ targets: this.nightLights, alpha: night ? 0.8 : 0, duration: 1400 });
    this.fx.fireflies.emitting = night;
  }

  private drawShield(): void {
    const glow = this.add.image(0, 0, 'glow').setDisplaySize(260, 260).setTint(0xffe9a0).setAlpha(0.55);
    const ring = this.add.circle(0, 0, 105).setStrokeStyle(5, 0xfff3b0, 0.9);
    this.shield = this.add
      .container(this.house.x, this.house.y - 50, [glow, ring])
      .setDepth(DEPTH.shield)
      .setVisible(false);
    this.tweens.add({ targets: ring, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  // --- HUD ---------------------------------------------------------------

  private drawHud(): void {
    const hud = <T extends Phaser.GameObjects.Components.Depth>(obj: T): T => obj.setDepth(DEPTH.hud);

    // One row across the top: peas, hearts, wave (with day/night), solar battery.
    hud(drawPill(this, 635, 38, 120, 50));
    hud(this.add.image(PEA_ICON.x, PEA_ICON.y, 'icon-pea').setDisplaySize(32, 32));
    this.peasText = hud(this.add.text(616, 38, '', textStyle(30)).setOrigin(0, 0.5));

    this.heartsPill = this.add.container(755, 38).setDepth(DEPTH.hud);
    this.heartsPill.add(drawPill(this, 0, 0, 106, 50));
    this.heartsPill.add(this.add.image(-28, 0, 'icon-heart').setDisplaySize(32, 32));
    this.heartsText = this.add.text(-8, 0, '', textStyle(30)).setOrigin(0, 0.5);
    this.heartsPill.add(this.heartsText);

    hud(drawPill(this, 910, 38, 188, 50));
    this.dayIcon = hud(this.add.image(838, 38, 'icon-sun').setDisplaySize(34, 34));
    this.waveText = hud(this.add.text(860, 38, '', textStyle(28)).setOrigin(0, 0.5));

    hud(drawPill(this, 1077, 38, 134, 50));
    hud(this.add.image(1028, 38, 'icon-bolt').setDisplaySize(28, 28));
    hud(this.add.rectangle(1046, 38, BATTERY_BAR_WIDTH, 16, 0x000000, 0.45).setOrigin(0, 0.5));
    this.batteryFill = hud(this.add.rectangle(1046, 38, 0, 16, COLORS.gold).setOrigin(0, 0.5));
  }

  private refreshHud(): void {
    const game = this.state;
    this.peasText.setText(String(game.peas));
    this.heartsText.setText(String(game.hearts));
    const wave = Math.min(game.waveIndex + 1, game.waves.length);
    this.waveText.setText(`Wave ${wave}/${game.waves.length}`);
    const night = isNight(game);
    this.dayIcon.setTexture(night ? 'icon-moon' : 'icon-sun').setDisplaySize(34, 34);
    this.setNight(night);

    for (const picker of this.pickerCards) {
      const selected = picker.kind === this.selected;
      drawCard(picker.card, CARD.width, CARD.height, {
        border: selected ? COLORS.gold : COLORS.ink,
        borderWidth: selected ? 6 : 3,
      });
      picker.container.setAlpha(canBuy(game, picker.kind) ? 1 : 0.45);
      picker.container.y = selected ? CARD.y - 4 : CARD.y;
    }
    this.goButton.setVisible(game.phase === 'building');
    const blessing = canUseBlessing(game);
    this.craigButton.setAlpha(blessing ? 1 : 0.35);
    this.craigGlow.setVisible(blessing);
  }

  private drawPicker(): void {
    DUCK_ORDER.forEach((kind, i) => {
      const card = drawCard(this.add.graphics(), CARD.width, CARD.height);
      const duck = this.add.image(0, -12, `duck-${kind}`).setDisplaySize(62, 62);
      const pea = this.add.image(-18, 30, 'icon-pea').setDisplaySize(18, 18);
      const cost = this.add
        .text(-6, 30, String(DUCKS[kind].cost), textStyle(19, { color: COLORS.inkCss, strokeThickness: 0 }))
        .setOrigin(0, 0.5);
      const parts: Phaser.GameObjects.GameObject[] = [card, duck, pea, cost];
      if (DUCKS[kind].canHitFlying) {
        // Hawk badge: this duck can hit flyers.
        parts.push(this.add.circle(32, -36, 14, 0x87ceeb).setStrokeStyle(3, COLORS.ink));
        parts.push(this.add.image(32, -36, 'hawk').setDisplaySize(22, 22));
      }
      const hit = this.add.zone(0, 0, CARD.width, CARD.height).setInteractive({ useHandCursor: true });
      parts.push(hit);
      const container = this.add.container(50 + i * CARD.spacing, CARD.y, parts).setDepth(DEPTH.hud);
      hit.on('pointerdown', () => {
        this.selected = kind;
        this.tweens.add({ targets: duck, scale: duck.scale * 1.15, duration: 90, yoyo: true });
        this.refreshHud();
      });
      this.pickerCards.push({ kind, container, card });
    });
  }

  // --- Ducks -------------------------------------------------------------

  private drawNest(slot: Point): void {
    const nest = this.add.image(slot.x, slot.y + 10, 'nest').setDisplaySize(NEST_SIZE, NEST_SIZE * 0.8);
    nest.setDepth(entityDepth(slot.y - 20));
    const plus = this.add.text(slot.x, slot.y + 8, '+', textStyle(38, { weight: '700' })).setOrigin(0.5);
    plus.setDepth(entityDepth(slot.y - 19));
    this.tweens.add({ targets: plus, scale: 1.15, alpha: 0.75, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    nest.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const duck = buyDuck(this.state, this.selected, slot);
      if (!duck) {
        // Not enough peas: wiggle the pea counter.
        this.tweens.add({ targets: this.peasText, x: '+=6', duration: 50, yoyo: true, repeat: 3 });
        return;
      }
      nest.disableInteractive();
      this.tweens.killTweensOf(plus);
      plus.destroy();
      this.drawPlacedDuck(duck.id, duck.kind, slot);
      this.drawPeckingLoop();
      this.refreshHud();
    });
  }

  private drawPlacedDuck(id: number, kind: DuckKind, at: Point): void {
    const range = this.add.circle(at.x, at.y, DUCKS[kind].range).setStrokeStyle(2, 0xffffff, 0.22);
    range.setDepth(DEPTH.path + 0.5);

    const size = kind === 'curtis' ? DUCK_SIZE * 1.12 : DUCK_SIZE;
    const art = this.add.image(0, -size * 0.28, `duck-${kind}`).setDisplaySize(size, size);
    // Face the path.
    const nearest = closestPointOnPolyline(at, this.level.path);
    art.setFlipX(nearest.x < at.x);
    const root = this.add.container(at.x, at.y, [art]).setDepth(entityDepth(at.y));
    this.duckSprites.set(id, { root, art });

    // Plop in, then bob gently.
    root.setScale(0);
    this.tweens.add({ targets: root, scale: 1, duration: 280, ease: 'Back.Out' });
    this.tweens.add({ targets: art, y: art.y - 3, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.fx.puff.explode(6, at.x, at.y);
  }

  /** A pink line with a heart between each duck and the duck it chases (the Pecking Loop bonus). */
  private drawPeckingLoop(): void {
    this.tweens.killTweensOf(this.peckingLoop.list);
    this.peckingLoop.removeAll(true);
    const lines = this.add.graphics();
    this.peckingLoop.add(lines);
    for (const duck of this.state.battle.ducks) {
      const partner = chasePartner(this.state.battle, duck);
      if (!partner) continue;
      const a = duck.position;
      const b = partner.position;
      lines.lineStyle(5, COLORS.pink, 0.75).lineBetween(a.x, a.y, b.x, b.y);
      const heart = this.add
        .text((a.x + b.x) / 2, (a.y + b.y) / 2, '♥', textStyle(28, { color: '#ff7aa2', stroke: '#ffffff', strokeThickness: 5 }))
        .setOrigin(0.5);
      this.peckingLoop.add(heart);
      this.tweens.add({ targets: heart, scale: 1.3, duration: 500, yoyo: true, repeat: -1 });
    }
  }

  // --- Predators -----------------------------------------------------------

  private addEnemySprite(enemy: Enemy): void {
    const pos = enemyPosition(enemy);
    const flying = isFlying(enemy);
    const root = this.add.container(pos.x, pos.y);
    let art: Phaser.GameObjects.Image;
    let ripple: Phaser.GameObjects.Ellipse | undefined;
    if (flying) {
      // Hawks cast a shadow below them, and point where they're diving.
      root.add(this.add.ellipse(0, 36, 50, 16, 0x000000, 0.18));
      const [from, to] = enemy.path.points;
      art = this.add
        .image(0, 0, 'hawk')
        .setDisplaySize(88, 88)
        .setRotation(Math.atan2(to!.y - from!.y, to!.x - from!.x) + Math.PI / 2);
      this.tweens.add({ targets: art, scaleX: art.scaleX * 0.8, duration: 170, yoyo: true, repeat: -1 });
      root.setDepth(DEPTH.effects - 1);
    } else if (enemy.kind === 'bandit') {
      root.add(this.add.ellipse(0, 6, 124, 26, 0x000000, 0.25));
      ripple = this.add.ellipse(0, 6, 140, 34).setStrokeStyle(5, COLORS.water, 0.95).setVisible(false);
      root.add(ripple);
      art = this.add.image(0, 0, 'bandit').setDisplaySize(150, 112).setOrigin(0.5, 0.85);
      this.tweens.add({ targets: art, angle: { from: -3, to: 3 }, duration: 380, yoyo: true, repeat: -1 });
    } else {
      root.add(this.add.ellipse(0, 4, 64, 16, 0x000000, 0.2));
      // Water ripple at its feet while the fountain slows it.
      ripple = this.add.ellipse(0, 4, 78, 24).setStrokeStyle(4, COLORS.water, 0.95).setVisible(false);
      this.tweens.add({ targets: ripple, scale: 1.15, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
      root.add(ripple);
      art = this.add.image(0, 0, 'raccoon').setDisplaySize(92, 67).setOrigin(0.5, 0.85);
      this.tweens.add({ targets: art, angle: { from: -4, to: 4 }, duration: 220, yoyo: true, repeat: -1 });
    }
    root.add(art);

    const hpBack = this.add.rectangle(0, 0, HP_BAR_WIDTH + 4, 10, COLORS.ink).setOrigin(0.5);
    const hpFill = this.add.rectangle(-HP_BAR_WIDTH / 2, 0, HP_BAR_WIDTH, 6, 0x6ee06e).setOrigin(0, 0.5);
    const boss = !!ENEMIES[enemy.kind].boss;
    const hpBar = this.add.container(0, flying ? -50 : -66, [hpBack, hpFill]).setVisible(false);
    const dizzy = this.add
      .container(0, flying ? -40 : boss ? -104 : -60, [
        this.add.image(-12, 0, 'star').setDisplaySize(16, 16).setTint(0xffe066),
        this.add.image(12, 0, 'star').setDisplaySize(16, 16).setTint(0xffe066),
      ])
      .setVisible(false);
    this.tweens.add({ targets: dizzy, angle: 360, duration: 900, repeat: -1 });
    root.add([hpBar, dizzy]);
    // Fade in, so a predator entering near the edge of a wide screen doesn't pop into view.
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.enemySprites.set(enemy.id, { root, art, ripple, hpBar, hpFill, dizzy, lastX: pos.x, flashUntil: 0 });
  }

  private syncEnemySprites(time: number): void {
    for (const enemy of this.state.battle.enemies) {
      const sprite = this.enemySprites.get(enemy.id);
      if (!sprite) continue;
      const pos = enemyPosition(enemy);
      const flying = isFlying(enemy);
      if (!flying && Math.abs(pos.x - sprite.lastX) > 0.01) sprite.art.setFlipX(pos.x < sprite.lastX);
      sprite.lastX = pos.x;
      sprite.root.setPosition(pos.x, pos.y);
      if (!flying) sprite.root.setDepth(entityDepth(pos.y));

      const health = Math.max(0, enemy.hp / enemy.maxHp);
      // Bosses use the big bar at the bottom of the screen instead.
      const boss = this.bossBar?.enemyId === enemy.id;
      sprite.hpBar.setVisible(health < 1 && !boss);
      if (boss) this.bossBar!.fill.width = BOSS_BAR_WIDTH * health;
      sprite.hpFill.width = HP_BAR_WIDTH * health;
      sprite.hpFill.fillColor = health > 0.5 ? 0x6ee06e : health > 0.25 ? 0xffd23f : 0xff6b5a;
      sprite.dizzy.setVisible(enemy.stopTime > 0);

      sprite.ripple?.setVisible(enemy.slowed);
      // A quick red "ouch" tint when hit (keeps the art readable even when hit constantly).
      if (time < sprite.flashUntil) sprite.art.setTint(0xff9a9a);
      else sprite.art.clearTint();
    }
  }

  private removeEnemySprite(id: number, how: 'defeated' | 'house' | 'shooed'): void {
    const sprite = this.enemySprites.get(id);
    if (!sprite) return;
    this.enemySprites.delete(id);
    this.tweens.killTweensOf([sprite.root, sprite.art, ...(sprite.ripple ? [sprite.ripple] : [])]);
    sprite.root.setAlpha(1);
    const { root } = sprite;
    const done = () => root.destroy();
    if (how === 'defeated') {
      this.fx.puff.explode(10, root.x, root.y - 20);
      this.tweens.add({ targets: root, alpha: 0, scale: 0.5, y: root.y - 20, duration: 300, onComplete: done });
    } else if (how === 'house') {
      this.tweens.add({ targets: root, alpha: 0, scale: 0.3, x: this.house.x, y: this.house.y - 20, duration: 350, onComplete: done });
    } else {
      this.fx.sparkles.explode(12, root.x, root.y);
      this.tweens.add({ targets: root, alpha: 0, angle: 540, y: root.y - 90, duration: 600, onComplete: done });
    }
  }

  // --- Game events -----------------------------------------------------------

  private handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'spawned':
        this.addEnemySprite(event.enemy);
        if (ENEMIES[event.enemy.kind].boss) this.showBossEntrance(event.enemy);
        break;
      case 'summoned':
        this.showSummon(event.enemyId, event.minions);
        break;
      case 'attack':
        this.showAttack(event.duckId, event.target, event.hitIds, event.wingFlap);
        break;
      case 'alarmQuack':
        this.showAlarmQuack(event.duckId);
        break;
      case 'held':
        this.showHeld(event.duckId);
        break;
      case 'defeated':
        this.removeEnemySprite(event.enemy.id, 'defeated');
        this.flyPea(event.position, ENEMIES[event.enemy.kind].peas);
        if (ENEMIES[event.enemy.kind].boss) this.showBossGone(event.position, 'The Night Bandit ran away!');
        break;
      case 'reachedHouse':
        this.removeEnemySprite(event.enemy.id, 'house');
        this.showHouseRaid();
        if (ENEMIES[event.enemy.kind].boss) this.showBossGone(this.house, 'The Night Bandit raided the snacks!');
        break;
      case 'shooed':
        this.removeEnemySprite(event.enemy.id, 'shooed');
        popSpeechBubble(this, this.house.x, this.house.y - 150, 'Shoo!', DEPTH.floatText);
        if (ENEMIES[event.enemy.kind].boss) this.showBossGone(this.house, 'Craig shooed the Night Bandit!');
        break;
      case 'waveCleared':
        this.showBanner(`Wave ${event.waveIndex + 1} cleared!`, event.bonus);
        break;
      case 'won':
      case 'lost':
        this.time.delayedCall(1000, () =>
          this.scene.start('ResultScene', { won: event.type === 'won', difficulty: this.difficulty, level: this.levelIndex }),
        );
        break;
    }
  }

  private duckSprite(duckId: number): { sprite: DuckSprite; kind: DuckKind; position: Point } | undefined {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const sprite = this.duckSprites.get(duckId);
    return duck && sprite ? { sprite, kind: duck.kind, position: duck.position } : undefined;
  }

  private showAttack(duckId: number, target: Point, hitIds: number[], wingFlap: boolean): void {
    const found = this.duckSprite(duckId);
    if (!found) return;
    const { sprite, kind, position } = found;
    sprite.art.setFlipX(target.x < position.x);

    const flash = () => {
      for (const id of hitIds) {
        const enemy = this.enemySprites.get(id);
        if (enemy) enemy.flashUntil = this.time.now + 80;
      }
    };

    if (kind === 'sunny') {
      // A water ball, then a splash.
      const from = { x: position.x + (sprite.art.flipX ? -30 : 30), y: position.y - 36 };
      const ball = this.add.image(from.x, from.y, 'dot').setTint(0x5bb3e8).setDisplaySize(14, 14).setDepth(DEPTH.effects);
      this.tweens.add({
        targets: ball,
        x: target.x,
        y: target.y - 20,
        duration: 140,
        onComplete: () => {
          ball.destroy();
          flash();
          this.fx.splash.explode(12, target.x, target.y - 20);
          this.ring(target.x, target.y - 20, DUCKS.sunny.splashRadius, COLORS.water, 250);
        },
      });
    } else {
      // A quick lunge and peck.
      const dx = Math.sign(target.x - position.x) * 10;
      this.tweens.add({ targets: sprite.art, x: dx, duration: 70, yoyo: true });
      flash();
      this.ring(target.x, target.y - 20, 18, 0xffffff, 180);
    }

    if (wingFlap) {
      this.fx.feathers.explode(8, position.x, position.y - 30);
      this.floatText({ x: target.x, y: target.y - 50 }, 'FLAP!', '#ffffff');
    }
  }

  private ring(x: number, y: number, radius: number, color: number, duration: number): void {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(4, color).setDepth(DEPTH.effects);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration, onComplete: () => ring.destroy() });
  }

  private showAlarmQuack(duckId: number): void {
    const found = this.duckSprite(duckId);
    if (!found) return;
    const { sprite, position } = found;
    this.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.2, duration: 100, yoyo: true });
    const range = DUCKS.chester.range;
    this.ring(position.x, position.y - 30, range, COLORS.gold, 500);
    this.time.delayedCall(120, () => this.ring(position.x, position.y - 30, range * 0.7, COLORS.gold, 450));
    this.fx.stars.explode(10, position.x, position.y - 40);
    this.floatText({ x: position.x, y: position.y - 70 }, 'QUACK!', COLORS.goldCss);
  }

  private showHeld(duckId: number): void {
    const found = this.duckSprite(duckId);
    if (found) popSpeechBubble(this, found.position.x, found.position.y - 70, 'Nope.', DEPTH.floatText);
  }

  private showHouseRaid(): void {
    this.tweens.add({
      targets: this.house,
      angle: { from: -5, to: 5 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.house.setAngle(0),
    });
    const quip = RACCOON_QUIPS[Math.floor(Math.random() * RACCOON_QUIPS.length)]!;
    popSpeechBubble(this, this.house.x, this.house.y - 150, quip, DEPTH.floatText);
    this.tweens.add({ targets: this.heartsPill, scale: 1.25, duration: 110, yoyo: true });
  }

  /** A pea pops out of a chased-off predator and flies to the pea counter. */
  private flyPea(from: Point, amount: number): void {
    this.floatText({ x: from.x, y: from.y - 40 }, `+${amount}`, '#c8f59a');
    const pea = this.add.image(from.x, from.y - 20, 'icon-pea').setDisplaySize(22, 22).setDepth(DEPTH.hud + 1);
    this.tweens.add({
      targets: pea,
      x: PEA_ICON.x,
      y: PEA_ICON.y,
      duration: 650,
      ease: 'Cubic.In',
      onComplete: () => {
        pea.destroy();
        this.tweens.add({ targets: this.peasText, scale: 1.2, duration: 80, yoyo: true });
      },
    });
  }

  private floatText(at: Point, message: string, color: string): void {
    const text = this.add.text(at.x, at.y, message, textStyle(26, { color, weight: '700' })).setOrigin(0.5);
    text.setDepth(DEPTH.floatText);
    this.tweens.add({ targets: text, y: at.y - 40, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }

  private showBanner(message: string, bonus = 0): void {
    const text = this.add.text(0, 0, message, textStyle(44, { weight: '700' })).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [];
    let width = text.width + 70;
    if (bonus > 0) {
      const chip = this.add.container(text.width / 2 + 60, 0, [
        this.add.image(-22, 0, 'icon-pea').setDisplaySize(30, 30),
        this.add.text(-4, 0, `+${bonus}`, textStyle(32, { weight: '700', color: '#c8f59a' })).setOrigin(0, 0.5),
      ]);
      text.x -= 50;
      chip.x -= 50;
      parts.push(chip);
      width += 100;
    }
    const ribbon = this.add
      .graphics()
      .fillStyle(0x000000, 0.25)
      .fillRoundedRect(-width / 2, -34, width, 76, 38)
      .fillStyle(COLORS.gold)
      .fillRoundedRect(-width / 2, -40, width, 76, 38)
      .lineStyle(5, COLORS.ink)
      .strokeRoundedRect(-width / 2, -40, width, 76, 38);
    const banner = this.add
      .container(WORLD.width / 2, WORLD.height / 2, [ribbon, text, ...parts])
      .setDepth(DEPTH.banner)
      .setScale(0);
    this.tweens.chain({
      targets: banner,
      tweens: [
        { scale: 1, duration: 320, ease: 'Back.Out' },
        { alpha: 0, y: banner.y - 30, delay: 1300, duration: 400 },
      ],
      onComplete: () => banner.destroy(),
    });
  }

  // --- The Night Bandit ------------------------------------------------------

  private showBossEntrance(enemy: Enemy): void {
    this.showBanner('The Night Bandit is here!');
    this.cameras.main.shake(450, 0.004);

    // Big health bar along the bottom of the screen.
    const panel = this.add
      .graphics()
      .fillStyle(COLORS.panel, 0.8)
      .fillRoundedRect(-240, -23, 480, 46, 23)
      .lineStyle(3, 0xffffff, 0.3)
      .strokeRoundedRect(-240, -23, 480, 46, 23);
    const face = this.add.image(-208, -1, 'bandit').setDisplaySize(52, 39);
    const name = this.add.text(-174, -10, ENEMIES.bandit.name, textStyle(16)).setOrigin(0, 0.5);
    const back = this.add.rectangle(-174, 10, BOSS_BAR_WIDTH, 12, 0x000000, 0.5).setOrigin(0, 0.5);
    const fill = this.add.rectangle(-174, 10, BOSS_BAR_WIDTH, 12, 0xff6b5a).setOrigin(0, 0.5);
    // Sits along the very bottom edge, below where paths run.
    const container = this.add
      .container(WORLD.width / 2, WORLD.height - 20, [panel, face, name, back, fill])
      .setDepth(DEPTH.hud)
      .setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, y: container.y - 6, duration: 400 });
    this.bossBar = { container, fill, enemyId: enemy.id };

    const pos = enemyPosition(enemy);
    this.time.delayedCall(700, () => popSpeechBubble(this, pos.x, pos.y - 110, 'Snacks for me!', DEPTH.floatText));
  }

  private showSummon(bossId: number, minions: Enemy[]): void {
    const boss = this.enemySprites.get(bossId);
    if (boss) popSpeechBubble(this, boss.root.x, boss.root.y - 110, 'Tweet-tweet!', DEPTH.floatText);
    for (const minion of minions) {
      this.addEnemySprite(minion);
      const pos = enemyPosition(minion);
      this.fx.puff.explode(8, pos.x, pos.y - 20);
    }
  }

  private showBossGone(at: Point, message: string): void {
    this.fx.puff.explode(30, at.x, at.y - 40);
    this.fx.stars.explode(20, at.x, at.y - 40);
    this.showBanner(message);
    const bar = this.bossBar;
    this.bossBar = undefined;
    if (bar) this.tweens.add({ targets: bar.container, alpha: 0, duration: 400, onComplete: () => bar.container.destroy() });
  }

  // --- Buttons ---------------------------------------------------------------

  private drawGoButton(): Phaser.GameObjects.Container {
    const play = this.add
      .graphics()
      .fillStyle(0xffffff)
      .fillTriangle(-12, -18, -12, 18, 20, 0)
      .lineStyle(4, COLORS.ink)
      .strokeTriangle(-12, -18, -12, 18, 20, 0);
    const { container, hit } = drawRoundButton(this, GO_BUTTON.x, GO_BUTTON.y, 46, COLORS.green, COLORS.greenDark, [play]);
    container.setDepth(DEPTH.hud);
    hit.on('pointerdown', () => {
      if (!startWave(this.state)) return;
      this.tweens.add({ targets: container, scale: 0.85, duration: 80, yoyo: true });
      this.refreshHud();
    });
    this.tweens.add({ targets: play, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return container;
  }

  /** Craig's Guardian Blessing: tap her once per level to shield the duck house. */
  private drawCraigButton(): Phaser.GameObjects.Container {
    this.craigGlow = this.add.image(0, 0, 'glow').setDisplaySize(170, 170).setTint(0xffe066).setAlpha(0.6);
    this.tweens.add({ targets: this.craigGlow, alpha: 0.25, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const frame = this.add.circle(0, 0, 54, COLORS.cream).setStrokeStyle(6, COLORS.gold);
    const outline = this.add.circle(0, 0, 58).setStrokeStyle(3, COLORS.ink);
    const craig = this.add.image(4, -2, 'duck-craig').setDisplaySize(92, 92);
    this.tweens.add({ targets: craig, y: -6, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const button = this.add
      .container(CRAIG_BUTTON.x, CRAIG_BUTTON.y, [this.craigGlow, frame, outline, craig])
      .setDepth(DEPTH.hud);
    frame.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!useBlessing(this.state)) return;
      this.showBanner('Craig is watching over the duck house!');
      this.shield.setScale(0);
      this.tweens.add({ targets: this.shield, scale: 1, duration: 450, ease: 'Back.Out' });
      this.fx.sparkles.explode(30, this.house.x, this.house.y - 50);
      this.refreshHud();
    });
    return button;
  }
}
