import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { drawGrass, drawOutskirts } from '../art/terrain';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { LEVELS } from '../data/levels';
import { parseLevel, type Level } from '../logic/level';
import { dailyDate, dailyFor } from '../logic/daily';
import { dailyRecord, isUnlocked, type Progress } from '../logic/progress';
import { loadProgress } from '../save';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawCard, drawRoundButton, drawSoundButton } from '../ui/widgets';
import type { GameSceneData } from './GameScene';

export interface LevelSelectSceneData {
  difficulty: Difficulty;
}

const CARD = { width: 340, height: 340, spacing: 380 };
const MAP = { width: 300, height: 169 }; // 16:9, like the real map

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

    // Rows of three cards.
    LEVELS.forEach((info, i) => {
      const row = Math.floor(i / 3);
      const inRow = Math.min(3, LEVELS.length - row * 3);
      const col = i % 3;
      const x = cx + (col - (inRow - 1) / 2) * CARD.spacing;
      const y = 380 + row * (CARD.height + 30);
      this.drawLevelCard(x, y, i, info.name, parseLevel(info.map), progress.levels[this.difficulty][i]?.stars ?? 0, isUnlocked(progress, this.difficulty, i));
    });

    this.drawDailyButton(cx, 648, progress);

    // Back to the title screen.
    const arrow = this.add
      .graphics()
      .fillStyle(0xffffff)
      .fillTriangle(8, -16, 8, 16, -16, 0)
      .lineStyle(4, COLORS.ink)
      .strokeTriangle(8, -16, 8, 16, -16, 0);
    const back = drawRoundButton(this, 70, 70, 40, COLORS.blue, COLORS.blueDark, [arrow]);
    back.hit.on('pointerdown', () => {
      playSound(this, 'tap');
      this.go('TitleScene');
    });

    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 100);
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private go(scene: string, data?: object): void {
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
  }

  private drawLevelCard(x: number, y: number, index: number, name: string, level: Level, stars: number, unlocked: boolean): void {
    const card = drawCard(this.add.graphics(), CARD.width, CARD.height, { radius: 24, borderWidth: 4 });
    const parts: Phaser.GameObjects.GameObject[] = [card, this.drawMiniMap(level, 0, -60)];
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    parts.push(this.add.text(0, 50, `Level ${index + 1}`, textStyle(20, { ...ink, color: '#8a7f85' })).setOrigin(0.5));
    parts.push(this.add.text(0, 82, name, textStyle(32, { ...ink, weight: '700' })).setOrigin(0.5));
    for (let s = 0; s < 3; s++) {
      parts.push(
        this.add
          .image((s - 1) * 46, 132, 'star')
          .setDisplaySize(40, 40)
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
      lock.y = -40;
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
      this.go('GameScene', data);
    });
  }

  /** Today's Daily Challenge: the same level and twist for everyone, with its own leaderboard. */
  private drawDailyButton(x: number, y: number, progress: Progress): void {
    const date = dailyDate();
    const daily = dailyFor(date);
    if (!daily) return;
    const W = 600;
    const H = 84;
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const record = dailyRecord(progress, date, this.difficulty);
    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(this.add.graphics(), W, H, { radius: 22, fill: 0xfff0b3, border: COLORS.gold, borderWidth: 5 }),
      this.add.image(-W / 2 + 46, 0, 'star').setDisplaySize(48, 48).setTint(COLORS.gold),
      this.add.text(-W / 2 + 82, -16, 'Daily Challenge', textStyle(26, { ...ink, weight: '700' })).setOrigin(0, 0.5),
      this.add
        .text(-W / 2 + 82, 16, `${daily.challenge.name}  ·  ${LEVELS[daily.level]?.name ?? ''}`, textStyle(20, { ...ink, color: '#8a5a20' }))
        .setOrigin(0, 0.5),
    ];
    if (record) {
      // Already won today: show the stars (you can still play again for a better score).
      for (let s = 0; s < 3; s++) {
        parts.push(this.add.image(W / 2 - 130 + s * 40, 0, 'star').setDisplaySize(36, 36).setTint(s < record.stars ? 0xffd23f : 0xd8d2cc));
      }
    } else {
      const play = this.add.graphics().fillStyle(COLORS.green).fillCircle(0, 0, 26).lineStyle(4, COLORS.ink).strokeCircle(0, 0, 26);
      play.fillStyle(0xffffff).fillTriangle(-8, -12, -8, 12, 13, 0).lineStyle(3, COLORS.ink).strokeTriangle(-8, -12, -8, 12, 13, 0);
      play.x = W / 2 - 52;
      parts.push(play);
      this.tweens.add({ targets: play, scale: 1.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    const hit = this.add.zone(0, 0, W, H).setInteractive({ useHandCursor: true });
    parts.push(hit);
    const container = this.add.container(x, y, parts);
    container.setAlpha(0);
    this.tweens.add({ targets: container, alpha: 1, duration: 260, delay: LEVELS.length * 90 });
    hit.on('pointerdown', () => {
      playSound(this, 'tap');
      this.tweens.add({ targets: container, scale: 0.96, duration: 80, yoyo: true });
      const data: GameSceneData = { difficulty: this.difficulty, daily: date };
      this.go('GameScene', data);
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
    g.fillStyle(0x6db24c).fillRoundedRect(-MAP.width / 2, -MAP.height / 2, MAP.width, MAP.height, 12);
    for (const pond of level.ponds) {
      const c = clamp(pond.center);
      g.fillStyle(0x4aa3df).fillEllipse(c.x, c.y, pond.radiusX * 2 * scale, pond.radiusY * 2 * scale);
    }
    const path = level.path.map(clamp);
    g.lineStyle(9, 0xc99d64).strokePoints(path);
    g.fillStyle(0xc99d64);
    path.forEach((p) => g.fillCircle(p.x, p.y, 4.5));
    g.fillStyle(0xf3d480);
    level.slots.map(clamp).forEach((p) => g.fillCircle(p.x, p.y, 4));
    const door = path[path.length - 1]!;
    g.fillStyle(0xe0654c).fillTriangle(door.x - 9, door.y - 6, door.x + 9, door.y - 6, door.x, door.y - 16);
    g.fillStyle(0xf3dfb6).fillRect(door.x - 7, door.y - 6, 14, 10);
    g.lineStyle(3, COLORS.ink).strokeRoundedRect(-MAP.width / 2, -MAP.height / 2, MAP.width, MAP.height, 12);
    return this.add.container(x, y, [g]);
  }
}
