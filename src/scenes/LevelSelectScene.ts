import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { drawGrass, drawOutskirts } from '../art/terrain';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { LEVELS } from '../data/levels';
import { TRIALS } from '../data/trials';
import { parseLevel, type Level } from '../logic/level';
import { ENDLESS } from '../data/endless';
import { dailyDate, dailyFor } from '../logic/daily';
import { dailyRecord, dailyStreak, endlessBest, hasWonTrial, isUnlocked, trialsUnlocked, trialsWon, type LevelRecord, type Progress } from '../logic/progress';
import { loadProgress } from '../save';
import { COLORS, DIFFICULTY_COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBackButton, drawBigButton, drawCard, drawRoundButton, drawSoundButton, fadeToScene } from '../ui/widgets';
import type { GameSceneData } from './GameScene';

export interface LevelSelectSceneData {
  difficulty: Difficulty;
}

// Two rows of four cards (room for eight levels): a little map on the left, the level's
// number, stars, and trial ribbons on the right. Tap one to open the level sheet.
const CARD = { width: 290, height: 170, spacing: 305, perRow: 4, rows: [250, 438] };
const MAP = { width: 136, height: 76 }; // 16:9, like the real map
const MODE_BUTTON = { width: 430, height: 84, gap: 24 }; // Daily Challenge and Endless Pond, side by side
// The level sheet: a big map, stars and best score, a Play button, and the level's trials.
// Its height grows by a row for each trial (three fit).
const SHEET = { width: 860, baseHeight: 398, map: { width: 320, height: 180 }, trialRow: 78 };
const DEPTH = { sheet: 200 };

export class LevelSelectScene extends Phaser.Scene {
  private difficulty: Difficulty = 'easy';
  private progress!: Progress;
  /** The open level sheet, if any. */
  private sheet?: Phaser.GameObjects.Container;

  constructor() {
    super('LevelSelectScene');
  }

  init(data: Partial<LevelSelectSceneData>): void {
    this.difficulty = data.difficulty ?? 'easy';
  }

  create(): void {
    setupCamera(this);
    drawGrass(this, 51);
    drawOutskirts(this, 52);
    const progress = loadProgress();
    this.progress = progress;
    this.sheet = undefined;
    const cx = WORLD.width / 2;

    this.add.text(cx, 70, 'Pick a level', textStyle(64, { weight: '700', strokeThickness: 10 })).setOrigin(0.5);
    const chipColor = DIFFICULTY_COLORS[this.difficulty].css;
    this.add
      .text(cx, 128, DIFFICULTIES[this.difficulty].label, textStyle(28, { color: chipColor, stroke: '#ffffff', strokeThickness: 6 }))
      .setOrigin(0.5);

    // Rows of cards (CARD.rows has room for two rows: eight levels).
    LEVELS.forEach((info, i) => {
      const row = Math.floor(i / CARD.perRow);
      const inRow = Math.min(CARD.perRow, LEVELS.length - row * CARD.perRow);
      const col = i % CARD.perRow;
      const x = cx + (col - (inRow - 1) / 2) * CARD.spacing;
      const y = CARD.rows[row] ?? CARD.rows[CARD.rows.length - 1]!;
      this.drawLevelCard(x, y, i, parseLevel(info.map), isUnlocked(progress, this.difficulty, i));
    });

    this.drawDailyButton(cx - (MODE_BUTTON.width + MODE_BUTTON.gap) / 2, 620, progress);
    this.drawEndlessButton(cx + (MODE_BUTTON.width + MODE_BUTTON.gap) / 2, 620, progress);

    // Back to the title screen.
    drawBackButton(this, () => fadeToScene(this, 'TitleScene'));

    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 100);
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private drawLevelCard(x: number, y: number, index: number, level: Level, unlocked: boolean): void {
    const name = LEVELS[index]!.name;
    const stars = this.progress.levels[this.difficulty][index]?.stars ?? 0;
    const card = drawCard(this.add.graphics(), CARD.width, CARD.height, { radius: 22, borderWidth: 4 });
    const parts: Phaser.GameObjects.GameObject[] = [card, this.drawMiniMap(level, -64, -24, MAP)];
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const right = 72; // the stars and ribbons sit in a column to the right of the map
    parts.push(this.add.text(right, -56, `Level ${index + 1}`, textStyle(18, { ...ink, color: '#8a7f85' })).setOrigin(0.5));
    parts.push(this.add.text(0, 50, name, textStyle(name.length > 12 ? 22 : 26, { ...ink, weight: '700' })).setOrigin(0.5));
    for (let s = 0; s < 3; s++) {
      parts.push(
        this.add
          .image(right + (s - 1) * 34, -24, 'star')
          .setDisplaySize(32, 32)
          .setTint(s < stars ? 0xffd23f : 0xd8d2cc),
      );
    }
    // A ribbon for each of the level's trials: pink once it's won.
    const trials = TRIALS[index] ?? [];
    trials.forEach((trial, t) => {
      const won = hasWonTrial(this.progress, this.difficulty, trial.id);
      parts.push(
        this.add
          .image(right + (t - (trials.length - 1) / 2) * 30, 8, 'ribbon')
          .setDisplaySize(26, 26)
          .setTint(won ? COLORS.pink : 0xd8d2cc)
          .setAlpha(won ? 1 : 0.7),
      );
    });

    if (!unlocked) {
      // Dim the card and show a padlock.
      parts.push(
        this.add
          .graphics()
          .fillStyle(0x2b2233, 0.45)
          .fillRoundedRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, 22),
      );
      const lock = this.add
        .graphics()
        .lineStyle(10, 0xd8d2cc)
        .beginPath()
        .arc(0, -14, 22, Math.PI, 0)
        .strokePath()
        .fillStyle(0xffd23f)
        .fillRoundedRect(-34, -14, 68, 54, 10)
        .lineStyle(4, COLORS.ink)
        .strokeRoundedRect(-34, -14, 68, 54, 10)
        .fillStyle(COLORS.ink)
        .fillCircle(0, 8, 7);
      lock.y = -8;
      parts.push(lock);
    }

    const hit = this.add.zone(0, 0, CARD.width, CARD.height).setInteractive({ useHandCursor: unlocked });
    parts.push(hit);
    const container = this.add.container(x, y, parts);
    container.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 260, delay: index * 90, ease: 'Back.Out' });

    hit.on('pointerdown', () => {
      if (!unlocked) {
        playSound(this, 'noPeas');
        this.tweens.add({ targets: container, x: x + 8, duration: 50, yoyo: true, repeat: 3 });
        return;
      }
      playSound(this, 'tap');
      this.tweens.add({ targets: container, scale: 0.95, duration: 80, yoyo: true });
      this.openSheet(index, level);
    });
  }

  /**
   * The level sheet: a big map, stars and best score, a Play button, and the level's trials
   * (each with a ribbon and its own Play button, once the level's been beaten).
   */
  private openSheet(index: number, level: Level): void {
    if (this.sheet) return;
    const info = LEVELS[index]!;
    const record: LevelRecord | undefined = this.progress.levels[this.difficulty][index];
    const trials = TRIALS[index] ?? [];
    const open = trialsUnlocked(this.progress, this.difficulty, index);
    const W = SHEET.width;
    const H = SHEET.baseHeight + trials.length * SHEET.trialRow;
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const grey = { ...ink, color: '#8a7f85' };
    const play = (data: GameSceneData) => fadeToScene(this, 'GameScene', data);

    // A dark sheet over the level cards; tapping it closes the sheet.
    const backdrop = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x2b2233, 0.55).setInteractive();
    backdrop.on('pointerdown', () => this.closeSheet());

    const top = -H / 2;
    const parts: Phaser.GameObjects.GameObject[] = [drawCard(this.add.graphics(), W, H, { radius: 28, borderWidth: 5 })];

    // Left: the map, stars, and best score.
    const mapX = -W / 2 + 40 + SHEET.map.width / 2;
    parts.push(this.drawMiniMap(level, mapX, top + 40 + SHEET.map.height / 2, SHEET.map));
    const stars = record?.stars ?? 0;
    for (let s = 0; s < 3; s++) {
      parts.push(
        this.add
          .image(mapX + (s - 1) * 52, top + 262, 'star')
          .setDisplaySize(46, 46)
          .setTint(s < stars ? 0xffd23f : 0xd8d2cc),
      );
    }
    parts.push(
      this.add
        .text(mapX, top + 300, record ? `Best score  ${record.bestScore}` : 'Not beaten yet', textStyle(20, record ? { ...ink, weight: '700' } : grey))
        .setOrigin(0.5),
    );

    // Right: the level's name and a big Play button.
    const rightX = mapX + SHEET.map.width / 2 + 40;
    parts.push(this.add.text(rightX, top + 52, `Level ${index + 1}`, textStyle(22, grey)).setOrigin(0, 0.5));
    parts.push(this.add.text(rightX, top + 96, info.name, textStyle(40, { ...ink, weight: '700' })).setOrigin(0, 0.5));
    const chipColor = DIFFICULTY_COLORS[this.difficulty].css;
    parts.push(this.add.text(rightX, top + 136, DIFFICULTIES[this.difficulty].label, textStyle(20, { ...ink, color: chipColor, weight: '700' })).setOrigin(0, 0.5));
    parts.push(
      drawBigButton(this, rightX + 140, top + 214, 'Play  ▶', COLORS.green, COLORS.greenDark, () => play({ difficulty: this.difficulty, level: index }), {
        width: 280,
        height: 90,
      }),
    );
    // The Sandbox: the same level with endless peas and hearts, for trying things out.
    parts.push(
      drawBigButton(this, rightX + 140, top + 296, 'Sandbox', COLORS.blue, COLORS.blueDark, () => play({ difficulty: this.difficulty, level: index, sandbox: true }), {
        width: 220,
        height: 44,
        fontSize: 20,
      }),
    );

    // Below: the trials.
    const listTop = top + 336;
    const won = trialsWon(this.progress, this.difficulty, index);
    parts.push(this.add.text(-W / 2 + 40, listTop, 'Trials', textStyle(26, { ...ink, weight: '700' })).setOrigin(0, 0.5));
    parts.push(this.add.image(-W / 2 + 140, listTop, 'ribbon').setDisplaySize(30, 30).setTint(COLORS.pink));
    parts.push(this.add.text(-W / 2 + 160, listTop, `${won}/${trials.length}`, textStyle(22, { ...ink, weight: '700' })).setOrigin(0, 0.5));
    if (!open) {
      parts.push(this.add.text(-W / 2 + 230, listTop, 'Beat the level to open its trials!', textStyle(20, grey)).setOrigin(0, 0.5));
    }
    parts.push(this.add.graphics().lineStyle(3, 0xe6ddd0).lineBetween(-W / 2 + 40, listTop + 22, W / 2 - 40, listTop + 22));
    trials.forEach((trial, t) => {
      const y = listTop + 46 + t * SHEET.trialRow + SHEET.trialRow / 2 - 8;
      const done = hasWonTrial(this.progress, this.difficulty, trial.id);
      const textColor = open ? ink : grey;
      parts.push(
        this.add
          .image(-W / 2 + 70, y, 'ribbon')
          .setDisplaySize(44, 44)
          .setTint(done ? COLORS.pink : 0xd8d2cc)
          .setAlpha(open ? 1 : 0.6),
      );
      parts.push(this.add.text(-W / 2 + 106, y - 15, trial.name, textStyle(22, { ...textColor, weight: '700' })).setOrigin(0, 0.5));
      parts.push(
        this.add
          .text(-W / 2 + 106, y + 12, trial.description, { ...textStyle(16, textColor), wordWrap: { width: W - 106 - 40 - 150 } })
          .setOrigin(0, 0.5),
      );
      if (open) {
        const label = done ? 'Again' : 'Play';
        parts.push(
          drawBigButton(this, W / 2 - 110, y, label, done ? COLORS.blue : COLORS.green, done ? COLORS.blueDark : COLORS.greenDark, () => play({ difficulty: this.difficulty, trial: trial.id }), {
            width: 130,
            height: 54,
            fontSize: 24,
          }),
        );
      }
    });

    // Close button in the corner.
    const cross = this.add.graphics().lineStyle(6, 0xffffff).lineBetween(-10, -10, 10, 10).lineBetween(-10, 10, 10, -10);
    const close = drawRoundButton(this, W / 2 - 14, top + 14, 26, COLORS.pink, 0xc2507a, [cross]);
    close.hit.on('pointerdown', () => {
      playSound(this, 'tap');
      this.closeSheet();
    });
    parts.push(close.container);

    // Taps on the sheet itself shouldn't fall through to the backdrop.
    const catcher = this.add.zone(0, 0, W, H).setInteractive();
    this.sheet = this.add.container(WORLD.width / 2, WORLD.height / 2 + 10, [catcher, ...parts]).setDepth(DEPTH.sheet);
    backdrop.setDepth(DEPTH.sheet - 1);
    this.sheet.setData('backdrop', backdrop);
    this.sheet.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: this.sheet, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.input.keyboard?.once('keydown-ESC', () => this.closeSheet());
  }

  private closeSheet(): void {
    const sheet = this.sheet;
    if (!sheet) return;
    this.sheet = undefined;
    (sheet.getData('backdrop') as Phaser.GameObjects.Rectangle).destroy();
    this.tweens.add({ targets: sheet, scale: 0.9, alpha: 0, duration: 150, onComplete: () => sheet.destroy() });
  }

  /** Today's Daily Challenge: the same level and twist for everyone, with its own leaderboard. */
  private drawDailyButton(x: number, y: number, progress: Progress): void {
    const date = dailyDate();
    const daily = dailyFor(date);
    if (!daily) return;
    const record = dailyRecord(progress, date, this.difficulty);
    const data: GameSceneData = { difficulty: this.difficulty, daily: date };
    const streak = dailyStreak(progress, date);
    this.drawModeButton(x, y, {
      // Days in a row the Daily Challenge has been won (it shows from the second day).
      badge: streak >= 2 ? `${streak} days in a row!` : undefined,
      icon: this.add.image(0, 0, 'star').setDisplaySize(46, 46).setTint(COLORS.gold),
      title: 'Daily Challenge',
      subtitle: `${daily.challenge.name}  ·  ${LEVELS[daily.level]?.name ?? ''}`,
      fill: 0xfff0b3,
      border: COLORS.gold,
      // Already won today: show the stars (you can still play again for a better score).
      stars: record?.stars,
      data,
    });
  }

  /** The Endless Pond: waves until you run out of hearts, on any map you've opened. Shows your best. */
  private drawEndlessButton(x: number, y: number, progress: Progress): void {
    const best = Math.max(...LEVELS.map((_, map) => endlessBest(progress, this.difficulty, map)));
    const bestMap = LEVELS.findIndex((_, map) => endlessBest(progress, this.difficulty, map) === best);
    this.drawModeButton(x, y, {
      icon: this.add.text(0, -2, '∞', textStyle(46, { weight: '700', color: '#3d8fe0', stroke: COLORS.inkCss, strokeThickness: 6 })).setOrigin(0.5),
      title: ENDLESS.name,
      subtitle: best > 0 ? `Your best: ${best} ${best === 1 ? 'wave' : 'waves'} on ${LEVELS[bestMap]!.name}` : 'How long can you last? Pick a pond!',
      fill: 0xdff1ff,
      border: COLORS.blue,
      onTap: () => this.openEndlessSheet(),
    });
  }

  /** The Endless sheet: every map you've opened, your best waves on each, and a Play button. */
  private openEndlessSheet(): void {
    if (this.sheet) return;
    const ROW = 72;
    const W = 760;
    const H = 110 + LEVELS.length * ROW;
    const top = -H / 2;
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const grey = { ...ink, color: '#8a7f85' };

    const backdrop = this.add.rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x2b2233, 0.55).setInteractive();
    backdrop.on('pointerdown', () => this.closeSheet());
    const parts: Phaser.GameObjects.GameObject[] = [drawCard(this.add.graphics(), W, H, { radius: 28, borderWidth: 5, border: COLORS.blue })];
    parts.push(this.add.text(-W / 2 + 40, top + 44, '∞', textStyle(44, { weight: '700', color: '#3d8fe0', stroke: COLORS.inkCss, strokeThickness: 6 })).setOrigin(0, 0.5));
    parts.push(this.add.text(-W / 2 + 90, top + 44, ENDLESS.name, textStyle(34, { ...ink, weight: '700' })).setOrigin(0, 0.5));
    parts.push(this.add.text(-W / 2 + 40, top + 84, 'Waves keep coming until the hearts run out. Pick a pond:', textStyle(18, grey)).setOrigin(0, 0.5));

    LEVELS.forEach((info, map) => {
      const y = top + 110 + map * ROW + ROW / 2;
      const open = isUnlocked(this.progress, this.difficulty, map);
      const best = endlessBest(this.progress, this.difficulty, map);
      const textColor = open ? ink : grey;
      const mini = this.drawMiniMap(parseLevel(info.map), -W / 2 + 84, y, { width: 88, height: 50 });
      if (!open) mini.setAlpha(0.5);
      parts.push(mini);
      parts.push(this.add.text(-W / 2 + 144, y - 13, info.name, textStyle(22, { ...textColor, weight: '700' })).setOrigin(0, 0.5));
      parts.push(
        this.add
          .text(-W / 2 + 144, y + 13, !open ? `Beat level ${map} to open it` : best > 0 ? `Your best: ${best} ${best === 1 ? 'wave' : 'waves'}` : 'Not played yet', textStyle(16, grey))
          .setOrigin(0, 0.5),
      );
      if (open) {
        const data: GameSceneData = { difficulty: this.difficulty, endless: true, level: map };
        parts.push(drawBigButton(this, W / 2 - 100, y, 'Play', COLORS.blue, COLORS.blueDark, () => fadeToScene(this, 'GameScene', data), { width: 130, height: 54, fontSize: 24 }));
      }
    });

    const cross = this.add.graphics().lineStyle(6, 0xffffff).lineBetween(-10, -10, 10, 10).lineBetween(-10, 10, 10, -10);
    const close = drawRoundButton(this, W / 2 - 14, top + 14, 26, COLORS.pink, 0xc2507a, [cross]);
    close.hit.on('pointerdown', () => {
      playSound(this, 'tap');
      this.closeSheet();
    });
    parts.push(close.container);
    const catcher = this.add.zone(0, 0, W, H).setInteractive();
    this.sheet = this.add.container(WORLD.width / 2, WORLD.height / 2, [catcher, ...parts]).setDepth(DEPTH.sheet);
    backdrop.setDepth(DEPTH.sheet - 1);
    this.sheet.setData('backdrop', backdrop);
    this.sheet.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: this.sheet, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.input.keyboard?.once('keydown-ESC', () => this.closeSheet());
  }

  /** A wide button for a way to play (Daily Challenge, Endless Pond): icon, title, subtitle, and a play button or stars. */
  private drawModeButton(
    x: number,
    y: number,
    options: {
      icon: Phaser.GameObjects.GameObject & { x: number };
      title: string;
      subtitle: string;
      fill: number;
      border: number;
      stars?: number;
      /** A little pink tag on the top corner (the Daily Challenge streak). */
      badge?: string;
      /** Start the game with this, or run `onTap` instead (the Endless Pond opens a sheet). */
      data?: GameSceneData;
      onTap?: () => void;
    },
  ): void {
    const W = MODE_BUTTON.width;
    const H = MODE_BUTTON.height;
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    options.icon.x = -W / 2 + 40;
    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(this.add.graphics(), W, H, { radius: 22, fill: options.fill, border: options.border, borderWidth: 5 }),
      options.icon,
      this.add.text(-W / 2 + 72, -16, options.title, textStyle(24, { ...ink, weight: '700' })).setOrigin(0, 0.5),
      this.add.text(-W / 2 + 72, 15, options.subtitle, textStyle(16, { ...ink, color: '#6a5a4a' })).setOrigin(0, 0.5),
    ];
    if (options.stars !== undefined) {
      for (let s = 0; s < 3; s++) {
        parts.push(this.add.image(W / 2 - 92 + s * 28, 0, 'star').setDisplaySize(28, 28).setTint(s < options.stars ? 0xffd23f : 0xd8d2cc));
      }
    } else {
      const play = this.add.graphics().fillStyle(COLORS.green).fillCircle(0, 0, 24).lineStyle(4, COLORS.ink).strokeCircle(0, 0, 24);
      play.fillStyle(0xffffff).fillTriangle(-7, -11, -7, 11, 12, 0).lineStyle(3, COLORS.ink).strokeTriangle(-7, -11, -7, 11, 12, 0);
      play.x = W / 2 - 44;
      parts.push(play);
      this.tweens.add({ targets: play, scale: 1.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (options.badge) {
      const label = this.add.text(0, 0, options.badge, textStyle(15, { weight: '700', strokeThickness: 3 })).setOrigin(0.5);
      const w = label.width + 22;
      const tag = this.add.graphics().fillStyle(COLORS.pink).fillRoundedRect(-w / 2, -13, w, 26, 13).lineStyle(3, COLORS.ink).strokeRoundedRect(-w / 2, -13, w, 26, 13);
      const badge = this.add.container(W / 2 - w / 2 - 14, -H / 2 - 2, [tag, label]).setAngle(3);
      this.tweens.add({ targets: badge, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      parts.push(badge);
    }
    const hit = this.add.zone(0, 0, W, H).setInteractive({ useHandCursor: true });
    parts.push(hit);
    const container = this.add.container(x, y, parts);
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 260, delay: LEVELS.length * 90 });
    hit.on('pointerdown', () => {
      playSound(this, 'tap');
      this.tweens.add({ targets: container, scale: 0.96, duration: 80, yoyo: true });
      if (options.onTap) options.onTap();
      else fadeToScene(this, 'GameScene', options.data);
    });
  }

  /** A small drawing of the level: grass, pond, path, nests, and the duck house. */
  private drawMiniMap(level: Level, x: number, y: number, size: { width: number; height: number }): Phaser.GameObjects.Container {
    const scale = size.width / WORLD.width;
    const k = scale / (MAP.width / WORLD.width); // lines and dots grow with the map
    const clamp = (p: { x: number; y: number }) => ({
      x: Math.max(0, Math.min(WORLD.width, p.x)) * scale - size.width / 2,
      y: Math.max(0, Math.min(WORLD.height, p.y)) * scale - size.height / 2,
    });
    const g = this.add.graphics();
    g.fillStyle(0x6db24c).fillRoundedRect(-size.width / 2, -size.height / 2, size.width, size.height, 8 * k);
    for (const pond of level.ponds) {
      const c = clamp(pond.center);
      g.fillStyle(0x4aa3df).fillEllipse(c.x, c.y, pond.radiusX * 2 * scale, pond.radiusY * 2 * scale);
    }
    for (const trail of level.paths) {
      const path = trail.map(clamp);
      g.lineStyle(5 * k, 0xc99d64).strokePoints(path);
      g.fillStyle(0xc99d64);
      path.forEach((p) => g.fillCircle(p.x, p.y, 2.5 * k));
    }
    const path = level.path.map(clamp);
    g.fillStyle(0xf3d480);
    level.slots.map(clamp).forEach((p) => g.fillCircle(p.x, p.y, 2.5 * k));
    const door = path[path.length - 1]!;
    g.fillStyle(0xe0654c).fillTriangle(door.x - 6 * k, door.y - 4 * k, door.x + 6 * k, door.y - 4 * k, door.x, door.y - 11 * k);
    g.fillStyle(0xf3dfb6).fillRect(door.x - 4.5 * k, door.y - 4 * k, 9 * k, 7 * k);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-size.width / 2, -size.height / 2, size.width, size.height, 8 * k);
    return this.add.container(x, y, [g]);
  }
}
