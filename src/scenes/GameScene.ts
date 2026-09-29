import Phaser from 'phaser';
import { drawGrass, drawOutskirts, drawPath, drawPathEntrance, drawPond, scatterDecor } from '../art/terrain';
import { BATTERY, FOUNTAIN } from '../data/dayNight';
import type { Challenge } from '../data/challenges';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { CHASES } from '../data/synergy';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { GAME_SPEEDS } from '../data/gameSpeed';
import { TARGETING, TARGETING_ORDER, type Targeting } from '../data/targeting';
import { HUD_AREAS } from '../data/layout';
import { LEVELS } from '../data/levels';
import { chasePartner, enemyPosition, isFlying, isHidden, isRefreshed, type Enemy } from '../logic/battle';
import {
  buyDuck,
  callNextWave,
  canBuy,
  canCallEarly,
  canSell,
  earlyBonus,
  isDuckAllowed,
  canUpgrade,
  setTargeting,
  upgradeDuck,
  moveDuck,
  sellDuck,
  sellValue,
  canUseBlessing,
  createGame,
  isNight,
  isOver,
  mapFromLevel,
  wavePreview,
  startWave,
  update,
  useBlessing,
  type Game,
  type GameEvent,
} from '../logic/game';
import { closestPointOnPolyline, type Point } from '../logic/geometry';
import { parseLevel, type Level } from '../logic/level';
import { nameAt, nextUpgrade, statsAt } from '../logic/upgrades';
import { challengeSettings, dailyFor } from '../logic/daily';
import { dailyRecord, recordDailyWin, recordWin, scoreFor, starsFor } from '../logic/progress';
import { loadProgress, saveProgress } from '../save';
import type { ResultSceneData } from './ResultScene';
import { BACKDROP, COLORS, DEPTH, WORLD, entityDepth, setupCamera, textStyle } from '../ui/theme';
import { drawBigButton, drawCard, drawPill, drawRoundButton, drawSoundButton, popSpeechBubble } from '../ui/widgets';
import { playSound } from '../audio/sfx';

const DUCK_SIZE = 84;
const NEST_SIZE = 72;
const HP_BAR_WIDTH = 46;
const BATTERY_BAR_WIDTH = 88;
const BOSS_BAR_WIDTH = 360;
const SLOW_RING = 0xb08a58; // dusty ring at the feet of predators Curtis is slowing
const NIGHT_ALPHA = 0.45;
const MAX_STEP = 0.1; // seconds; stops predators teleporting after a stalled frame
const SIM_STEP = 1 / 60; // the rules always run in slices this small, so fast-forward plays out exactly the same

// The chosen fast-forward speed, remembered between waves and levels (until the page reloads).
let speedIndex = 0;

// HUD positions.
const PEA_ICON = { x: 596, y: 38 };
// Duck picker cards along the top-left, kept short so the path below stays visible.
// Low enough that the raised (selected) card and its corner badges never go off the top of the screen.
const CARD = { width: 84, height: 90, y: 54, spacing: 92, lift: 3 };
const GO_BUTTON = { x: 1200, y: 70 };
// "Coming next" chips, in a row that ends just left of the start button.
// Call the next wave early (during a wave, left of the fast-forward button).
const CALL_EARLY = { x: 1110, y: 112 };
const PREVIEW = { right: 1146, y: 112, chip: 58, gap: 4, maxWidth: 256 };
const CRAIG_BUTTON = { x: 100, y: 640 };

// How each walking predator looks: its picture's size, the shadow under it, and how it waddles.
const GROUND_LOOKS: Record<Exclude<EnemyKind, 'hawk' | 'bandit'>, { width: number; height: number; shadow: number; wobble: number; wobbleTime: number }> = {
  raccoon: { width: 92, height: 67, shadow: 64, wobble: 4, wobbleTime: 220 },
  fox: { width: 100, height: 68, shadow: 66, wobble: 5, wobbleTime: 140 },
  mink: { width: 88, height: 44, shadow: 60, wobble: 3, wobbleTime: 160 },
  turtle: { width: 110, height: 75, shadow: 90, wobble: 2, wobbleTime: 520 },
};
const HIDDEN_ALPHA = 0.45; // a mink hiding in the grass is see-through

// Said by the raccoon when it gets into the duck house. Losing a heart should be funny.
const RACCOON_QUIPS = ['Nom nom!', 'Yoink!', 'Snack time!', 'Crunch!', 'Mine now!'];

export interface GameSceneData {
  difficulty: Difficulty;
  /** Index into LEVELS (0 = the first level). */
  level?: number;
  /** Play the Daily Challenge for this date (YYYY-MM-DD) instead; the date picks the level. */
  daily?: string;
}

interface DuckSprite {
  root: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Image;
  range: Phaser.GameObjects.Arc;
  /** Gold chevrons showing how many upgrades the duck has. */
  badge: Phaser.GameObjects.Graphics;
  /** Display size before upgrades (ducks grow a little with each one). */
  baseSize: number;
  /** Blue glow while the fountain's spray is refreshing this duck. */
  refresh: Phaser.GameObjects.Image;
}

interface Nest {
  slot: Point;
  image: Phaser.GameObjects.Image;
  plus?: Phaser.GameObjects.Text;
  duckId?: number;
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
  /** The Daily Challenge being played, if any. */
  private daily?: { date: string; challenge: Challenge };
  private level!: Level;
  private state!: Game;
  private selected: DuckKind = 'sunny';
  private duckSprites = new Map<number, DuckSprite>();
  private enemySprites = new Map<number, EnemySprite>();
  private pickerCards: PickerCard[] = [];
  private nests: Nest[] = [];
  /** The panel shown for a tapped duck (or the info card for a tapped picker card). */
  private popup?: Phaser.GameObjects.Container;
  private popupTimer?: Phaser.Time.TimerEvent;
  private focusedDuckId?: number;
  /** While moving a duck: its id, and the things drawn to show where it can go. */
  private moving?: { duckId: number; marks: Phaser.GameObjects.GameObject[] };
  private fx!: Effects;
  private house!: Phaser.GameObjects.Image;
  private shield!: Phaser.GameObjects.Container;
  private goButton!: Phaser.GameObjects.Container;
  private speedButton!: { container: Phaser.GameObjects.Container; draw: () => void };
  private callEarlyButton!: { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text };
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
  /** Banners waiting to be shown, so two never land on top of each other. */
  private bannerQueue: { message: string; bonus: number }[] = [];
  private bannerShowing = false;
  private preview!: Phaser.GameObjects.Container;
  /** Which wave the preview is showing, so it's only rebuilt when that changes. */
  private previewKey = '';
  private bossBar?: { container: Phaser.GameObjects.Container; fill: Phaser.GameObjects.Rectangle; enemyId: number };

  constructor() {
    super('GameScene');
  }

  init(data: Partial<GameSceneData>): void {
    this.difficulty = data.difficulty ?? 'easy';
    this.levelIndex = Math.min(data.level ?? 0, LEVELS.length - 1);
    const daily = data.daily ? dailyFor(data.daily) : undefined;
    this.daily = daily && { date: daily.date, challenge: daily.challenge };
    if (daily) this.levelIndex = Math.min(daily.level, LEVELS.length - 1);
  }

  create(): void {
    setupCamera(this);
    // Scene restarts reuse this object, so reset everything here.
    const info = LEVELS[this.levelIndex]!;
    this.level = parseLevel(info.map);
    this.state = createGame(mapFromLevel(this.level), info.waves, this.difficulty, this.daily?.challenge);
    this.selected = DUCK_ORDER.find((kind) => isDuckAllowed(this.state, kind)) ?? 'sunny';
    this.duckSprites.clear();
    this.enemySprites.clear();
    this.pickerCards = [];
    this.nests = [];
    this.popup = undefined;
    this.popupTimer = undefined;
    this.focusedDuckId = undefined;
    this.moving = undefined;
    this.nightLights = [];
    this.bossBar = undefined;
    this.previewKey = '';
    this.bannerQueue = [];
    this.bannerShowing = false;

    this.drawWorld();
    this.fx = this.createEffects();
    this.peckingLoop = this.add.container(0, 0).setDepth(DEPTH.entities - 0.5);
    this.level.slots.forEach((slot) => this.drawNest(slot));
    this.drawNight();
    this.drawShield();

    this.drawPicker();
    this.drawHud();
    this.preview = this.add.container(0, 0).setDepth(DEPTH.hud);
    this.goButton = this.drawGoButton();
    this.speedButton = this.drawSpeedButton();
    this.callEarlyButton = this.drawCallEarlyButton();
    this.craigButton = this.drawCraigButton();
    drawSoundButton(this, 1245, 685, DEPTH.hud);
    this.refreshHud();
    if (this.daily) {
      const { challenge } = this.daily;
      this.time.delayedCall(350, () => this.showBanner(`Daily Challenge: ${challenge.name}`));
      this.time.delayedCall(2500, () => this.showChallengeInfo(challenge));
    } else {
      this.time.delayedCall(350, () => this.showBanner(`Level ${this.levelIndex + 1}: ${info.name}`));
    }
  }

  update(time: number, deltaMs: number): void {
    // Fast-forward: run more small slices of the rules per frame (only during waves).
    const speed = this.state.phase === 'wave' ? (GAME_SPEEDS[speedIndex] ?? 1) : 1;
    this.setTimeScale(speed);
    const events: GameEvent[] = [];
    let remaining = Math.min(deltaMs / 1000, MAX_STEP) * speed;
    while (remaining > 1e-6 && !isOver(this.state)) {
      const dt = Math.min(remaining, SIM_STEP);
      events.push(...update(this.state, dt));
      remaining -= dt;
    }
    events.forEach((event) => this.handleEvent(event));
    this.syncEnemySprites(time);
    this.syncDuckSprites();

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
      this.add
        .image(fountain.position.x, fountain.position.y, 'fountain')
        .setDisplaySize(58, 58)
        .setDepth(DEPTH.pond)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.showFountainInfo());
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
      picker.container.y = selected ? CARD.y - CARD.lift : CARD.y;
    }
    this.goButton.setVisible(game.phase === 'building');
    this.refreshPreview();
    this.speedButton.container.setVisible(game.phase === 'wave');
    const early = canCallEarly(game);
    if (early && !this.callEarlyButton.container.visible) {
      this.callEarlyButton.container.setScale(0);
      this.tweens.add({ targets: this.callEarlyButton.container, scale: 1, duration: 250, ease: 'Back.Out' });
    }
    this.callEarlyButton.container.setVisible(early);
    if (early) this.callEarlyButton.label.setText(`+${game.waves[game.waveIndex]!.bonusPeas + earlyBonus(game)}`);
    const blessing = canUseBlessing(game);
    this.craigButton.setVisible(!game.challenge?.noCraig);
    this.craigButton.setAlpha(blessing ? 1 : 0.35);
    this.craigGlow.setVisible(blessing);
  }

  /** Between waves, little chips beside the start button show what's coming next. Tap one to learn about it. */
  private refreshPreview(): void {
    const game = this.state;
    const key = game.phase === 'building' ? `${game.waveIndex}` : '';
    if (key === this.previewKey) return;
    this.previewKey = key;
    this.preview.removeAll(true);
    if (!key) return;

    const entries = wavePreview(game.waves, game.waveIndex);
    const chip = Math.min(PREVIEW.chip, (PREVIEW.maxWidth + PREVIEW.gap) / entries.length - PREVIEW.gap);
    const scale = chip / PREVIEW.chip;
    entries.forEach((entry, i) => {
      const x = PREVIEW.right - (entries.length - i) * (chip + PREVIEW.gap) + PREVIEW.gap + chip / 2;
      const parts: Phaser.GameObjects.GameObject[] = [
        drawPill(this, 0, 0, PREVIEW.chip, 48),
        this.enemyIcon(entry.enemy, 0, -4, 40, 30),
        this.add.text(PREVIEW.chip / 2 - 5, 13, `×${entry.count}`, textStyle(17, { weight: '700' })).setOrigin(1, 0.5),
      ];
      if (entry.isNew) {
        const badge = this.add.container(PREVIEW.chip / 2 - 10, -26, [
          this.add.graphics().fillStyle(COLORS.pink).fillRoundedRect(-19, -9, 38, 18, 9).lineStyle(2, COLORS.ink).strokeRoundedRect(-19, -9, 38, 18, 9),
          this.add.text(0, 0, 'NEW', textStyle(12, { weight: '700', strokeThickness: 3 })).setOrigin(0.5),
        ]);
        this.tweens.add({ targets: badge, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        parts.push(badge);
      }
      const hit = this.add.zone(0, 0, PREVIEW.chip, 52).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.showEnemyInfo(entry.enemy));
      parts.push(hit);
      const container = this.add.container(x, PREVIEW.y, parts).setScale(scale);
      container.setAlpha(0);
      this.tweens.add({ targets: container, alpha: 1, duration: 250, delay: i * 70 });
      this.preview.add(container);
    });

    // Meeting a predator for the first time (after the first wave): explain it right away.
    const firstNew = entries.find((e) => e.isNew);
    if (firstNew && game.waveIndex > 0) {
      this.time.delayedCall(1900, () => {
        if (!this.popup && this.state.phase === 'building' && this.previewKey === key) this.showEnemyInfo(firstNew.enemy, false);
      });
    }
  }

  /** A predator's picture, fit inside a box (hawks look down from above, so they get a square). */
  private enemyIcon(kind: EnemyKind, x: number, y: number, maxWidth: number, maxHeight: number): Phaser.GameObjects.Image {
    const image = this.add.image(x, y, kind);
    const fit = Math.min(maxWidth / image.width, maxHeight / image.height);
    return image.setScale(fit);
  }

  /** The Daily Challenge's twist, shown when the level starts. */
  private showChallengeInfo(challenge: Challenge): void {
    if (this.popup) return;
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const card = drawCard(this.add.graphics(), 420, 150, { radius: 18, border: COLORS.gold, borderWidth: 5 });
    const popup = this.add
      .container(WORLD.width / 2, 250, [
        card,
        this.add.image(-172, -38, 'star').setDisplaySize(40, 40).setTint(COLORS.gold),
        this.add.text(-142, -38, challenge.name, textStyle(28, { ...ink, weight: '700' })).setOrigin(0, 0.5),
        this.add.text(-186, -6, challenge.description, { ...textStyle(19, ink), wordWrap: { width: 372 } }).setOrigin(0, 0),
      ])
      .setDepth(DEPTH.hud + 5);
    popup.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: popup, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.popup = popup;
    this.popupTimer = this.time.delayedCall(6000, () => {
      if (this.popup !== popup) return;
      this.tweens.add({ targets: popup, alpha: 0, duration: 250, onComplete: () => this.popup === popup && this.closePopup() });
    });
  }

  /** What a predator does and which duck is best against it, shown when you tap it in the preview. */
  private showEnemyInfo(kind: EnemyKind, tapped = true): void {
    this.cancelMove();
    this.closePopup();
    if (tapped) playSound(this, 'tap');
    const stats = ENEMIES[kind];
    const best = DUCKS[stats.beatenBy];
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const card = drawCard(this.add.graphics(), 330, 196, { radius: 18 });
    const popup = this.add
      .container(WORLD.width - 190, 270, [
        card,
        this.enemyIcon(kind, -118, -56, 70, 56),
        this.add.text(-74, -62, stats.name, textStyle(stats.name.length > 12 ? 22 : 26, { ...ink, weight: '700' })).setOrigin(0, 0.5),
        this.add.image(-66, -32, 'icon-heart').setDisplaySize(18, 18),
        this.add.text(-52, -32, `${stats.hearts}`, textStyle(16, { ...ink, color: '#c0392b', weight: '700' })).setOrigin(0, 0.5),
        this.add
          .text(-148, -10, stats.description, { ...textStyle(16, ink), wordWrap: { width: 296 } })
          .setOrigin(0, 0),
        this.add.text(-148, 70, 'Best duck:', textStyle(17, { ...ink, color: '#2a8c44', weight: '700' })).setOrigin(0, 0.5),
        this.add.image(-40, 66, `duck-${stats.beatenBy}`).setDisplaySize(40, 40),
        this.add.text(-16, 70, best.name, textStyle(19, { ...ink, weight: '700' })).setOrigin(0, 0.5),
      ])
      .setDepth(DEPTH.hud + 5);
    popup.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: popup, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.popup = popup;
    this.popupTimer = this.time.delayedCall(6000, () => {
      if (this.popup !== popup) return;
      this.tweens.add({ targets: popup, alpha: 0, duration: 250, onComplete: () => this.popup === popup && this.closePopup() });
    });
  }

  private drawPicker(): void {
    DUCK_ORDER.forEach((kind, i) => {
      const card = drawCard(this.add.graphics(), CARD.width, CARD.height);
      const duck = this.add.image(0, -6, `duck-${kind}`).setDisplaySize(56, 56);
      const pea = this.add.image(-18, 30, 'icon-pea').setDisplaySize(18, 18);
      const cost = this.add
        .text(-6, 30, String(DUCKS[kind].cost), textStyle(19, { color: COLORS.inkCss, strokeThickness: 0 }))
        .setOrigin(0, 0.5);
      const parts: Phaser.GameObjects.GameObject[] = [card, duck, pea, cost];
      // Power badge: what's special about this duck.
      // Badges sit in the card's top corners, clear of the duck's head.
      parts.push(this.add.circle(-31, -34, 11, 0xffffff).setStrokeStyle(2.5, COLORS.ink));
      parts.push(this.add.image(-31, -34, `power-${DUCKS[kind].power.icon}`).setDisplaySize(16, 16));
      if (DUCKS[kind].canHitFlying) {
        // Hawk badge: this duck can hit flyers.
        parts.push(this.add.circle(31, -34, 11, 0x87ceeb).setStrokeStyle(2.5, COLORS.ink));
        parts.push(this.add.image(31, -34, 'hawk').setDisplaySize(17, 17));
      }
      const allowed = isDuckAllowed(this.state, kind);
      if (!allowed) {
        // Not playing in today's Daily Challenge: a big "no" sign over the card.
        parts.push(
          this.add
            .graphics()
            .lineStyle(9, COLORS.ink)
            .strokeCircle(0, -4, 30)
            .lineBetween(-21, 17, 21, -25)
            .lineStyle(5, 0xff6b5a)
            .strokeCircle(0, -4, 30)
            .lineBetween(-21, 17, 21, -25),
        );
      }
      const hit = this.add.zone(0, 0, CARD.width, CARD.height).setInteractive({ useHandCursor: true });
      parts.push(hit);
      const container = this.add.container(50 + i * CARD.spacing, CARD.y, parts).setDepth(DEPTH.hud);
      hit.on('pointerdown', () => {
        if (!allowed) {
          playSound(this, 'noPeas');
          popSpeechBubble(this, container.x, container.y + 60, 'Day off today!', DEPTH.floatText);
          return;
        }
        this.cancelMove();
        this.selected = kind;
        playSound(this, 'tap');
        this.tweens.add({ targets: duck, scale: duck.scale * 1.15, duration: 90, yoyo: true });
        this.showPickerInfo(kind);
        this.refreshHud();
      });
      this.pickerCards.push({ kind, container, card });
    });
  }

  // --- Ducks -------------------------------------------------------------

  private drawNest(slot: Point): void {
    const image = this.add.image(slot.x, slot.y + 10, 'nest').setDisplaySize(NEST_SIZE, NEST_SIZE * 0.8);
    image.setDepth(entityDepth(slot.y - 20));
    const nest: Nest = { slot, image };
    this.nests.push(nest);
    this.setNestEmpty(nest);
    // A round tap area a bit bigger than the nest drawing, for small fingers on phones.
    // (Hit areas are in the texture's own pixels.)
    const tex = image.frame;
    image
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(tex.width / 2, tex.height / 2, tex.width * 0.58),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.onNestTap(nest));
  }

  private setNestEmpty(nest: Nest): void {
    nest.duckId = undefined;
    const plus = this.add.text(nest.slot.x, nest.slot.y + 8, '+', textStyle(38, { weight: '700' })).setOrigin(0.5);
    plus.setDepth(entityDepth(nest.slot.y - 19));
    this.tweens.add({ targets: plus, scale: 1.15, alpha: 0.75, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    nest.plus = plus;
  }

  private setNestTaken(nest: Nest, duckId: number): void {
    nest.duckId = duckId;
    if (nest.plus) {
      this.tweens.killTweensOf(nest.plus);
      nest.plus.destroy();
      nest.plus = undefined;
    }
  }

  private onNestTap(nest: Nest): void {
    if (nest.duckId !== undefined) {
      this.openDuckPanel(nest.duckId);
      return;
    }
    if (this.moving) {
      this.finishMove(nest);
      return;
    }
    this.closePopup();
    const duck = buyDuck(this.state, this.selected, nest.slot);
    if (!duck) {
      // Not enough peas: wiggle the pea counter.
      playSound(this, 'noPeas');
      this.tweens.add({ targets: this.peasText, x: '+=6', duration: 50, yoyo: true, repeat: 3 });
      return;
    }
    playSound(this, 'place');
    this.setNestTaken(nest, duck.id);
    this.drawPlacedDuck(duck.id, duck.kind, nest.slot);
    this.drawPeckingLoop();
    this.refreshHud();
  }

  private drawPlacedDuck(id: number, kind: DuckKind, at: Point): void {
    const range = this.add.circle(at.x, at.y, DUCKS[kind].range).setStrokeStyle(2, 0xffffff, 0.22);
    range.setDepth(DEPTH.path + 0.5);

    const size = kind === 'curtis' ? DUCK_SIZE * 1.12 : DUCK_SIZE;
    const art = this.add.image(0, -size * 0.28, `duck-${kind}`).setDisplaySize(size, size);
    art.setFlipX(this.facesLeft(at));
    const badge = this.add.graphics();
    const refresh = this.add
      .image(0, -size * 0.25, 'glow')
      .setDisplaySize(size * 1.5, size * 1.5)
      .setTint(0x7fd4ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.tweens.add({ targets: refresh, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const root = this.add.container(at.x, at.y, [refresh, art, badge]).setDepth(entityDepth(at.y));
    this.duckSprites.set(id, { root, art, range, badge, baseSize: size, refresh });
    // Tap a duck to see its power, or to move or sell it.
    const tex = art.frame;
    art
      .setInteractive({
        hitArea: new Phaser.Geom.Circle(tex.width / 2, tex.height * 0.55, tex.width * 0.45),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      })
      .on('pointerdown', () => this.onDuckTap(id));

    // Plop in, then bob gently.
    root.setScale(0);
    this.tweens.add({ targets: root, scale: 1, duration: 280, ease: 'Back.Out' });
    this.tweens.add({ targets: art, y: art.y - 3, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.fx.puff.explode(6, at.x, at.y);
  }

  /** Ducks face the nearest bit of path. */
  private facesLeft(at: Point): boolean {
    return closestPointOnPolyline(at, this.level.path).x < at.x;
  }

  private onDuckTap(duckId: number): void {
    if (this.moving) {
      // Tapping the duck you're moving cancels; tapping another duck switches to it.
      const same = this.moving.duckId === duckId;
      this.cancelMove();
      if (same) return;
    }
    this.openDuckPanel(duckId);
  }

  // --- Duck info, selling, and moving --------------------------------------

  /** Lines about a duck's power, hawks, and the Pecking Loop, for info cards. */
  private duckInfoLines(kind: DuckKind, partner?: DuckKind, level = 0): Phaser.GameObjects.GameObject[] {
    const stats = { ...statsAt(kind, level), name: nameAt(kind, level) };
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const lines: Phaser.GameObjects.GameObject[] = [
      this.add.image(-118, -58, `duck-${kind}`).setDisplaySize(64, 64),
      this.add.text(-80, -74, stats.name, textStyle(28, { ...ink, weight: '700' })).setOrigin(0, 0.5),
      this.add.image(-68, -44, `power-${stats.power.icon}`).setDisplaySize(24, 24),
      this.add.text(-50, -44, stats.power.name, textStyle(20, { ...ink, color: '#2a66a8', weight: '700' })).setOrigin(0, 0.5),
      this.add
        .text(-138, -12, stats.power.description, { ...textStyle(17, ink), wordWrap: { width: 276 } })
        .setOrigin(0, 0),
    ];
    // Hawks. Chester can't peck them, but his Alarm Quack still freezes them.
    const freezesHawks = !stats.canHitFlying && !!stats.alarmQuack;
    const hawkText = stats.canHitFlying ? 'Hits hawks' : freezesHawks ? "Freezes hawks, can't peck them" : "Can't hit hawks";
    const helpsWithHawks = stats.canHitFlying || freezesHawks;
    lines.push(this.add.image(-126, 44, 'hawk').setDisplaySize(22, 22).setAlpha(helpsWithHawks ? 1 : 0.4));
    lines.push(
      this.add
        .text(-108, 44, hawkText, textStyle(16, { ...ink, color: helpsWithHawks ? '#2a8c44' : '#8a7f85' }))
        .setOrigin(0, 0.5),
    );
    // Pecking Loop.
    const chases = CHASES[kind];
    const chasedBy = (Object.keys(CHASES) as DuckKind[]).find((k) => CHASES[k] === kind);
    const loopText = partner
      ? `Faster! Next to ${DUCKS[partner].name}`
      : chases
        ? `Faster next to ${DUCKS[chases].name}`
        : chasedBy
          ? `Makes ${DUCKS[chasedBy].name} faster`
          : 'Ignores everyone';
    lines.push(this.add.text(-126, 70, '♥', textStyle(18, { color: '#ff7aa2', stroke: '#ffffff', strokeThickness: 3 })).setOrigin(0.5));
    lines.push(this.add.text(-108, 70, loopText, textStyle(16, { ...ink, color: partner ? '#e0447a' : '#8a5a70' })).setOrigin(0, 0.5));
    return lines;
  }

  private closePopup(): void {
    this.popupTimer?.remove();
    this.popupTimer = undefined;
    this.popup?.destroy();
    this.popup = undefined;
    if (this.focusedDuckId !== undefined) {
      this.duckSprites.get(this.focusedDuckId)?.range.setStrokeStyle(2, 0xffffff, 0.22);
      this.focusedDuckId = undefined;
    }
  }

  /** A card under the picker explaining the duck you just picked. Fades on its own. */
  private showPickerInfo(kind: DuckKind): void {
    this.closePopup();
    const card = drawCard(this.add.graphics(), 310, 196, { radius: 18 });
    const popup = this.add.container(196, 214, [card, ...this.duckInfoLines(kind)]).setDepth(DEPTH.hud + 5);
    popup.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: popup, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.popup = popup;
    this.popupTimer = this.time.delayedCall(4000, () => {
      if (this.popup !== popup) return;
      this.tweens.add({ targets: popup, alpha: 0, duration: 250, onComplete: () => this.popup === popup && this.closePopup() });
    });
  }

  /** What the solar fountain does, shown when you tap it. */
  private showFountainInfo(): void {
    const at = this.state.battle.fountain?.position;
    if (!at) return;
    this.cancelMove();
    this.closePopup();
    playSound(this, 'tap');
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const boost = Math.round(FOUNTAIN.damageBoost * 100);
    const card = drawCard(this.add.graphics(), 320, 170, { radius: 18 });
    const popup = this.add
      .container(Math.max(170, Math.min(WORLD.width - 170, at.x)), at.y + (at.y < 300 ? 150 : -150), [
        card,
        this.add.image(-118, -46, 'fountain').setDisplaySize(52, 52),
        this.add.text(-84, -58, 'Solar Fountain', textStyle(26, { ...ink, weight: '700' })).setOrigin(0, 0.5),
        this.add.image(-76, -30, 'icon-bolt').setDisplaySize(20, 20),
        this.add.text(-62, -30, 'Runs on the battery', textStyle(17, { ...ink, color: '#2a66a8', weight: '700' })).setOrigin(0, 0.5),
        this.add
          .text(-142, 4, `Ducks in its spray hit ${boost}% harder while the battery has charge. The sun charges it by day; it runs down at night.`, {
            ...textStyle(16, ink),
            wordWrap: { width: 284 },
          })
          .setOrigin(0, 0),
      ])
      .setDepth(DEPTH.hud + 5);
    popup.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: popup, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    this.popup = popup;
    this.popupTimer = this.time.delayedCall(5000, () => {
      if (this.popup !== popup) return;
      this.tweens.add({ targets: popup, alpha: 0, duration: 250, onComplete: () => this.popup === popup && this.closePopup() });
    });
  }

  /** The panel for a placed duck: its power, Pecking Loop status, and Move / Sell buttons. */
  private openDuckPanel(duckId: number): void {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const sprite = this.duckSprites.get(duckId);
    if (!duck || !sprite) return;
    this.cancelMove();
    this.closePopup();
    playSound(this, 'tap');
    this.focusedDuckId = duckId;
    sprite.range.setStrokeStyle(4, 0xffffff, 0.8);
    this.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.12, duration: 90, yoyo: true });

    // Taps anywhere outside the panel close it.
    const scrim = this.add
      .zone(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height)
      .setInteractive()
      .setDepth(DEPTH.hud + 4);
    scrim.on('pointerdown', () => this.closePopup());

    const partner = chasePartner(this.state.battle, duck)?.kind;
    const H = 500; // panel height; content is laid out from its center
    const card = drawCard(this.add.graphics(), 310, H, { radius: 18 });
    const block = this.add.zone(0, 0, 310, H).setInteractive(); // taps on the panel itself don't close it
    const info = this.add.container(0, -150, this.duckInfoLines(duck.kind, partner, duck.level));
    const aim = this.drawTargetingButtons(duckId, duck.kind, 0, -28);
    const divider = this.add.rectangle(0, 14, 270, 3, COLORS.ink, 0.12);
    const parts: Phaser.GameObjects.GameObject[] = [card, block, info, aim, divider];

    // Upgrade section.
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const next = nextUpgrade(duck.kind, duck.level);
    if (next) {
      const affordable = canUpgrade(this.state, duckId);
      parts.push(
        this.add.text(-138, 38, `Upgrade: ${next.name}`, textStyle(20, { ...ink, weight: '700' })).setOrigin(0, 0.5),
        this.add.text(-138, 64, next.description, { ...textStyle(16, ink), wordWrap: { width: 276 } }).setOrigin(0, 0.5),
        drawBigButton(
          this,
          0,
          116,
          `${next.cost}`,
          affordable ? COLORS.green : 0xb8b0a8,
          affordable ? COLORS.greenDark : 0x8a8079,
          () => this.upgrade(duckId),
          { width: 276, height: 54, fontSize: 26, icon: 'icon-pea' },
        ),
      );
    } else {
      parts.push(this.add.text(0, 80, 'Fully upgraded!', textStyle(26, { color: COLORS.goldCss, weight: '700' })).setOrigin(0.5));
    }

    const small = { width: 132, height: 54, fontSize: 26 };
    const sellable = canSell(this.state);
    parts.push(drawBigButton(this, sellable ? -74 : 0, 192, 'Move', COLORS.blue, COLORS.blueDark, () => this.startMove(duckId), small));
    // Sell shows how many peas you get back (upgrades included). A Daily Challenge can turn it off.
    if (sellable) parts.push(
      drawBigButton(this, 74, 192, `+${sellValue(duck.kind, duck.level)}`, COLORS.orange, COLORS.orangeDark, () => this.sell(duckId), {
        ...small,
        icon: 'icon-pea',
      }),
    );

    // Above the duck if it fits, else below, else beside it.
    const at = duck.position;
    const margin = 6;
    let x = Math.max(160, Math.min(WORLD.width - 160, at.x));
    let y: number;
    if (at.y - 70 - H >= margin) y = at.y - 70 - H / 2;
    else if (at.y + 40 + H <= WORLD.height - margin) y = at.y + 40 + H / 2;
    else {
      x = at.x > WORLD.width / 2 ? at.x - 70 - 155 : at.x + 70 + 155;
      y = Math.max(H / 2 + margin, Math.min(WORLD.height - H / 2 - margin, at.y));
    }
    const panel = this.add.container(x, y, parts).setDepth(DEPTH.hud + 5);
    panel.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    const container = this.add.container(0, 0, [scrim, panel]).setDepth(DEPTH.hud + 4);
    this.popup = container;
  }

  /** "Aim at" buttons: which predator this duck goes after. The chosen one is gold. */
  private drawTargetingButtons(duckId: number, kind: DuckKind, x: number, y: number): Phaser.GameObjects.Container {
    const W = 66;
    const H = 58;
    const row = this.add.container(x, y);
    const cards: { targeting: Targeting; card: Phaser.GameObjects.Graphics }[] = [];
    const refresh = () => {
      const duck = this.state.battle.ducks.find((d) => d.id === duckId);
      for (const { targeting, card } of cards) {
        const on = duck?.targeting === targeting;
        drawCard(card, W, H, { radius: 12, fill: on ? 0xfff0b3 : COLORS.cream, border: on ? COLORS.gold : COLORS.ink, borderWidth: on ? 5 : 2 });
      }
    };
    TARGETING_ORDER.forEach((targeting, i) => {
      const bx = (i - (TARGETING_ORDER.length - 1) / 2) * (W + 6);
      const card = this.add.graphics();
      const label = this.add
        .text(0, 16, TARGETING[targeting].name, textStyle(15, { color: COLORS.inkCss, strokeThickness: 0, weight: '700' }))
        .setOrigin(0.5);
      const hit = this.add.zone(0, 0, W, H).setInteractive({ useHandCursor: true });
      const button = this.add.container(bx, 0, [card, this.targetingIcon(targeting, kind), label, hit]);
      hit.on('pointerdown', () => {
        if (!setTargeting(this.state, duckId, targeting)) return;
        playSound(this, 'tap');
        this.tweens.add({ targets: button, scale: 0.9, duration: 70, yoyo: true });
        refresh();
      });
      cards.push({ targeting, card });
      row.add(button);
    });
    refresh();
    return row;
  }

  /** Little pictures for the aim buttons: the duck house, a big heart, the back of the line, the duck itself. */
  private targetingIcon(targeting: Targeting, kind: DuckKind): Phaser.GameObjects.GameObject {
    switch (targeting) {
      case 'first':
        return this.add.image(0, -8, 'house').setDisplaySize(36, 34);
      case 'strong':
        return this.add.image(0, -8, 'icon-heart').setDisplaySize(34, 34);
      case 'last': {
        // A line of three predators walking right; the one at the back has a gold ring.
        const g = this.add.graphics();
        [-16, 0, 16].forEach((dx, i) => {
          g.fillStyle(0x8a8d94).fillCircle(dx, -8, 6).lineStyle(2, COLORS.ink).strokeCircle(dx, -8, 6);
          if (i === 0) g.lineStyle(3, COLORS.gold).strokeCircle(dx, -8, 10);
        });
        return g;
      }
      case 'close':
        return this.add.image(0, -8, `duck-${kind}`).setDisplaySize(36, 36);
    }
  }

  private upgrade(duckId: number): void {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const sprite = this.duckSprites.get(duckId);
    if (!duck || !sprite) return;
    if (!upgradeDuck(this.state, duckId)) {
      // Not enough peas: wiggle the counter and show the panel again.
      playSound(this, 'noPeas');
      this.tweens.add({ targets: this.peasText, x: '+=6', duration: 50, yoyo: true, repeat: 3 });
      this.openDuckPanel(duckId);
      return;
    }
    playSound(this, 'upgrade');
    this.showDuckLevel(sprite, duck.kind, duck.level);
    const { x, y } = duck.position;
    this.fx.sparkles.explode(24, x, y - 30);
    this.ring(x, y - 30, 60, COLORS.gold, 400);
    this.floatText({ x, y: y - 80 }, nameAt(duck.kind, duck.level), COLORS.goldCss);
    this.drawPeckingLoop();
    this.refreshHud();
    this.openDuckPanel(duckId);
  }

  /** Upgraded ducks grow a little, wear gold chevrons, and reach as far as their new stats. */
  private showDuckLevel(sprite: DuckSprite, kind: DuckKind, level: number): void {
    // Stop any bounce first, or it would finish by snapping back to the old size.
    this.tweens.killTweensOf(sprite.art);
    const size = sprite.baseSize * (1 + 0.07 * level);
    sprite.art.setDisplaySize(size, size).setY(-size * 0.28);
    this.tweens.add({ targets: sprite.art, y: sprite.art.y - 3, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    sprite.range.setRadius(statsAt(kind, level).range);
    const g = sprite.badge.clear();
    for (let i = 0; i < level; i++) {
      const cy = 16 - i * 9;
      const points = [new Phaser.Math.Vector2(-10, cy + 5), new Phaser.Math.Vector2(0, cy - 4), new Phaser.Math.Vector2(10, cy + 5)];
      g.lineStyle(7, COLORS.ink).strokePoints(points);
      g.lineStyle(4, COLORS.gold).strokePoints(points);
    }
  }

  private sell(duckId: number): void {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const sprite = this.duckSprites.get(duckId);
    this.closePopup();
    if (!duck || !sprite) return;
    const at = { ...duck.position };
    const refund = sellDuck(this.state, duckId);
    if (refund === undefined) return;
    playSound(this, 'sell');
    this.duckSprites.delete(duckId);
    sprite.range.destroy();
    this.tweens.killTweensOf(sprite.art);
    this.tweens.add({
      targets: sprite.root,
      scale: 0,
      alpha: 0,
      y: at.y - 30,
      duration: 250,
      onComplete: () => sprite.root.destroy(),
    });
    this.fx.puff.explode(10, at.x, at.y - 20);
    this.flyPea(at, refund);
    const nest = this.nests.find((n) => n.duckId === duckId);
    if (nest) this.setNestEmpty(nest);
    this.drawPeckingLoop();
    this.refreshHud();
  }

  /** Move mode: empty nests light up; tap one to hop the duck there. */
  private startMove(duckId: number): void {
    this.closePopup();
    const sprite = this.duckSprites.get(duckId);
    if (!sprite) return;
    const marks: Phaser.GameObjects.GameObject[] = [];
    // Taps anywhere else cancel (this sits below the nests and ducks, so they still get taps).
    const scrim = this.add
      .zone(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height)
      .setInteractive()
      .setDepth(DEPTH.path + 0.8);
    scrim.on('pointerdown', () => this.cancelMove());
    marks.push(scrim);
    for (const nest of this.nests) {
      if (nest.duckId !== undefined) continue;
      const ring = this.add
        .circle(nest.slot.x, nest.slot.y + 8, 38)
        .setStrokeStyle(5, COLORS.gold)
        .setDepth(entityDepth(nest.slot.y - 18));
      this.tweens.add({ targets: ring, scale: 1.15, alpha: 0.5, duration: 450, yoyo: true, repeat: -1 });
      marks.push(ring);
    }
    // The duck being moved lifts up a little.
    this.tweens.add({ targets: sprite.root, y: sprite.root.y - 8, duration: 150, ease: 'Back.Out' });
    const hint = this.add
      .text(WORLD.width / 2, 150, 'Tap a glowing nest to move there', textStyle(26))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    marks.push(hint);
    this.moving = { duckId, marks };
  }

  private cancelMove(): void {
    if (!this.moving) return;
    const { duckId, marks } = this.moving;
    this.moving = undefined;
    for (const mark of marks) {
      this.tweens.killTweensOf(mark);
      mark.destroy();
    }
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const sprite = this.duckSprites.get(duckId);
    if (duck && sprite) this.tweens.add({ targets: sprite.root, y: duck.position.y, duration: 120 });
  }

  private finishMove(to: Nest): void {
    const duckId = this.moving?.duckId;
    this.cancelMove();
    if (duckId === undefined) return;
    const from = this.nests.find((n) => n.duckId === duckId);
    const sprite = this.duckSprites.get(duckId);
    if (!sprite || !moveDuck(this.state, duckId, to.slot)) return;
    playSound(this, 'move');
    if (from) this.setNestEmpty(from);
    this.setNestTaken(to, duckId);

    // Hop over: a quick arc, then a puff where it lands.
    const { root, art, range } = sprite;
    const target = to.slot;
    this.tweens.killTweensOf([root, art]);
    art.setFlipX(target.x < root.x);
    this.tweens.add({
      targets: root,
      x: target.x,
      y: target.y,
      duration: 380,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        root.setDepth(DEPTH.effects - 0.5);
        // Lift in the middle of the hop.
        art.setY(-(art.displayHeight * 0.28) - Math.sin(tween.progress * Math.PI) * 40);
      },
      onComplete: () => {
        root.setDepth(entityDepth(target.y));
        art.setY(-art.displayHeight * 0.28);
        art.setFlipX(this.facesLeft(target));
        this.fx.puff.explode(6, target.x, target.y);
        this.tweens.add({ targets: art, y: art.y - 3, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      },
    });
    range.setPosition(target.x, target.y);
    this.drawPeckingLoop();
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
      ripple = this.add.ellipse(0, 6, 140, 34).setStrokeStyle(5, SLOW_RING, 0.95).setVisible(false);
      root.add(ripple);
      art = this.add.image(0, 0, 'bandit').setDisplaySize(150, 112).setOrigin(0.5, 0.85);
      this.tweens.add({ targets: art, angle: { from: -3, to: 3 }, duration: 380, yoyo: true, repeat: -1 });
    } else {
      const look = GROUND_LOOKS[enemy.kind as keyof typeof GROUND_LOOKS];
      root.add(this.add.ellipse(0, 4, look.shadow, 16, 0x000000, 0.2));
      // Dusty ring at its feet while Curtis slows it.
      ripple = this.add.ellipse(0, 4, look.shadow + 14, 24).setStrokeStyle(4, SLOW_RING, 0.95).setVisible(false);
      this.tweens.add({ targets: ripple, scale: 1.15, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
      root.add(ripple);
      art = this.add.image(0, 0, enemy.kind).setDisplaySize(look.width, look.height).setOrigin(0.5, 0.85);
      this.tweens.add({ targets: art, angle: { from: -look.wobble, to: look.wobble }, duration: look.wobbleTime, yoyo: true, repeat: -1 });
      // Turtles climb out of the pond with a splash.
      if (ENEMIES[enemy.kind].fromPond) this.fx.splash.explode(16, pos.x, pos.y - 10);
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

      // A dusty ring at its feet while Curtis slows it.
      sprite.ripple?.setVisible(enemy.slowed);
      // Minks hiding in the grass are hard to see until Chester's quack flushes them out.
      if (ENEMIES[enemy.kind].sneaky) sprite.art.setAlpha(isHidden(enemy) ? HIDDEN_ALPHA : 1);
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
        playSound(this, 'quack');
        this.showAlarmQuack(event.duckId);
        break;
      case 'scared':
        this.showScared(event.duckIds, event.fearlessIds);
        break;
      case 'defeated':
        playSound(this, 'chasedOff');
        this.removeEnemySprite(event.enemy.id, 'defeated');
        this.flyPea(event.position, ENEMIES[event.enemy.kind].peas);
        if (ENEMIES[event.enemy.kind].boss) {
          playSound(this, 'bossDefeated');
          this.showBossGone(event.position, 'The Night Bandit ran away!');
        }
        break;
      case 'reachedHouse':
        playSound(this, 'heartLost');
        this.removeEnemySprite(event.enemy.id, 'house');
        this.showHouseRaid();
        if (ENEMIES[event.enemy.kind].boss) this.showBossGone(this.house, 'The Night Bandit raided the snacks!');
        break;
      case 'shooed':
        playSound(this, 'shoo');
        this.removeEnemySprite(event.enemy.id, 'shooed');
        popSpeechBubble(this, this.house.x, this.house.y - 150, 'Shoo!', DEPTH.floatText);
        if (ENEMIES[event.enemy.kind].boss) this.showBossGone(this.house, 'Craig shooed the Night Bandit!');
        break;
      case 'waveCleared':
        playSound(this, 'waveCleared');
        // After the last wave the win screen takes over, so no banner for it.
        if (event.waveIndex + 1 < this.state.waves.length) this.showBanner(`Wave ${event.waveIndex + 1} cleared!`, event.bonus);
        break;
      case 'won':
      case 'lost': {
        const result: ResultSceneData = {
          won: event.type === 'won',
          difficulty: this.difficulty,
          level: this.levelIndex,
          daily: this.daily?.date,
        };
        if (result.won) {
          // Save progress: this unlocks the next level and keeps the best stars and score.
          // (A Daily Challenge win is saved on its own and doesn't unlock anything.)
          result.hearts = this.state.hearts;
          result.peas = this.state.peas;
          result.stars = starsFor(this.state.hearts, challengeSettings(this.difficulty, this.daily?.challenge).hearts);
          result.score = scoreFor(this.state.hearts, this.state.peas, this.difficulty);
          const progress = loadProgress();
          const previousBest = this.daily
            ? (dailyRecord(progress, this.daily.date, this.difficulty)?.bestScore ?? 0)
            : (progress.levels[this.difficulty][this.levelIndex]?.bestScore ?? 0);
          result.newBest = previousBest > 0 && result.score > previousBest;
          saveProgress(
            this.daily
              ? recordDailyWin(progress, this.daily.date, this.difficulty, result.stars, result.score)
              : recordWin(progress, this.difficulty, this.levelIndex, result.stars, result.score),
          );
        }
        this.time.delayedCall(1000, () => this.scene.start('ResultScene', result));
        break;
      }
    }
  }

  private duckSprite(duckId: number): { sprite: DuckSprite; kind: DuckKind; level: number; position: Point } | undefined {
    const duck = this.state.battle.ducks.find((d) => d.id === duckId);
    const sprite = this.duckSprites.get(duckId);
    return duck && sprite ? { sprite, kind: duck.kind, level: duck.level, position: duck.position } : undefined;
  }

  private showAttack(duckId: number, target: Point, hitIds: number[], wingFlap: boolean): void {
    const found = this.duckSprite(duckId);
    if (!found) return;
    const { sprite, kind, level, position } = found;
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
          playSound(this, 'splash');
          flash();
          this.fx.splash.explode(12, target.x, target.y - 20);
          this.ring(target.x, target.y - 20, statsAt(kind, level).splashRadius, COLORS.water, 250);
        },
      });
    } else {
      // A quick lunge and peck.
      const dx = Math.sign(target.x - position.x) * 10;
      this.tweens.add({ targets: sprite.art, x: dx, duration: 70, yoyo: true });
      playSound(this, 'peck');
      flash();
      this.ring(target.x, target.y - 20, 18, 0xffffff, 180);
    }

    if (wingFlap) {
      playSound(this, 'flap');
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
    const { sprite, kind, level, position } = found;
    this.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.2, duration: 100, yoyo: true });
    const range = statsAt(kind, level).range;
    this.ring(position.x, position.y - 30, range, COLORS.gold, 500);
    this.time.delayedCall(120, () => this.ring(position.x, position.y - 30, range * 0.7, COLORS.gold, 450));
    this.fx.stars.explode(10, position.x, position.y - 40);
    this.floatText({ x: position.x, y: position.y - 70 }, 'QUACK!', COLORS.goldCss);
  }

  /** Scared ducks shiver and say "Eek!"; Curtis doesn't care. */
  private showScared(duckIds: number[], fearlessIds: number[]): void {
    if (duckIds.length) playSound(this, 'eek');
    // A few bubbles at most, so a big scare doesn't flood the screen.
    duckIds.slice(0, 3).forEach((id) => {
      const found = this.duckSprite(id);
      if (found) popSpeechBubble(this, found.position.x, found.position.y - 70, 'Eek!', DEPTH.floatText);
    });
    for (const id of fearlessIds) {
      const found = this.duckSprite(id);
      if (!found) continue;
      playSound(this, 'nope');
      popSpeechBubble(this, found.position.x, found.position.y - 70, 'Meh.', DEPTH.floatText);
    }
  }

  /** Scared ducks look pale and shiver; refreshed ducks glow blue. */
  private syncDuckSprites(): void {
    const waveOn = this.state.phase === 'wave';
    for (const duck of this.state.battle.ducks) {
      const sprite = this.duckSprites.get(duck.id);
      if (!sprite) continue;
      sprite.refresh.setVisible(waveOn && isRefreshed(this.state.battle, duck));
      if (duck.scaredTime > 0) {
        sprite.art.setTint(0xc6d4ec);
        sprite.art.setAngle(Math.sin(this.time.now / 30) * 4);
      } else if (sprite.art.isTinted) {
        sprite.art.clearTint();
        sprite.art.setAngle(0);
      }
    }
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
        playSound(this, 'pea');
        this.tweens.add({ targets: this.peasText, scale: 1.2, duration: 80, yoyo: true });
      },
    });
  }

  private floatText(at: Point, message: string, color: string): void {
    const text = this.add.text(at.x, at.y, message, textStyle(26, { color, weight: '700' })).setOrigin(0.5);
    text.setDepth(DEPTH.floatText);
    this.tweens.add({ targets: text, y: at.y - 40, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }

  /** Shows a big banner in the middle of the screen. If one is already up, this one waits its turn. */
  private showBanner(message: string, bonus = 0): void {
    this.bannerQueue.push({ message, bonus });
    if (!this.bannerShowing) this.showNextBanner();
  }

  private showNextBanner(): void {
    const next = this.bannerQueue.shift();
    this.bannerShowing = !!next;
    if (!next) return;
    const { message, bonus } = next;
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
    // The next banner (if any) pops in as this one starts to fade away.
    this.time.delayedCall(1620, () => this.showNextBanner());
  }

  // --- The Night Bandit ------------------------------------------------------

  private showBossEntrance(enemy: Enemy): void {
    playSound(this, 'bossArrives');
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
    playSound(this, 'whistle');
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
      playSound(this, 'waveStart');
      this.tweens.add({ targets: container, scale: 0.85, duration: 80, yoyo: true });
      this.refreshHud();
    });
    this.tweens.add({ targets: play, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return container;
  }

  /** Animations, particles, and timers keep pace with the game speed. */
  private setTimeScale(speed: number): void {
    if (this.tweens.timeScale === speed) return;
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
    for (const emitter of Object.values(this.fx)) emitter.timeScale = speed;
  }

  /** Fast-forward during a wave (in the start button's spot): tap to cycle 1x, 2x, 3x. */
  private drawSpeedButton(): { container: Phaser.GameObjects.Container; draw: () => void } {
    const chevrons = this.add.graphics();
    const label = this.add.text(0, 24, '', textStyle(18, { weight: '700' })).setOrigin(0.5);
    const draw = () => {
      const speed = GAME_SPEEDS[speedIndex] ?? 1;
      const count = speedIndex + 1; // one chevron per step up
      chevrons.clear().fillStyle(0xffffff).lineStyle(3, COLORS.ink);
      const w = 16;
      const start = (-(count * w) / 2) + 2;
      for (let i = 0; i < count; i++) {
        const x = start + i * w;
        chevrons.fillTriangle(x, -18, x, 6, x + 16, -6).strokeTriangle(x, -18, x, 6, x + 16, -6);
      }
      label.setText(`${speed}×`);
    };
    draw();
    const { container, hit } = drawRoundButton(this, GO_BUTTON.x, GO_BUTTON.y, 46, COLORS.blue, COLORS.blueDark, [chevrons, label]);
    container.setDepth(DEPTH.hud).setVisible(false);
    hit.on('pointerdown', () => {
      speedIndex = (speedIndex + 1) % GAME_SPEEDS.length;
      playSound(this, 'tap');
      this.tweens.add({ targets: container, scale: 0.88, duration: 70, yoyo: true });
      draw();
    });
    return { container, draw };
  }

  /**
   * Once every predator in a wave is out, this button sends the next wave now. You get this
   * wave's bonus right away plus peas for every predator still out there (shown on the pill).
   */
  private drawCallEarlyButton(): { container: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text } {
    const arrows = this.add.graphics().fillStyle(0xffffff).lineStyle(3, COLORS.ink);
    for (const x of [-14, 2]) arrows.fillTriangle(x, -13, x, 13, x + 16, 0).strokeTriangle(x, -13, x, 13, x + 16, 0);
    const { container: button, hit } = drawRoundButton(this, 0, 0, 32, COLORS.orange, COLORS.orangeDark, [arrows]);
    const label = this.add.text(-84, 0, '', textStyle(20, { weight: '700', color: '#c8f59a' })).setOrigin(0, 0.5);
    const pill = this.add.container(0, 0, [
      drawPill(this, -72, 0, 84, 36),
      this.add.image(-98, 0, 'icon-pea').setDisplaySize(20, 20),
      label,
    ]);
    const container = this.add.container(CALL_EARLY.x, CALL_EARLY.y, [pill, button]).setDepth(DEPTH.hud).setVisible(false);
    this.tweens.add({ targets: arrows, x: 3, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    hit.on('pointerdown', () => {
      const earned = callNextWave(this.state);
      if (earned === undefined) return;
      playSound(this, 'waveStart');
      this.flyPea({ x: CALL_EARLY.x, y: CALL_EARLY.y + 30 }, earned);
      this.showBanner(`Wave ${this.state.waveIndex + 1} is coming early!`);
      this.refreshHud();
    });
    return { container, label };
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
      playSound(this, 'craig');
      this.showBanner('Craig is watching over the duck house!');
      this.shield.setScale(0);
      this.tweens.add({ targets: this.shield, scale: 1, duration: 450, ease: 'Back.Out' });
      this.fx.sparkles.explode(30, this.house.x, this.house.y - 50);
      this.refreshHud();
    });
    return button;
  }
}
