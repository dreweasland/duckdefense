import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { drawGrass, drawOutskirts } from '../art/terrain';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { LEVELS } from '../data/levels';
import { parseLevel, type Level } from '../logic/level';
import { ENDLESS } from '../data/endless';
import { dailyDate, dailyFor } from '../logic/daily';
import { dailyRecord, dailyStreak, isUnlocked, type Progress } from '../logic/progress';
import { loadProgress } from '../save';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBackButton, drawCard, drawSoundButton, fadeToScene } from '../ui/widgets';
import type { GameSceneData } from './GameScene';

export interface LevelSelectSceneData {
  difficulty: Difficulty;
}

// Two rows of three wide cards: a little map on the left, the level's number and stars on the right.
const CARD = { width: 340, height: 196, spacing: 380, rows: [268, 482] };
const MAP = { width: 160, height: 90 }; // 16:9, like the real map
const MODE_BUTTON = { width: 430, height: 84, gap: 24 }; // Daily Challenge and Endless Pond, side by side

export class LevelSelectScene extends Phaser.Scene {
  private difficulty: Difficulty = 'easy';

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
    const cx = WORLD.width / 2;

    this.add.text(cx, 70, 'Pick a level', textStyle(64, { weight: '700', strokeThickness: 10 })).setOrigin(0.5);
    const chipColor = this.difficulty === 'easy' ? '#3fbf5f' : '#f28c28';
    this.add
      .text(cx, 128, DIFFICULTIES[this.difficulty].label, textStyle(28, { color: chipColor, stroke: '#ffffff', strokeThickness: 6 }))
      .setOrigin(0.5);

    // Rows of three cards (CARD.rows has room for two rows: six levels).
    LEVELS.forEach((info, i) => {
      const row = Math.floor(i / 3);
      const inRow = Math.min(3, LEVELS.length - row * 3);
      const col = i % 3;
      const x = cx + (col - (inRow - 1) / 2) * CARD.spacing;
      const y = CARD.rows[row] ?? CARD.rows[CARD.rows.length - 1]!;
      this.drawLevelCard(x, y, i, info.name, parseLevel(info.map), progress.levels[this.difficulty][i]?.stars ?? 0, isUnlocked(progress, this.difficulty, i));
    });

    this.drawDailyButton(cx - (MODE_BUTTON.width + MODE_BUTTON.gap) / 2, 648, progress);
    this.drawEndlessButton(cx + (MODE_BUTTON.width + MODE_BUTTON.gap) / 2, 648, progress);

    // Back to the title screen.
    drawBackButton(this, () => fadeToScene(this, 'TitleScene'));

    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 100);
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private drawLevelCard(x: number, y: number, index: number, name: string, level: Level, stars: number, unlocked: boolean): void {
    const card = drawCard(this.add.graphics(), CARD.width, CARD.height, { radius: 24, borderWidth: 4 });
    const parts: Phaser.GameObjects.GameObject[] = [card, this.drawMiniMap(level, -76, -30)];
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    parts.push(this.add.text(86, -58, `Level ${index + 1}`, textStyle(20, { ...ink, color: '#8a7f85' })).setOrigin(0.5));
    parts.push(this.add.text(0, 56, name, textStyle(30, { ...ink, weight: '700' })).setOrigin(0.5));
    for (let s = 0; s < 3; s++) {
      parts.push(
        this.add
          .image(86 + (s - 1) * 40, -18, 'star')
          .setDisplaySize(36, 36)
          .setTint(s < stars ? 0xffd23f : 0xd8d2cc),
      );
    }

    if (!unlocked) {
      // Dim the card and show a padlock.
      parts.push(
        this.add
          .graphics()
          .fillStyle(0x2b2233, 0.45)
          .fillRoundedRect(-CARD.width / 2, -CARD.height / 2, CARD.width, CARD.height, 24),
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
      const data: GameSceneData = { difficulty: this.difficulty, level: index };
      fadeToScene(this, 'GameScene', data);
    });
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

  /** The Endless Pond: waves until you run out of hearts. Shows your best. */
  private drawEndlessButton(x: number, y: number, progress: Progress): void {
    const best = progress.endless?.[this.difficulty];
    const data: GameSceneData = { difficulty: this.difficulty, endless: true };
    this.drawModeButton(x, y, {
      icon: this.add.text(0, -2, '∞', textStyle(46, { weight: '700', color: '#3d8fe0', stroke: COLORS.inkCss, strokeThickness: 6 })).setOrigin(0.5),
      title: ENDLESS.name,
      subtitle: best ? `Your best: ${best} ${best === 1 ? 'wave' : 'waves'}` : 'How long can you last?',
      fill: 0xdff1ff,
      border: COLORS.blue,
      data,
    });
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
      data: GameSceneData;
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
      fadeToScene(this, 'GameScene', options.data);
    });
  }

  /** A small drawing of the level: grass, pond, path, nests, and the duck house. */
  private drawMiniMap(level: Level, x: number, y: number): Phaser.GameObjects.Container {
    const scale = MAP.width / WORLD.width;
    const clamp = (p: { x: number; y: number }) => ({
      x: Math.max(0, Math.min(WORLD.width, p.x)) * scale - MAP.width / 2,
      y: Math.max(0, Math.min(WORLD.height, p.y)) * scale - MAP.height / 2,
    });
    const g = this.add.graphics();
    g.fillStyle(0x6db24c).fillRoundedRect(-MAP.width / 2, -MAP.height / 2, MAP.width, MAP.height, 8);
    for (const pond of level.ponds) {
      const c = clamp(pond.center);
      g.fillStyle(0x4aa3df).fillEllipse(c.x, c.y, pond.radiusX * 2 * scale, pond.radiusY * 2 * scale);
    }
    const path = level.path.map(clamp);
    g.lineStyle(5, 0xc99d64).strokePoints(path);
    g.fillStyle(0xc99d64);
    path.forEach((p) => g.fillCircle(p.x, p.y, 2.5));
    g.fillStyle(0xf3d480);
    level.slots.map(clamp).forEach((p) => g.fillCircle(p.x, p.y, 2.5));
    const door = path[path.length - 1]!;
    g.fillStyle(0xe0654c).fillTriangle(door.x - 6, door.y - 4, door.x + 6, door.y - 4, door.x, door.y - 11);
    g.fillStyle(0xf3dfb6).fillRect(door.x - 4.5, door.y - 4, 9, 7);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-MAP.width / 2, -MAP.height / 2, MAP.width, MAP.height, 8);
    return this.add.container(x, y, [g]);
  }
}
