import Phaser from 'phaser';
import { bakeScenery, drawBrambles, drawGrass, drawMud, drawOutskirts, drawPath, drawPathEntrance, drawPond, scatterDecor } from '../art/terrain';
import { TILES, type NestKind } from '../data/tiles';
import { BATTERY, FOUNTAIN } from '../data/dayNight';
import type { Challenge } from '../data/challenges';
import { findTrial, type Trial } from '../data/trials';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { CHASES } from '../data/synergy';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { VARIANTS, type VariantKind } from '../data/variants';
import { POWERS } from '../data/powers';
import { GAME_SPEEDS, SPEED_TAP_GUARD } from '../data/gameSpeed';
import { TARGETING, TARGETING_ORDER, type Targeting } from '../data/targeting';
import { HUD_AREAS } from '../data/layout';
import { LEVELS } from '../data/levels';
import { chasePartner, duckStats, enemyName, enemyPosition, enemyStats, findDuck, inBrambles, inMud, isFlying, isHidden, isRefreshed, nestAt, type Duck, type Enemy } from '../logic/battle';
import {
  buyDuck,
  canBuy,
  isFlockFull,
  jumpToWave,
  canSell,
  killPeas,
  trainDuck,
  trainingCost,
  isDuckAllowed,
  canUpgrade,
  setTargeting,
  upgradeDuck,
  moveDuck,
  sellDuck,
  refundFor,
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
  type PreviewEntry,
} from '../logic/game';
import { shortNumber } from '../logic/display';
import { closestPointOnPolyline, distance, type Ellipse, type Point } from '../logic/geometry';
import { parseLevel, type Level } from '../logic/level';
import { isFinalChoice, nameAt, nextUpgrade, statsAt, upgradeOptions } from '../logic/upgrades';
import { dailyFor } from '../logic/daily';
import { recordEndless } from '../logic/progress';
import { endlessWavesSurvived, finishRun, type RunMode } from '../logic/run';
import { ENDLESS } from '../data/endless';
import { bonusNestsFor, endlessWaves } from '../logic/endless';
import { loadProgress, saveProgress } from '../save';
import type { HatKind } from '../data/hats';
import { hatFor } from '../logic/hats';
import { duckWithHat, hatImage, placeHat } from '../ui/hats';
import type { PauseSceneData } from './PauseScene';
import type { ResultSceneData } from './ResultScene';
import { BACKDROP, COLORS, DEPTH, WORLD, entityDepth, setupCamera, textStyle, INK, INK_GREY } from '../ui/theme';
import { drawBigButton, drawCard, drawPill, drawRoundButton, drawSoundButton, killTweensDeep, popSpeechBubble } from '../ui/widgets';
import { playSound } from '../audio/sfx';
import { BossBar } from './game/BossBar';
import { CallEarly } from './game/CallEarly';
import { EndlessPanel } from './game/EndlessPanel';
import { Hints } from './game/Hints';
import type { DuckSprite, Effects, EnemySprite, GameHost } from './game/host';
import { CARD, CRAIG_BUTTON, GO_BUTTON, PAUSE_BUTTON, PEA_ICON, PREVIEW, SOUND_BUTTON } from './game/layout';
import { PowerButtons } from './game/PowerButtons';

const DUCK_SIZE = 84;
const NEST_SIZE = 72;
const HP_BAR_WIDTH = 46;
const BATTERY_BAR_WIDTH = 88;
const SLOW_RING = 0xb08a58; // dusty ring at the feet of predators Curtis is slowing
const NIGHT_ALPHA = 0.45;
const MAX_STEP = 0.1; // seconds; stops predators teleporting after a stalled frame
const SIM_STEP = 1 / 60; // the rules always run in slices this small, so fast-forward plays out exactly the same

// The chosen fast-forward speed, remembered between waves and levels (until the page reloads).
// Easy starts every level at normal speed, so a speed set by accident doesn't stick.
let speedIndex = 0;

// Maps whose "On this map" key has been shown this visit (so it shows once per map).
const shownMapKeys = new Set<string>();

// Things that happen all the time in a battle and don't change the HUD.
const QUIET_EVENTS: ReadonlySet<GameEvent['type']> = new Set(['attack', 'alarmQuack', 'scared']);

type TileKind = 'mud' | 'brambles' | NestKind;

// How each walking predator looks: its picture's size, the shadow under it, and how it waddles.
const GROUND_LOOKS: Record<Exclude<EnemyKind, 'hawk' | 'stormHawk'>, { width: number; height: number; shadow: number; wobble: number; wobbleTime: number }> = {
  raccoon: { width: 92, height: 67, shadow: 64, wobble: 4, wobbleTime: 220 },
  fox: { width: 100, height: 68, shadow: 66, wobble: 5, wobbleTime: 140 },
  mink: { width: 88, height: 44, shadow: 60, wobble: 3, wobbleTime: 160 },
  skunk: { width: 94, height: 60, shadow: 64, wobble: 4, wobbleTime: 200 },
  turtle: { width: 110, height: 75, shadow: 90, wobble: 2, wobbleTime: 520 },
  bandit: { width: 150, height: 112, shadow: 124, wobble: 3, wobbleTime: 380 },
  silverFox: { width: 150, height: 102, shadow: 104, wobble: 4, wobbleTime: 150 },
  oldSnapper: { width: 180, height: 123, shadow: 150, wobble: 1.5, wobbleTime: 700 },
};
// Flyers are seen from above, so they're square.
const FLYING_SIZES: Record<'hawk' | 'stormHawk', number> = { hawk: 88, stormHawk: 140 };
const HIDDEN_ALPHA = 0.45; // a mink hiding in the grass is see-through

/** A name that starts with "The" reads better mid-sentence as "the": "Craig shooed the Storm Hawk!" */
function midSentence(name: string): string {
  return name.replace(/^The /, 'the ');
}

// Said by the raccoon when it gets into the duck house. Losing a heart should be funny.
const RACCOON_QUIPS = ['Nom nom!', 'Yoink!', 'Snack time!', 'Crunch!', 'Mine now!'];

export interface GameSceneData {
  difficulty: Difficulty;
  /** Index into LEVELS (0 = the first level). */
  level?: number;
  /** Play the Daily Challenge for this date (YYYY-MM-DD) instead; the date picks the level. */
  daily?: string;
  /** Play the Endless Pond on `level`'s map instead: waves until you run out of hearts. */
  endless?: boolean;
  /** Play a Level Trial (its id, see src/data/trials.ts) instead; the trial picks the level. */
  trial?: string;
  /** The Sandbox: `level` with endless peas and hearts and any wave on tap. Nothing is saved. */
  sandbox?: boolean;
}

interface Nest {
  slot: Point;
  image: Phaser.GameObjects.Image;
  plus?: Phaser.GameObjects.Text;
  duckId?: number;
}

interface PickerCard {
  kind: DuckKind;
  container: Phaser.GameObjects.Container;
  card: Phaser.GameObjects.Graphics;
}

export class GameScene extends Phaser.Scene implements GameHost {
  difficulty: Difficulty = 'easy';
  private levelIndex = 0;
  /** The hat each duck is wearing (from the Wardrobe). */
  private hats: Partial<Record<DuckKind, HatKind>> = {};
  /** Whether this is the Endless Pond. */
  private endless = false;
  /** The Daily Challenge being played, if any. */
  private daily?: { date: string; challenge: Challenge };
  /** The Level Trial being played, if any. */
  private trial?: Trial;
  /** Whether this is the Sandbox (see src/data/sandbox.ts). */
  private sandbox = false;
  /** Endless Pond: where the New Nests boss reward puts its nests on this map. */
  bonusNests: Point[] = [];
  private level!: Level;
  state!: Game;
  private selected: DuckKind = 'sunny';
  private duckSprites = new Map<number, DuckSprite>();
  enemySprites = new Map<number, EnemySprite>();
  private pickerCards: PickerCard[] = [];
  /** The flock power buttons under the picker, by duck kind. */
  private powers!: PowerButtons;
  private nests: Nest[] = [];
  /** The panel shown for a tapped duck (or the info card for a tapped picker card). */
  popup?: Phaser.GameObjects.Container;
  private popupTimer?: Phaser.Time.TimerEvent;
  private focusedDuckId?: number;
  /** While moving a duck: its id, and the things drawn to show where it can go. */
  private moving?: { duckId: number; marks: Phaser.GameObjects.GameObject[] };
  fx!: Effects;
  house!: Phaser.GameObjects.Image;
  private shield!: Phaser.GameObjects.Container;
  private goButton!: Phaser.GameObjects.Container;
  private speedButton!: { container: Phaser.GameObjects.Container; draw: () => void };
  /** Static ground drawings waiting to be baked into one picture when the world is built. */
  private scenery: Phaser.GameObjects.Graphics[] = [];
  /** When the start button was last tapped (scene time), so the speed button can ignore a double-tap. */
  private waveStartedAt = -Infinity;
  // The screen's parts (src/scenes/game/), each made fresh in create().
  private endlessPanel?: EndlessPanel;
  private callEarly!: CallEarly;
  private hints!: Hints;
  /** The open duck panel's report numbers, refreshed as the battle goes on. */
  private panelReport?: { row: Phaser.GameObjects.Container; refresh: () => void };
  private craigButton!: Phaser.GameObjects.Container;
  /** Whether Craig's blessing could be used at the last look (to notice when it comes back). */
  private blessingReady = true;
  private craigGlow!: Phaser.GameObjects.Image;
  private peasText!: Phaser.GameObjects.Text;
  private heartsText!: Phaser.GameObjects.Text;
  heartsPill!: Phaser.GameObjects.Container;
  private waveText!: Phaser.GameObjects.Text;
  private dayIcon!: Phaser.GameObjects.Image;
  private batteryFill!: Phaser.GameObjects.Rectangle;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private nightLights: Phaser.GameObjects.Image[] = [];
  private peckingLoop!: Phaser.GameObjects.Container;
  private shownNight = false;
  /** When a predator in brambles can next yell "Ouch!" (so it isn't constant). */
  private nextOuchAt = 0;
  private nextSquelchAt = 0;
  /** Banners waiting to be shown, so two never land on top of each other. */
  private bannerQueue: { message: string; bonus: number }[] = [];
  private bannerShowing = false;
  private preview!: Phaser.GameObjects.Container;
  /** Which wave the preview is showing, so it's only rebuilt when that changes. */
  private previewKey = '';
  private bosses!: BossBar;

  constructor() {
    super('GameScene');
  }

  init(data: Partial<GameSceneData>): void {
    this.difficulty = data.difficulty ?? 'easy';
    this.levelIndex = Math.min(data.level ?? 0, LEVELS.length - 1);
    const daily = data.daily ? dailyFor(data.daily) : undefined;
    this.daily = daily && { date: daily.date, challenge: daily.challenge };
    if (daily) this.levelIndex = Math.min(daily.level, LEVELS.length - 1);
    this.endless = !daily && !!data.endless;
    const found = !daily && !this.endless && data.trial ? findTrial(data.trial) : undefined;
    this.trial = found?.trial;
    if (found) this.levelIndex = found.level;
    this.sandbox = !daily && !this.endless && !found && !!data.sandbox;
  }

  /** How this game was set up, for saving its result and for playing it again. */
  private mode(): RunMode {
    return { difficulty: this.difficulty, level: this.levelIndex, daily: this.daily?.date, trial: this.trial?.id, endless: this.endless, sandbox: this.sandbox };
  }

  /** The twist on the rules this game is played with: a Daily Challenge's or a Level Trial's. */
  private get challenge(): Challenge | undefined {
    return this.daily?.challenge ?? this.trial;
  }

  create(): void {
    setupCamera(this);
    // Scene restarts reuse this object, so reset everything here.
    const info = LEVELS[this.levelIndex]!;
    if (this.difficulty === 'easy') speedIndex = 0;
    const progress = loadProgress();
    this.hats = {};
    for (const kind of DUCK_ORDER) {
      const hat = hatFor(progress, kind);
      if (hat) this.hats[kind] = hat;
    }
    this.level = parseLevel(info.map);
    this.bonusNests = this.endless ? bonusNestsFor(this.level) : [];
    this.state = createGame(
      mapFromLevel(this.level),
      this.endless ? endlessWaves() : info.waves,
      this.difficulty,
      this.challenge,
      this.endless,
      this.sandbox,
    );
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
    this.previewKey = '';
    this.bannerQueue = [];
    this.panelReport = undefined;
    this.blessingReady = true;
    this.bannerShowing = false;

    this.drawWorld();
    this.fx = this.createEffects();
    this.peckingLoop = this.add.container(0, 0).setDepth(DEPTH.entities - 0.5);
    this.level.slots.forEach((slot) => this.drawNest(slot));
    // Everything static from the lawn up to the nest mounds becomes one picture (see bakeScenery).
    bakeScenery(this, this.scenery, DEPTH.path);
    this.scenery = [];
    this.drawNight();
    this.drawShield();

    this.drawPicker();
    this.powers = new PowerButtons(this);
    this.bosses = new BossBar(this);
    this.drawHud();
    this.preview = this.add.container(0, 0).setDepth(DEPTH.hud);
    this.endlessPanel = this.endless ? new EndlessPanel(this) : undefined;
    this.goButton = this.drawGoButton();
    this.speedButton = this.drawSpeedButton();
    this.callEarly = new CallEarly(this);
    this.craigButton = this.drawCraigButton();
    this.hints = new Hints(this, this.craigButton, () => this.nests.filter((n) => n.duckId === undefined).length);
    drawSoundButton(this, SOUND_BUTTON.x, SOUND_BUTTON.y, DEPTH.hud);
    this.drawPauseButton();
    this.refreshHud();
    // A new player who hasn't placed a duck gets a nudge from Craig.
    this.time.delayedCall(7000, () => {
      if (this.state.phase === 'building' && this.state.waveIndex === 0) this.hints.maybe({ type: 'noDucksYet' });
    });
    if (this.endless) {
      this.time.delayedCall(350, () => this.showBanner(`${ENDLESS.name}: ${info.name}`));
    } else if (this.daily) {
      const { challenge } = this.daily;
      this.time.delayedCall(350, () => this.showBanner(`Daily Challenge: ${challenge.name}`));
      this.time.delayedCall(2500, () => this.showChallengeInfo(challenge));
    } else if (this.trial) {
      const trial = this.trial;
      this.time.delayedCall(350, () => this.showBanner(`Trial: ${trial.name}`));
      this.time.delayedCall(2500, () => this.showChallengeInfo(trial));
    } else if (this.sandbox) {
      this.time.delayedCall(350, () => this.showBanner(`Sandbox: ${info.name}`));
    } else {
      this.time.delayedCall(350, () => this.showBanner(`Level ${this.levelIndex + 1}: ${info.name}`));
    }
    if (this.sandbox) this.drawWaveArrows();
    // A map with special tiles gets a key explaining them (once per map, per visit).
    const mapKey = this.endless ? 'endless' : String(this.levelIndex);
    if (this.tilesOnMap().length > 0 && !shownMapKeys.has(mapKey)) {
      shownMapKeys.add(mapKey);
      // After the level banner (and after a Daily Challenge's or trial's twist card).
      this.time.delayedCall(this.challenge ? 9000 : 2400, () => this.showMapKey());
    }
  }

  update(time: number, deltaMs: number): void {
    // Fast-forward: run more small slices of the rules per frame (only during waves).
    const speed = this.state.phase === 'wave' ? (GAME_SPEEDS[speedIndex] ?? 1) : 1;
    this.setTimeScale(speed);
    const events: GameEvent[] = [];
    // Everything waits while you pick a Pond Perk.
    let remaining = this.endlessPanel?.choosing ? 0 : Math.min(deltaMs / 1000, MAX_STEP) * speed;
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
    this.batteryFill.fillColor = charge < 0.25 ? COLORS.coral : COLORS.gold;
    this.fx.fountainSpray.emitting = !!this.state.battle.fountain?.on && this.state.phase === 'wave';
    const shielded = this.state.shieldTime > 0;
    this.shield.setVisible(shielded);
    this.fx.sparkles.emitting = shielded;
    this.powers.sync();

    if (events.length > 0) {
      // Attacks, quacks, and scares happen constantly and change nothing the HUD shows.
      if (events.some((e) => !QUIET_EVENTS.has(e.type))) this.refreshHud();
      if (this.panelReport?.row.active) this.panelReport.refresh();
    }
  }

  // --- World -------------------------------------------------------------

  private drawWorld(): void {
    // Different seeds per level, so each level's scenery is different (but always the same).
    const seed = 11 + this.levelIndex * 100;
    // The static drawings, in the order they stack up, to be baked into one picture.
    this.scenery.push(drawGrass(this, seed));
    drawOutskirts(this, seed + 3);
    this.level.paths.forEach((trail, i) => {
      this.scenery.push(drawPath(this, trail, seed + 1 + i * 7));
      drawPathEntrance(this, trail, seed + 4 + i * 7);
    });
    this.level.mud.forEach((patch, i) => this.scenery.push(drawMud(this, patch, seed + 20 + i)));
    this.level.brambles.forEach((patch, i) => this.scenery.push(drawBrambles(this, patch, seed + 30 + i)));
    this.level.ponds.forEach((pond, i) => this.scenery.push(drawPond(this, pond, seed + 9 + i)));
    // Tap a mud or bramble patch to learn what it does.
    const tappable: [TileKind, Ellipse[]][] = [['mud', this.level.mud], ['brambles', this.level.brambles]];
    for (const [kind, patches] of tappable) {
      for (const p of patches) {
        const w = p.radiusX * 2;
        const h = p.radiusY * 2;
        this.add
          .zone(p.center.x, p.center.y, w, h)
          .setInteractive({ hitArea: new Phaser.Geom.Ellipse(w / 2, h / 2, w, h), hitAreaCallback: Phaser.Geom.Ellipse.Contains })
          .setDepth(DEPTH.path + 0.3)
          .on('pointerdown', () => this.showTileInfo(kind, p.center));
      }
    }

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
      // (The Endless Pond keeps bushes and rocks off the spots where the New Nests boss reward goes.)
      { paths: this.level.paths, slots: [...this.level.slots, ...this.bonusNests], ponds: this.level.ponds, house: door, blocked: HUD_AREAS },
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
          tint: [COLORS.water, 0xffffff, 0x5bb3e8],
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
        { speed: { min: 50, max: 140 }, lifespan: 500, scale: { start: 0.5, end: 0 }, tint: COLORS.goldLight },
        DEPTH.effects,
      ),
      sparkles: this.add
        .particles(this.house.x, this.house.y - 50, 'star', {
          emitting: false,
          emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 100) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
          lifespan: 800,
          frequency: 90,
          scale: { start: 0.35, end: 0 },
          tint: [COLORS.goldLight, 0xffffff],
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
          tint: [0xcfefff, COLORS.water],
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
      mudSplash: burst(
        'dot',
        { speed: { min: 30, max: 90 }, angle: { min: 200, max: 340 }, gravityY: 320, lifespan: 380, scale: { start: 0.45, end: 0 }, tint: [0x4a3322, 0x6b4a33] },
        DEPTH.effects,
      ),
      thorns: burst(
        'dot',
        { speed: { min: 30, max: 80 }, lifespan: 320, scale: { start: 0.35, end: 0 }, tint: [0x6f8f3a, 0xf2e6c8, 0x6a2a5a] },
        DEPTH.effects,
      ),
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

  refreshHud(): void {
    const game = this.state;
    this.peasText.setText(String(game.peas));
    this.heartsText.setText(String(game.hearts));
    const wave = Math.min(game.waveIndex + 1, game.waves.length);
    this.waveText.setText(this.endless ? `Wave ${wave}` : `Wave ${wave}/${game.waves.length}`);
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
    this.callEarly.refresh();
    this.endlessPanel?.refresh();
    const blessing = canUseBlessing(game);
    // Endless Pond: Craig says so when her blessing comes back.
    if (blessing && !this.blessingReady) popSpeechBubble(this, CRAIG_BUTTON.x + 30, CRAIG_BUTTON.y - 60, "I'm ready again!", DEPTH.floatText);
    this.blessingReady = blessing;
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
    killTweensDeep(this, this.preview);
    this.preview.removeAll(true);
    if (!key) return;

    const entries = wavePreview(game.waves, game.waveIndex);
    const chip = Math.min(PREVIEW.chip, (PREVIEW.maxWidth + PREVIEW.gap) / entries.length - PREVIEW.gap);
    const scale = chip / PREVIEW.chip;
    entries.forEach((entry, i) => {
      const x = PREVIEW.right - (entries.length - i) * (chip + PREVIEW.gap) + PREVIEW.gap + chip / 2;
      const container = this.drawPreviewChip(entry, x, PREVIEW.y, scale);
      const hit = this.add.zone(0, 0, PREVIEW.chip, 52).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.showEnemyInfo(entry.enemy, true, entry.variant));
      container.add(hit);
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

  /** One "coming next" chip: the predator, how many, and a NEW badge the first time it shows up. */
  drawPreviewChip(entry: PreviewEntry, x: number, y: number, scale = 1): Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [
      drawPill(this, 0, 0, PREVIEW.chip, 48),
      this.enemyIcon(entry.enemy, 0, -4, 40, 30, entry.variant),
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
    return this.add.container(x, y, parts).setScale(scale);
  }

  /** A predator's picture, fit inside a box (hawks look down from above, so they get a square). */
  enemyIcon(kind: EnemyKind, x: number, y: number, maxWidth: number, maxHeight: number, variant?: VariantKind): Phaser.GameObjects.Image {
    const image = this.add.image(x, y, kind);
    const fit = Math.min(maxWidth / image.width, maxHeight / image.height);
    if (variant) image.setTint(VARIANTS[variant].tint);
    return image.setScale(fit);
  }

  /** The Daily Challenge's (or Level Trial's) twist, shown when the level starts. */
  private showChallengeInfo(challenge: Challenge): void {
    if (this.popup) return;
    // Two twists at once have a longer name and twice the words, so the card grows to fit.
    const words = this.add.text(-186, -6, challenge.description, { ...textStyle(19, INK), wordWrap: { width: 372 } }).setOrigin(0, 0);
    const height = Math.max(150, words.height + 82);
    const card = drawCard(this.add.graphics(), 420, height, { radius: 18, border: COLORS.gold, borderWidth: 5 });
    const top = -height / 2;
    words.setY(top + 44);
    const popup = this.add
      .container(WORLD.width / 2, 250 + (height - 150) / 2, [
        card,
        this.trial
          ? this.add.image(-172, top + 37, 'ribbon').setDisplaySize(44, 44).setTint(COLORS.pink)
          : this.add.image(-172, top + 37, 'star').setDisplaySize(40, 40).setTint(COLORS.gold),
        this.add.text(-142, top + 37, challenge.name, textStyle(challenge.name.length > 18 ? 22 : 28, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        words,
      ])
      .setDepth(DEPTH.hud + 5);
    this.showPopup(popup, 6000);
  }

  /** What a predator does and which duck is best against it, shown when you tap it in the preview. */
  private showEnemyInfo(kind: EnemyKind, tapped = true, variant?: VariantKind): void {
    this.cancelMove();
    this.closePopup();
    if (tapped) playSound(this, 'tap');
    const stats = ENEMIES[kind];
    const twist = variant && VARIANTS[variant];
    const name = enemyName({ kind, variant });
    const best = DUCKS[stats.beatenBy];
    // A variant's words go under the predator's own, so the card grows a little.
    const extra = twist ? 70 : 0;
    const card = drawCard(this.add.graphics(), 330, 204 + extra, { radius: 18 });
    const popup = this.add
      .container(WORLD.width - 190, 270 + extra / 2, [
        card,
        this.enemyIcon(kind, -118, -56 - extra / 2, 70, 56, variant),
        // Long names ("Regrowing Snapping Turtle") shrink to stay on the card.
        this.fitWidth(this.add.text(-74, -62 - extra / 2, name, textStyle(name.length > 12 ? 22 : 26, { ...INK, weight: '700' })).setOrigin(0, 0.5), 222),
        this.add.image(-66, -32 - extra / 2, 'icon-heart').setDisplaySize(18, 18),
        this.add.text(-52, -32 - extra / 2, `${stats.hearts}`, textStyle(16, { ...INK, color: '#c0392b', weight: '700' })).setOrigin(0, 0.5),
        this.add
          .text(-148, -12 - extra / 2, twist ? `${stats.description}\n${twist.name}: ${twist.description}` : stats.description, {
            ...textStyle(18, INK),
            wordWrap: { width: 296 },
          })
          .setOrigin(0, 0),
        this.add.text(-148, 74 + extra / 2, 'Best duck:', textStyle(18, { ...INK, color: COLORS.textGreen, weight: '700' })).setOrigin(0, 0.5),
        this.add.image(-40, 70 + extra / 2, `duck-${stats.beatenBy}`).setDisplaySize(40, 40),
        this.add.text(-16, 74 + extra / 2, best.name, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
      ])
      .setDepth(DEPTH.hud + 5);
    this.showPopup(popup, 6000);
  }

  private drawPicker(): void {
    DUCK_ORDER.forEach((kind, i) => {
      const card = drawCard(this.add.graphics(), CARD.width, CARD.height);
      const duck = duckWithHat(this, kind, 0, -6, 56, this.hats[kind]);
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
        // Not playing today (a Daily Challenge or trial left it out): a big "no" sign over the card.
        parts.push(
          this.add
            .graphics()
            .lineStyle(9, COLORS.ink)
            .strokeCircle(0, -4, 30)
            .lineBetween(-21, 17, 21, -25)
            .lineStyle(5, COLORS.coral)
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
        this.tweens.add({ targets: duck, scale: 1.15, duration: 90, yoyo: true });
        this.showPickerInfo(kind);
        this.refreshHud();
      });
      this.pickerCards.push({ kind, container, card });
    });
  }

  // --- Sandbox -------------------------------------------------------------

  /** Sandbox: arrows under the counters to jump to any wave (between waves). */
  private drawWaveArrows(): void {
    const draw = (x: number, step: number, flip: boolean) => {
      const arrow = this.add
        .graphics()
        .fillStyle(0xffffff)
        .fillTriangle(flip ? 7 : -7, -10, flip ? 7 : -7, 10, flip ? -9 : 9, 0)
        .lineStyle(3, COLORS.ink)
        .strokeTriangle(flip ? 7 : -7, -10, flip ? 7 : -7, 10, flip ? -9 : 9, 0);
      const button = drawRoundButton(this, x, 96, 20, COLORS.blue, COLORS.blueDark, [arrow]);
      button.container.setDepth(DEPTH.hud);
      button.hit.on('pointerdown', () => {
        if (!jumpToWave(this.state, this.state.waveIndex + step)) {
          playSound(this, 'noPeas');
          this.tweens.add({ targets: button.container, x: x + 4, duration: 50, yoyo: true, repeat: 3 });
          return;
        }
        playSound(this, 'tap');
        this.previewKey = ''; // the coming-next chips show the new wave
        this.refreshHud();
      });
    };
    draw(660, -1, true);
    draw(740, 1, false);
    this.add.text(700, 96, 'wave', textStyle(16, { strokeThickness: 3 })).setOrigin(0.5).setDepth(DEPTH.hud);
  }

  // --- Flock powers --------------------------------------------------------

  // --- Ducks -------------------------------------------------------------

  drawNest(slot: Point): void {
    this.drawSpecialNest(slot);
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

  /** Hill nests sit on a grassy mound; waterside nests have a lily pad and ripples. Both get a badge. */
  private drawSpecialNest(slot: Point): void {
    const kind = nestAt(this.state.battle, slot);
    if (!kind) return;
    const under = this.add.graphics().setDepth(entityDepth(slot.y - 21));
    this.scenery.push(under); // baked with the rest of the ground
    // The badge sits at the nest's front corner, above any duck in it, so it always shows.
    const badge = this.add.container(slot.x - 34, slot.y + 22).setDepth(entityDepth(slot.y + 30));
    // Tap the badge to learn what the nest does (a generous tap area for small fingers).
    const hit = this.add.circle(0, 0, 13, 0xffffff).setStrokeStyle(3, COLORS.ink);
    hit
      .setInteractive({ hitArea: new Phaser.Geom.Circle(13, 13, 22), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true })
      .on('pointerdown', () => this.showTileInfo(kind, slot));
    badge.add(hit);
    if (kind === 'hill') {
      under.fillStyle(0x000000, 0.15).fillEllipse(slot.x, slot.y + 22, 110, 34);
      under.fillStyle(0x5f9e3c).fillEllipse(slot.x, slot.y + 14, 104, 44);
      under.fillStyle(0x7cbf52).fillEllipse(slot.x, slot.y + 8, 90, 34);
      // Badge: a little mountain.
      badge.add(this.add.graphics().fillStyle(0x5f9e3c).fillTriangle(-8, 5, 0, -7, 8, 5).fillStyle(0xffffff).fillTriangle(-3, -2, 0, -7, 3, -2));
    } else {
      under.fillStyle(0x4aa3df, 0.55).fillEllipse(slot.x, slot.y + 16, 100, 38);
      under.lineStyle(3, COLORS.water, 0.8).strokeEllipse(slot.x, slot.y + 16, 100, 38);
      under.lineStyle(2, COLORS.water, 0.5).strokeEllipse(slot.x, slot.y + 16, 124, 48);
      this.add.image(slot.x - 40, slot.y + 20, 'lily').setDisplaySize(26, 26).setDepth(entityDepth(slot.y - 20.5));
      badge.add(this.add.image(0, 0, 'power-splash').setDisplaySize(18, 18));
    }
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
      // A trial can cap the flock; otherwise it's the peas.
      if (isFlockFull(this.state)) {
        playSound(this, 'noPeas');
        popSpeechBubble(this, nest.slot.x, nest.slot.y - 60, "The flock's full!", DEPTH.floatText);
      } else {
        this.wigglePeas();
      }
      return;
    }
    playSound(this, 'place');
    this.setNestTaken(nest, duck.id);
    this.drawPlacedDuck(duck.id, duck.kind, nest.slot);
    this.announceNest(nest.slot);
    this.drawPeckingLoop();
    this.refreshHud();
  }

  private drawPlacedDuck(id: number, kind: DuckKind, at: Point): void {
    const placed = findDuck(this.state.battle, id);
    const reach = placed ? duckStats(this.state.battle, placed).range : DUCKS[kind].range;
    const range = this.add.circle(at.x, at.y, reach).setStrokeStyle(2, 0xffffff, 0.22);
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
    const hatKind = this.hats[kind];
    const hat = hatKind ? hatImage(this, hatKind) : undefined;
    if (hat) placeHat(hat, art);
    const root = this.add.container(at.x, at.y, [refresh, art, ...(hat ? [hat] : []), badge]).setDepth(entityDepth(at.y));
    this.duckSprites.set(id, { root, art, range, badge, baseSize: size, refresh, hat });
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

  /** A duck landing on a special nest says what it's good for. */
  private announceNest(at: Point): void {
    const kind = nestAt(this.state.battle, at);
    if (kind) this.floatText({ x: at.x, y: at.y - 90 }, `${TILES.nests[kind].name}: ${TILES.nests[kind].description}!`, COLORS.peaCss);
  }

  /** Ducks face the nearest bit of any trail. */
  private facesLeft(at: Point): boolean {
    const nearest = this.level.paths
      .map((trail) => closestPointOnPolyline(at, trail))
      .reduce((best, p) => (distance(at, p) < distance(at, best) ? p : best));
    return nearest.x < at.x;
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
  private duckInfoLines(kind: DuckKind, partner?: DuckKind, level = 0, path = 0): Phaser.GameObjects.GameObject[] {
    const stats = { ...statsAt(kind, level, path), name: nameAt(kind, level, path) };
    const lines: Phaser.GameObjects.GameObject[] = [
      duckWithHat(this, kind, -118, -58, 64, this.hats[kind]),
      this.fitWidth(this.add.text(-80, -74, stats.name, textStyle(28, { ...INK, weight: '700' })).setOrigin(0, 0.5), 222),
      this.add.image(-68, -44, `power-${stats.power.icon}`).setDisplaySize(24, 24),
      this.add.text(-50, -44, stats.power.name, textStyle(20, { ...INK, color: COLORS.blueDarkCss, weight: '700' })).setOrigin(0, 0.5),
      this.add
        .text(-138, -12, stats.power.description, { ...textStyle(17, INK), wordWrap: { width: 276 } })
        .setOrigin(0, 0),
    ];
    // Hawks. Chester can't peck them, but his Alarm Quack still freezes them.
    const freezesHawks = !stats.canHitFlying && !!stats.alarmQuack;
    const hawkText = (stats.flyerDamage ?? 1) > 1 ? 'Extra strong against hawks' : stats.canHitFlying ? 'Hits hawks' : freezesHawks ? "Freezes hawks, can't peck them" : "Can't hit hawks";
    const helpsWithHawks = stats.canHitFlying || freezesHawks;
    lines.push(this.add.image(-126, 44, 'hawk').setDisplaySize(22, 22).setAlpha(helpsWithHawks ? 1 : 0.4));
    lines.push(
      this.add
        .text(-108, 44, hawkText, textStyle(16, { ...INK, color: helpsWithHawks ? COLORS.textGreen : COLORS.textGrey }))
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
    lines.push(this.add.text(-126, 70, '♥', textStyle(18, { color: COLORS.pinkCss, stroke: '#ffffff', strokeThickness: 3 })).setOrigin(0.5));
    lines.push(this.add.text(-108, 70, loopText, textStyle(16, { ...INK, color: partner ? COLORS.pinkTextCss : '#8a5a70' })).setOrigin(0, 0.5));
    return lines;
  }

  /** Shrinks a line of text to fit a width (long upgrade names like "Grand Old Chester"). */
  private fitWidth(text: Phaser.GameObjects.Text, width: number): Phaser.GameObjects.Text {
    if (text.width > width) text.setScale(width / text.width);
    return text;
  }

  /** Pops something into view (cards, panels). */
  popIn(target: Phaser.GameObjects.Container): void {
    target.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: target, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
  }

  /** Shows an info card as the open popup. It fades away on its own after `life` milliseconds. */
  showPopup(popup: Phaser.GameObjects.Container, life: number): void {
    this.popIn(popup);
    this.popup = popup;
    this.popupTimer = this.time.delayedCall(life, () => {
      if (this.popup !== popup) return;
      this.tweens.add({ targets: popup, alpha: 0, duration: 250, onComplete: () => this.popup === popup && this.closePopup() });
    });
  }

  /** An invisible sheet over the whole screen that catches taps (to close a panel, or cancel a move). */
  tapCatcher(depth: number, onTap: () => void): Phaser.GameObjects.Zone {
    const zone = this.add
      .zone(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height)
      .setInteractive()
      .setDepth(depth);
    zone.on('pointerdown', onTap);
    return zone;
  }

  /** Not enough peas: wiggle the pea counter. */
  private wigglePeas(): void {
    playSound(this, 'noPeas');
    this.tweens.add({ targets: this.peasText, x: '+=6', duration: 50, yoyo: true, repeat: 3 });
  }

  /** A button showing a price in peas: green if you can afford it, INK_GREY if not. */
  private priceButton(
    x: number,
    y: number,
    cost: number,
    affordable: boolean,
    onTap: () => void,
    size: { width: number; height: number; fontSize: number } = { width: 276, height: 54, fontSize: 26 },
  ): Phaser.GameObjects.Container {
    return drawBigButton(this, x, y, `${cost}`, affordable ? COLORS.green : 0xb8b0a8, affordable ? COLORS.greenDark : 0x8a8079, onTap, {
      ...size,
      icon: 'icon-pea',
    });
  }

  closePopup(): void {
    this.popupTimer?.remove();
    this.popupTimer = undefined;
    if (this.popup) killTweensDeep(this, this.popup);
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
    // The duck's card, plus its Big Move (the tap-to-use one, on the buttons down the right).
    const card = drawCard(this.add.graphics(), 310, 232, { radius: 18 });
    const lines = this.add.container(0, -22, this.duckInfoLines(kind)); // the usual card's lines, shifted up to make room
    const bigMove = [
      this.add.image(-126, 86, 'glow').setDisplaySize(30, 30).setTint(COLORS.gold),
      this.add.image(-126, 86, `duck-${kind}`).setDisplaySize(22, 22),
      this.add.text(-108, 84, `Big Move: ${POWERS[kind].name}`, textStyle(18, { ...INK, color: COLORS.textGold, weight: '700' })).setOrigin(0, 0.5),
      this.add.text(-108, 105, 'tap the gold button on the right', textStyle(16, INK_GREY)).setOrigin(0, 0.5),
    ];
    const popup = this.add.container(196, 232, [card, lines, ...bigMove]).setDepth(DEPTH.hud + 5);
    this.showPopup(popup, 4000);
  }

  /** The kinds of special tiles on this map, in a fixed order. */
  private tilesOnMap(): TileKind[] {
    const kinds: TileKind[] = [];
    if (this.level.mud.length) kinds.push('mud');
    if (this.level.brambles.length) kinds.push('brambles');
    for (const nest of ['hill', 'water'] as const) if (this.level.specialNests.some((n) => n.kind === nest)) kinds.push(nest);
    return kinds;
  }

  /** A tile's name and what it does, in words a kid can read. */
  private tileWords(kind: TileKind): { name: string; text: string } {
    if (kind === 'mud' || kind === 'brambles') return { name: TILES[kind].name, text: TILES[kind].description };
    return { name: TILES.nests[kind].name, text: `A duck in this nest ${TILES.nests[kind].description}.` };
  }

  /** A little picture of a tile, for the map key and info cards. */
  private tileIcon(kind: TileKind, x: number, y: number): Phaser.GameObjects.GameObject {
    const g = this.add.graphics().setPosition(x, y);
    switch (kind) {
      case 'mud':
        g.fillStyle(0x4a3322).fillEllipse(0, 2, 34, 18).fillStyle(0x5e4230).fillEllipse(0, 0, 26, 12);
        g.fillStyle(0xffffff, 0.3).fillEllipse(-5, -2, 10, 3);
        return g;
      case 'brambles':
        g.fillStyle(0x4f7a2e).fillCircle(0, 0, 13).lineStyle(3, COLORS.ink).strokeCircle(0, 0, 13);
        for (const a of [0, 1.2, 2.4, 3.6, 4.8]) {
          const cx = Math.cos(a) * 13;
          const cy = Math.sin(a) * 13;
          g.fillStyle(0xf2e6c8).fillTriangle(cx - 3, cy, cx + 3, cy, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
        }
        g.fillStyle(0x6a2a5a).fillCircle(4, -3, 3.5);
        return g;
      case 'hill':
        g.fillStyle(0x5f9e3c).fillEllipse(0, 6, 34, 14).fillStyle(0x5f9e3c).fillTriangle(-11, 6, 0, -10, 11, 6);
        g.fillStyle(0xffffff).fillTriangle(-4, -4, 0, -10, 4, -4);
        return g;
      case 'water':
        g.destroy();
        return this.add.image(x, y, 'power-splash').setDisplaySize(28, 28);
    }
  }

  /** What a tile does, shown when you tap it. */
  private showTileInfo(kind: TileKind, at: Point): void {
    this.cancelMove();
    this.closePopup();
    playSound(this, 'tap');
    const { name, text } = this.tileWords(kind);
    const card = drawCard(this.add.graphics(), 320, 130, { radius: 18 });
    const popup = this.add
      .container(Math.max(170, Math.min(WORLD.width - 170, at.x)), at.y + (at.y < 300 ? 120 : -120), [
        card,
        this.tileIcon(kind, -126, -34),
        this.add.text(-100, -34, name, textStyle(24, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        this.add.text(-142, -6, text, { ...textStyle(17, INK), wordWrap: { width: 284 } }).setOrigin(0, 0),
      ])
      .setDepth(DEPTH.hud + 5);
    this.showPopup(popup, 5000);
  }

  /** "On this map": a key to the special tiles, shown when a level starts. Fades on its own. */
  private showMapKey(): void {
    if (this.popup || isOver(this.state)) return;
    const kinds = this.tilesOnMap();
    const W = 460;
    const rowH = 56;
    const H = 64 + kinds.length * rowH;
    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(this.add.graphics(), W, H, { radius: 20, border: COLORS.gold, borderWidth: 5 }),
      this.add.text(0, -H / 2 + 30, 'On this map', textStyle(26, { ...INK, weight: '700' })).setOrigin(0.5),
    ];
    kinds.forEach((kind, i) => {
      const y = -H / 2 + 76 + i * rowH;
      const { name, text } = this.tileWords(kind);
      parts.push(
        this.tileIcon(kind, -W / 2 + 36, y),
        this.add.text(-W / 2 + 64, y - 12, name, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        this.fitWidth(this.add.text(-W / 2 + 64, y + 12, text, textStyle(17, INK)).setOrigin(0, 0.5), W - 84),
      );
    });
    const popup = this.add.container(WORLD.width / 2, 250 + H / 2 - 60, parts).setDepth(DEPTH.hud + 5);
    this.showPopup(popup, 9000);
  }

  /** What the solar fountain does, shown when you tap it. */
  private showFountainInfo(): void {
    const at = this.state.battle.fountain?.position;
    if (!at) return;
    this.cancelMove();
    this.closePopup();
    playSound(this, 'tap');
    const boost = Math.round(FOUNTAIN.damageBoost * 100);
    const card = drawCard(this.add.graphics(), 320, 170, { radius: 18 });
    const popup = this.add
      .container(Math.max(170, Math.min(WORLD.width - 170, at.x)), at.y + (at.y < 300 ? 150 : -150), [
        card,
        this.add.image(-118, -46, 'fountain').setDisplaySize(52, 52),
        this.add.text(-84, -58, 'Solar Fountain', textStyle(26, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        this.add.image(-76, -30, 'icon-bolt').setDisplaySize(20, 20),
        this.add.text(-62, -30, 'Runs on the battery', textStyle(17, { ...INK, color: COLORS.blueDarkCss, weight: '700' })).setOrigin(0, 0.5),
        this.add
          .text(-142, 4, `Ducks in its spray hit ${boost}% harder while the battery has charge. The sun charges it by day; it runs down at night.`, {
            ...textStyle(16, INK),
            wordWrap: { width: 284 },
          })
          .setOrigin(0, 0),
      ])
      .setDepth(DEPTH.hud + 5);
    this.showPopup(popup, 5000);
  }

  /** The panel for a placed duck: its power, Pecking Loop status, and Move / Sell buttons. */
  private openDuckPanel(duckId: number): void {
    const duck = findDuck(this.state.battle, duckId);
    const sprite = this.duckSprites.get(duckId);
    if (!duck || !sprite) return;
    this.cancelMove();
    this.closePopup();
    playSound(this, 'tap');
    this.focusedDuckId = duckId;
    sprite.range.setStrokeStyle(4, 0xffffff, 0.8);
    this.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.12, duration: 90, yoyo: true });

    // Taps anywhere outside the panel close it.
    const scrim = this.tapCatcher(DEPTH.hud + 4, () => this.closePopup());

    const partner = chasePartner(this.state.battle, duck)?.kind;
    const final = isFinalChoice(duck.kind, duck.level);
    const H = final ? 620 : 530; // panel height; content is laid out from its center (the final choice needs two cards)
    const lift = final ? 40 : 0; // the taller panel's top half moves up so the two cards get the room
    const card = drawCard(this.add.graphics(), 310, H, { radius: 18 });
    const block = this.add.zone(0, 0, 310, H).setInteractive(); // taps on the panel itself don't close it
    const info = this.add.container(0, -150 - lift, this.duckInfoLines(duck.kind, partner, duck.level, duck.path));
    const stats = this.drawDuckReport(duckId, duck.kind, 0, -50 - lift);
    const aim = this.drawTargetingButtons(duckId, duck.kind, 0, 2 - lift);
    const divider = this.add.rectangle(0, 44 - lift, 270, 3, COLORS.ink, 0.12);
    const parts: Phaser.GameObjects.GameObject[] = [card, block, info, stats, aim, divider];

    // Upgrade section.
    const next = nextUpgrade(duck.kind, duck.level);
    if (final) {
      // The final upgrade: pick one of two paths (and keep it).
      parts.push(this.add.text(0, 64 - lift, 'Final upgrade: pick one!', textStyle(20, { ...INK, color: COLORS.textGold, weight: '700' })).setOrigin(0.5));
      upgradeOptions(duck.kind, duck.level).forEach((option, path) => {
        const x = path === 0 ? -71 : 71;
        const affordable = canUpgrade(this.state, duckId, path);
        parts.push(
          drawCard(this.add.graphics(), 140, 170, { radius: 12, fill: COLORS.creamSelected, border: COLORS.gold, borderWidth: 3 }).setPosition(x, 165 - lift),
          this.add.text(x, 86 - lift, option.name, { ...textStyle(18, { ...INK, weight: '700' }), align: 'center', wordWrap: { width: 132 } }).setOrigin(0.5, 0),
          // Names can take two lines, so the words hang below the name's longest case.
          this.add
            .text(x, 134 - lift, option.description, { ...textStyle(15, INK), align: 'center', wordWrap: { width: 130 } })
            .setOrigin(0.5, 0),
          this.priceButton(x, 222 - lift, option.cost, affordable, () => this.upgrade(duckId, path), { width: 124, height: 38, fontSize: 20 }),
        );
      });
    } else if (next) {
      const affordable = canUpgrade(this.state, duckId);
      parts.push(
        this.add.text(-138, 68, `Upgrade: ${next.name}`, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        this.add.text(-138, 94, next.description, { ...textStyle(16, INK), wordWrap: { width: 276 } }).setOrigin(0, 0.5),
        this.priceButton(0, 146, next.cost, affordable, () => this.upgrade(duckId)),
      );
    } else if (trainingCost(this.state, duckId) !== undefined) {
      // Endless Pond: keep training a fully upgraded duck.
      const cost = trainingCost(this.state, duckId)!;
      const affordable = this.state.peas >= cost;
      const boost = Math.round(ENDLESS.training.damage * 100);
      parts.push(
        this.add.text(-138, 68, `Train: level ${duck.training + 1}`, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        this.add.text(-138, 94, `Hits ${boost}% harder every time you train.`, { ...textStyle(16, INK), wordWrap: { width: 276 } }).setOrigin(0, 0.5),
        this.priceButton(0, 146, cost, affordable, () => this.train(duckId)),
      );
    } else {
      parts.push(this.add.text(0, 110, 'Fully upgraded!', textStyle(26, { color: COLORS.goldCss, weight: '700' })).setOrigin(0.5));
    }

    const sellable = canSell(this.state);
    parts.push(
      drawBigButton(this, sellable ? -92 : 0, H / 2 - 43, 'Move', COLORS.blue, COLORS.blueDark, () => this.startMove(duckId), {
        width: 104,
        height: 54,
        fontSize: 24,
      }),
    );
    // Sell says so, and shows how many peas you get back (upgrades included; everything, for a
    // duck placed since the last wave). A Daily Challenge can turn it off.
    if (sellable) {
      parts.push(
        drawBigButton(this, 40, H / 2 - 43, `Sell +${shortNumber(refundFor(duck))}`, COLORS.orange, COLORS.orangeDark, () => this.sell(duckId), {
          width: 150,
          height: 54,
          fontSize: 22,
          icon: 'icon-pea',
        }),
      );
    }

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
    this.popIn(panel);
    const container = this.add.container(0, 0, [scrim, panel]).setDepth(DEPTH.hud + 4);
    this.popup = container;
  }

  /** Three numbers for a placed duck: predators chased off, its power's count, and damage. Kept up to date while open. */
  private drawDuckReport(duckId: number, kind: DuckKind, x: number, y: number): Phaser.GameObjects.Container {
    const labels = ['Chased off', DUCKS[kind].power.stat, 'Damage'];
    const values = labels.map((label, i) => {
      const cx = (i - 1) * 96;
      return {
        value: this.add.text(cx, -9, '0', textStyle(21, { ...INK, weight: '700' })).setOrigin(0.5),
        label: this.add.text(cx, 12, label, textStyle(16, INK_GREY)).setOrigin(0.5),
      };
    });
    const back = this.add.graphics().fillStyle(COLORS.ink, 0.06).fillRoundedRect(-140, -24, 280, 48, 12);
    const row = this.add.container(x, y, [back, ...values.flatMap((v) => [v.value, v.label])]);
    const refresh = () => {
      const report = findDuck(this.state.battle, duckId)?.report;
      if (!report) return;
      [report.chasedOff, report.special, report.damage].forEach((n, i) => values[i]!.value.setText(shortNumber(n)));
    };
    refresh();
    this.panelReport = { row, refresh };
    return row;
  }

  /** "Aim at" buttons: which predator this duck goes after. The chosen one is gold. */
  private drawTargetingButtons(duckId: number, kind: DuckKind, x: number, y: number): Phaser.GameObjects.Container {
    const W = 70;
    const H = 60;
    const row = this.add.container(x, y);
    const cards: { targeting: Targeting; card: Phaser.GameObjects.Graphics }[] = [];
    const refresh = () => {
      const duck = findDuck(this.state.battle, duckId);
      for (const { targeting, card } of cards) {
        const on = duck?.targeting === targeting;
        drawCard(card, W, H, { radius: 12, fill: on ? COLORS.creamSelected : COLORS.cream, border: on ? COLORS.gold : COLORS.ink, borderWidth: on ? 5 : 2 });
      }
    };
    TARGETING_ORDER.forEach((targeting, i) => {
      const bx = (i - (TARGETING_ORDER.length - 1) / 2) * (W + 6);
      const card = this.add.graphics();
      const label = this.add
        .text(0, 17, TARGETING[targeting].name, textStyle(17, { color: COLORS.inkCss, strokeThickness: 0, weight: '700' }))
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

  private upgrade(duckId: number, path = 0): void {
    const duck = findDuck(this.state.battle, duckId);
    const sprite = this.duckSprites.get(duckId);
    if (!duck || !sprite) return;
    if (!upgradeDuck(this.state, duckId, path)) {
      // Not enough peas: show the panel again.
      this.wigglePeas();
      this.openDuckPanel(duckId);
      return;
    }
    playSound(this, 'upgrade');
    this.showDuckLevel(sprite, duck);
    const { x, y } = duck.position;
    this.fx.sparkles.explode(24, x, y - 30);
    this.ring(x, y - 30, 60, COLORS.gold, 400);
    this.floatText({ x, y: y - 80 }, nameAt(duck.kind, duck.level, duck.path), COLORS.goldCss);
    this.drawPeckingLoop();
    this.refreshHud();
    this.openDuckPanel(duckId);
  }

  /** Endless Pond: train a fully upgraded duck to hit harder. */
  private train(duckId: number): void {
    const duck = findDuck(this.state.battle, duckId);
    const sprite = this.duckSprites.get(duckId);
    if (!duck || !sprite) return;
    if (!trainDuck(this.state, duckId)) {
      this.wigglePeas();
      this.openDuckPanel(duckId);
      return;
    }
    playSound(this, 'upgrade');
    this.showTraining(sprite, duck.training);
    const { x, y } = duck.position;
    this.fx.stars.explode(14, x, y - 30);
    this.floatText({ x, y: y - 80 }, `Training ${duck.training}!`, COLORS.goldCss);
    this.refreshHud();
    this.openDuckPanel(duckId);
  }

  /** A trained duck shows its training level in a little gold star by its feet. */
  private showTraining(sprite: DuckSprite, training: number): void {
    if (!sprite.training) {
      const star = this.add.image(0, 0, 'star').setDisplaySize(30, 30).setTint(COLORS.gold);
      const text = this.add.text(0, 1, '', textStyle(14, { weight: '700', strokeThickness: 3 })).setOrigin(0.5);
      sprite.training = this.add.container(30, 8, [star, text]);
      sprite.root.add(sprite.training);
    }
    (sprite.training.list[1] as Phaser.GameObjects.Text).setText(String(training));
    this.tweens.add({ targets: sprite.training, scale: { from: 1.5, to: 1 }, duration: 250, ease: 'Back.Out' });
  }

  /** Upgraded ducks grow a little, wear gold chevrons, and reach as far as their new stats. */
  private showDuckLevel(sprite: DuckSprite, duck: Duck): void {
    const { level } = duck;
    // Stop any bounce first, or it would finish by snapping back to the old size.
    this.tweens.killTweensOf(sprite.art);
    const size = sprite.baseSize * (1 + 0.07 * level);
    sprite.art.setDisplaySize(size, size).setY(-size * 0.28);
    this.tweens.add({ targets: sprite.art, y: sprite.art.y - 3, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    sprite.range.setRadius(duckStats(this.state.battle, duck).range);
    const g = sprite.badge.clear();
    for (let i = 0; i < level; i++) {
      const cy = 16 - i * 9;
      const points = [new Phaser.Math.Vector2(-10, cy + 5), new Phaser.Math.Vector2(0, cy - 4), new Phaser.Math.Vector2(10, cy + 5)];
      g.lineStyle(7, COLORS.ink).strokePoints(points);
      g.lineStyle(4, COLORS.gold).strokePoints(points);
    }
  }

  /** Selling a duck that's been through a wave loses peas, so ask first. A duck placed since the last wave is a free undo. */
  private sell(duckId: number): void {
    const duck = findDuck(this.state.battle, duckId);
    if (duck && !duck.fresh) {
      this.confirmSell(duckId);
      return;
    }
    this.sellNow(duckId);
  }

  private confirmSell(duckId: number): void {
    const duck = findDuck(this.state.battle, duckId);
    this.closePopup();
    if (!duck) return;
    const scrim = this.tapCatcher(DEPTH.hud + 4, () => this.closePopup());
    const card = this.add.container(WORLD.width / 2, WORLD.height / 2, [
      drawCard(this.add.graphics(), 460, 300, { radius: 24, borderWidth: 5 }),
      this.add.zone(0, 0, 460, 300).setInteractive(),
      this.add.text(0, -104, `Sell ${DUCKS[duck.kind].name}?`, textStyle(40, { weight: '700', color: COLORS.goldCss, strokeThickness: 8 })).setOrigin(0.5),
      this.add.text(0, -54, `You'll get ${shortNumber(refundFor(duck))} peas back.`, textStyle(24, INK)).setOrigin(0.5),
      // "No" is the big green one: keeping the duck is the safe choice.
      drawBigButton(this, 0, 20, 'No, keep it', COLORS.green, COLORS.greenDark, () => this.closePopup(), { width: 360, height: 80, fontSize: 34 }),
      drawBigButton(this, 0, 110, 'Sell', COLORS.orange, COLORS.orangeDark, () => this.sellNow(duckId), { width: 200, height: 64, fontSize: 28 }),
    ]).setDepth(DEPTH.hud + 5);
    this.popIn(card);
    this.popup = this.add.container(0, 0, [scrim, card]).setDepth(DEPTH.hud + 4);
  }

  private sellNow(duckId: number): void {
    const duck = findDuck(this.state.battle, duckId);
    const sprite = this.duckSprites.get(duckId);
    this.closePopup();
    if (!duck || !sprite) return;
    const at = { ...duck.position };
    const refund = sellDuck(this.state, duckId);
    if (refund === undefined) return;
    playSound(this, 'sell');
    this.duckSprites.delete(duckId);
    sprite.range.destroy();
    killTweensDeep(this, sprite.root);
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
    marks.push(this.tapCatcher(DEPTH.path + 0.8, () => this.cancelMove()));
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

  cancelMove(): void {
    if (!this.moving) return;
    const { duckId, marks } = this.moving;
    this.moving = undefined;
    for (const mark of marks) {
      this.tweens.killTweensOf(mark);
      mark.destroy();
    }
    const duck = findDuck(this.state.battle, duckId);
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
    // A hill nest changes how far it reaches.
    const moved = findDuck(this.state.battle, duckId);
    if (moved) range.setRadius(duckStats(this.state.battle, moved).range);
    this.announceNest(target);
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
        .text((a.x + b.x) / 2, (a.y + b.y) / 2, '♥', textStyle(28, { color: COLORS.pinkCss, stroke: '#ffffff', strokeThickness: 5 }))
        .setOrigin(0.5);
      this.peckingLoop.add(heart);
      this.tweens.add({ targets: heart, scale: 1.3, duration: 500, yoyo: true, repeat: -1 });
    }
  }

  // --- Predators -----------------------------------------------------------

  addEnemySprite(enemy: Enemy): void {
    const pos = enemyPosition(enemy);
    const flying = isFlying(enemy);
    const root = this.add.container(pos.x, pos.y);
    let art: Phaser.GameObjects.Image;
    let ripple: Phaser.GameObjects.Ellipse | undefined;
    let waddle: Phaser.Tweens.Tween;
    if (flying) {
      // Hawks cast a shadow below them, and point where they're diving.
      const size = FLYING_SIZES[enemy.kind as keyof typeof FLYING_SIZES] ?? 88;
      root.add(this.add.ellipse(0, size * 0.4, size * 0.57, size * 0.18, 0x000000, 0.18));
      const [from, to] = enemy.path.points;
      art = this.add
        .image(0, 0, enemy.kind)
        .setDisplaySize(size, size)
        .setRotation(Math.atan2(to!.y - from!.y, to!.x - from!.x) + Math.PI / 2);
      waddle = this.tweens.add({ targets: art, scaleX: art.scaleX * 0.8, duration: 170, yoyo: true, repeat: -1 });
      root.setDepth(DEPTH.effects - 1);
    } else {
      const look = GROUND_LOOKS[enemy.kind as keyof typeof GROUND_LOOKS];
      root.add(this.add.ellipse(0, 4, look.shadow, 16, 0x000000, 0.2));
      // Dusty ring at its feet while Curtis slows it.
      ripple = this.add.ellipse(0, 4, look.shadow + 14, 24).setStrokeStyle(4, SLOW_RING, 0.95).setVisible(false);
      this.tweens.add({ targets: ripple, scale: 1.15, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
      root.add(ripple);
      art = this.add.image(0, 0, enemy.kind).setDisplaySize(look.width, look.height).setOrigin(0.5, 0.85);
      waddle = this.tweens.add({ targets: art, angle: { from: -look.wobble, to: look.wobble }, duration: look.wobbleTime, yoyo: true, repeat: -1 });
      // Turtles climb out of the pond with a splash.
      if (ENEMIES[enemy.kind].fromPond) this.fx.splash.explode(16, pos.x, pos.y - 10);
    }
    root.add(art);

    const hpBack = this.add.rectangle(0, 0, HP_BAR_WIDTH + 4, 10, COLORS.ink).setOrigin(0.5);
    const hpFill = this.add.rectangle(-HP_BAR_WIDTH / 2, 0, HP_BAR_WIDTH, 6, 0x6ee06e).setOrigin(0, 0.5);
    const boss = !!ENEMIES[enemy.kind].boss;
    // Health bar and dizzy stars sit just above the predator's head, however big it is.
    const top = flying ? -art.displayHeight / 2 : -art.displayHeight * 0.85;
    const hpBar = this.add.container(0, top - 8, [hpBack, hpFill]).setVisible(false);
    const dizzy = this.add
      .container(0, boss ? top - 4 : top + 6, [
        this.add.image(-12, 0, 'star').setDisplaySize(16, 16).setTint(COLORS.goldLight),
        this.add.image(12, 0, 'star').setDisplaySize(16, 16).setTint(COLORS.goldLight),
      ])
      .setVisible(false);
    this.tweens.add({ targets: dizzy, angle: 360, duration: 900, repeat: -1 });
    root.add([hpBar, dizzy]);
    // Fade in, so a predator entering near the edge of a wide screen doesn't pop into view.
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.enemySprites.set(enemy.id, { root, art, ripple, hpBar, hpFill, dizzy, lastX: pos.x, flashUntil: 0, waddle, nextTileFx: 0 });
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
      // The boss the big bar at the bottom follows doesn't need its own little one.
      sprite.hpBar.setVisible(health < 1 && !this.bosses.follows(enemy.id));
      this.bosses.syncHealth(enemy.id, health);
      sprite.hpFill.width = HP_BAR_WIDTH * health;
      sprite.hpFill.fillColor = health > 0.5 ? 0x6ee06e : health > 0.25 ? COLORS.gold : COLORS.coral;
      sprite.dizzy.setVisible(enemy.stopTime > 0);

      // A dusty ring at its feet while Curtis slows it.
      sprite.ripple?.setVisible(enemy.slowed);
      // Minks (and sneaky variants) hiding in the grass are hard to see until Chester's quack flushes them out.
      if (enemyStats(enemy).sneaky) sprite.art.setAlpha(isHidden(enemy) ? HIDDEN_ALPHA : 1);
      const muddy = this.showTileEffects(enemy, sprite, time);
      // A quick red "ouch" tint when hit (keeps the art readable even when hit constantly).
      if (time < sprite.flashUntil) sprite.art.setTint(0xff9a9a);
      else if (enemy.stopTime > 0 && enemy.weakness > 0) sprite.art.setTint(0xd2b4ff); // Wise Old Chester's weakness
      else if (enemy.soakedTime > 0) sprite.art.setTint(0x9fd0ff); // soaked by a Soggy Splash
      else if (muddy) sprite.art.setTint(0xc4a07c); // splattered with mud
      else if (enemy.variant) sprite.art.setTint(VARIANTS[enemy.variant].tint); // a variant wears its colour
      else sprite.art.clearTint();
    }
  }

  /**
   * Mud and brambles show what they're doing: predators in mud turn muddy, splash, waddle
   * in slow motion, and sometimes say "Squelch!"; predators in brambles flash, shed thorny
   * bits, and sometimes yell "Ouch!". Returns whether it's in mud.
   */
  private showTileEffects(enemy: Enemy, sprite: EnemySprite, time: number): boolean {
    const muddy = inMud(this.state.battle, enemy);
    // (Prickly Curtis, a boss reward, prickles predators in his slow zone just like brambles.)
    const prickly = inBrambles(this.state.battle, enemy) || (this.state.battle.mods.prickle > 0 && enemy.slowed);
    sprite.waddle.timeScale = muddy ? 0.4 : 1;
    if (!(muddy || prickly) || time < sprite.nextTileFx || this.state.phase !== 'wave') return muddy;
    sprite.nextTileFx = time + (muddy ? 320 : 450);
    const { x, y } = sprite.root;
    if (muddy) {
      this.fx.mudSplash.explode(5, x, y);
      if (time > this.nextSquelchAt) {
        this.nextSquelchAt = time + 3500;
        popSpeechBubble(this, x, y - 60, 'Squelch!', DEPTH.floatText);
      }
    }
    if (prickly) {
      sprite.flashUntil = time + 100;
      this.fx.thorns.explode(3, x, y - 20);
      if (time > this.nextOuchAt) {
        this.nextOuchAt = time + 3500;
        popSpeechBubble(this, x, y - 60, 'Ouch!', DEPTH.floatText);
      }
    }
    return muddy;
  }

  private removeEnemySprite(id: number, how: 'defeated' | 'house' | 'shooed'): void {
    const sprite = this.enemySprites.get(id);
    if (!sprite) return;
    this.enemySprites.delete(id);
    killTweensDeep(this, sprite.root, ...(sprite.ripple ? [sprite.ripple] : []));
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
        if (ENEMIES[event.enemy.kind].boss) this.bosses.showEntrance(event.enemy);
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
      case 'bossPhase':
        this.bosses.showPhase(event.enemy, event.position);
        break;
      case 'sprayed':
        playSound(this, 'noPeas');
        this.fx.puff.explode(18, event.position.x, event.position.y - 20);
        popSpeechBubble(this, event.position.x, event.position.y - 60, 'Pffft!', DEPTH.floatText);
        break;
      case 'defeated':
        playSound(this, 'chasedOff');
        this.removeEnemySprite(event.enemy.id, 'defeated');
        this.flyPea(event.position, killPeas(this.state, event.enemy));
        if (ENEMIES[event.enemy.kind].boss) {
          playSound(this, 'bossDefeated');
          this.bosses.showGone(event.position, `${ENEMIES[event.enemy.kind].name} ran away!`);
        }
        break;
      case 'reachedHouse':
        playSound(this, 'heartLost');
        this.removeEnemySprite(event.enemy.id, 'house');
        this.showHouseRaid();
        this.hints.maybe({ type: 'heartLost', enemy: event.enemy.kind });
        if (ENEMIES[event.enemy.kind].boss) this.bosses.showGone(this.house, `${ENEMIES[event.enemy.kind].name} raided the snacks!`);
        break;
      case 'shooed':
        playSound(this, 'shoo');
        this.removeEnemySprite(event.enemy.id, 'shooed');
        popSpeechBubble(this, this.house.x, this.house.y - 150, 'Shoo!', DEPTH.floatText);
        if (ENEMIES[event.enemy.kind].boss) this.bosses.showGone(this.house, `Craig shooed ${midSentence(ENEMIES[event.enemy.kind].name)}!`);
        break;
      case 'waveCleared':
        playSound(this, 'waveCleared');
        // After the last wave the win screen takes over, so no banner for it.
        if (event.waveIndex + 1 < this.state.waves.length) this.showBanner(`Wave ${event.waveIndex + 1} cleared!`, event.bonus);
        break;
      case 'won':
      case 'lost': {
        // The rules for what a finished game means (score, stars, new best, ribbons, hats) live in logic/run.ts.
        const { outcome, progress } = finishRun(this.state, this.mode(), loadProgress());
        if (!this.sandbox) saveProgress(progress);
        const result: ResultSceneData = { ...outcome, report: this.state.battle.report };
        this.time.delayedCall(1000, () => this.scene.start('ResultScene', result));
        break;
      }
    }
  }

  /** A placed duck and its picture, if it's still on the map. */
  duckSprite(duckId: number): { sprite: DuckSprite; duck: Duck } | undefined {
    const duck = findDuck(this.state.battle, duckId);
    const sprite = this.duckSprites.get(duckId);
    return duck && sprite ? { sprite, duck } : undefined;
  }

  private showAttack(duckId: number, target: Point, hitIds: number[], wingFlap: boolean): void {
    const found = this.duckSprite(duckId);
    if (!found) return;
    const { sprite, duck } = found;
    const { kind, position } = duck;
    sprite.art.setFlipX(target.x < position.x);

    const flash = () => {
      for (const id of hitIds) {
        const enemy = this.enemySprites.get(id);
        if (enemy) enemy.flashUntil = this.time.now + 80;
      }
    };

    if (kind === 'sunny') {
      // A water ball, then a splash.
      const { splashRadius } = duckStats(this.state.battle, duck);
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
          this.ring(target.x, target.y - 20, splashRadius, COLORS.water, 250);
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

  ring(x: number, y: number, radius: number, color: number, duration: number): void {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(4, color).setDepth(DEPTH.effects);
    this.tweens.add({ targets: ring, radius, alpha: 0, duration, onComplete: () => ring.destroy() });
  }

  private showAlarmQuack(duckId: number): void {
    const found = this.duckSprite(duckId);
    if (!found) return;
    const { sprite, duck } = found;
    const { position } = duck;
    this.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.2, duration: 100, yoyo: true });
    const { range } = duckStats(this.state.battle, duck);
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
      if (found) popSpeechBubble(this, found.duck.position.x, found.duck.position.y - 70, 'Eek!', DEPTH.floatText);
    });
    for (const id of fearlessIds) {
      const found = this.duckSprite(id);
      if (!found) continue;
      playSound(this, 'nope');
      popSpeechBubble(this, found.duck.position.x, found.duck.position.y - 70, 'Meh.', DEPTH.floatText);
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
      if (sprite.hat) placeHat(sprite.hat, sprite.art);
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
  flyPea(from: Point, amount: number): void {
    this.floatText({ x: from.x, y: from.y - 40 }, `+${amount}`, COLORS.peaCss);
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

  floatText(at: Point, message: string, color: string): void {
    const text = this.add.text(at.x, at.y, message, textStyle(26, { color, weight: '700' })).setOrigin(0.5);
    text.setDepth(DEPTH.floatText);
    this.tweens.add({ targets: text, y: at.y - 40, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }

  /** Shows a big banner in the middle of the screen. If one is already up, this one waits its turn. */
  showBanner(message: string, bonus = 0): void {
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
        this.add.text(-4, 0, `+${bonus}`, textStyle(32, { weight: '700', color: COLORS.peaCss })).setOrigin(0, 0.5),
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

  // --- Bosses (the Night Bandit, and the Endless Pond's others) -------------------

  private showSummon(bossId: number, minions: Enemy[]): void {
    const boss = this.enemySprites.get(bossId);
    playSound(this, 'whistle');
    const summoner = this.state.battle.enemies.find((e) => e.id === bossId);
    const say = summoner && ENEMIES[summoner.kind].quips?.summon;
    if (boss && say) popSpeechBubble(this, boss.root.x, boss.root.y - 110, say, DEPTH.floatText);
    for (const minion of minions) {
      this.addEnemySprite(minion);
      const pos = enemyPosition(minion);
      this.fx.puff.explode(8, pos.x, pos.y - 20);
    }
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
      this.waveStartedAt = this.time.now;
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
      // A double-tap on "go" lands here; don't let it change the speed.
      if (this.time.now - this.waveStartedAt < SPEED_TAP_GUARD * 1000) return;
      speedIndex = (speedIndex + 1) % GAME_SPEEDS.length;
      playSound(this, 'tap');
      this.tweens.add({ targets: container, scale: 0.88, duration: 70, yoyo: true });
      draw();
    });
    return { container, draw };
  }

  /** A small round pause button (Esc works too). It opens the pause menu: play, again, or levels. */
  private drawPauseButton(): void {
    const bars = this.add.graphics().fillStyle(0xffffff).lineStyle(3, COLORS.ink);
    for (const x of [-9, 3]) bars.fillRoundedRect(x, -10, 6, 20, 2).strokeRoundedRect(x, -10, 6, 20, 2);
    const back = this.add.circle(0, 0, 26, COLORS.panel, 0.7).setStrokeStyle(3, 0xffffff, 0.35);
    // Tap area bigger than the drawing, for fingers (but not reaching the sound button below).
    back
      .setInteractive({ hitArea: new Phaser.Geom.Circle(26, 26, 32), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true })
      .on('pointerdown', () => this.pauseGame());
    this.add.container(PAUSE_BUTTON.x, PAUSE_BUTTON.y, [back, bars]).setDepth(DEPTH.hud);
    this.input.keyboard?.on('keydown-ESC', () => this.pauseGame());
  }

  /** Freezes the game (predators, ducks, timers, everything) and shows the pause menu over it. */
  private pauseGame(): void {
    if (isOver(this.state) || this.scene.isPaused()) return;
    playSound(this, 'tap');
    const data: PauseSceneData = {
      again: this.mode(),
      difficulty: this.difficulty,
      // Leaving an Endless Pond run part-way still counts the waves survived so far.
      onLeave: () => {
        if (this.endless) saveProgress(recordEndless(loadProgress(), this.difficulty, this.levelIndex, endlessWavesSurvived(this.state)));
      },
    };
    this.scene.launch('PauseScene', data);
    this.scene.pause();
  }

  /** Craig's Guardian Blessing: tap her once per level to shield the duck house. */
  private drawCraigButton(): Phaser.GameObjects.Container {
    this.craigGlow = this.add.image(0, 0, 'glow').setDisplaySize(170, 170).setTint(COLORS.goldLight).setAlpha(0.6);
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
