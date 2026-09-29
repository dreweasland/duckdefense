import Phaser from 'phaser';
import { drawGrass, drawOutskirts, drawPond, scatterDecor } from '../art/terrain';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER } from '../data/ducks';
import { LEVELS } from '../data/levels';
import { postScore } from '../api';
import { playSound } from '../audio/sfx';
import { askForName } from '../ui/nameForm';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBigButton, drawCard } from '../ui/widgets';
import type { GameSceneData } from './GameScene';
import type { LeaderboardSceneData } from './LeaderboardScene';
import type { LevelSelectSceneData } from './LevelSelectScene';

export interface ResultSceneData {
  won: boolean;
  difficulty: Difficulty;
  level: number;
  stars?: number; // only for a win
  score?: number;
  newBest?: boolean;
  hearts?: number; // hearts and peas left, for posting to the leaderboard
  peas?: number;
}

const POND = { center: { x: WORLD.width / 2, y: 610 }, radiusX: 420, radiusY: 95 };

export class ResultScene extends Phaser.Scene {
  private result: ResultSceneData = { won: true, difficulty: 'easy', level: 0 };

  constructor() {
    super('ResultScene');
  }

  init(data: Partial<ResultSceneData>): void {
    this.result = { ...data, won: data.won ?? true, difficulty: data.difficulty ?? 'easy', level: data.level ?? 0 };
  }

  create(): void {
    setupCamera(this);
    const cx = WORLD.width / 2;
    const { won, difficulty, level } = this.result;
    const hasNext = won && level + 1 < LEVELS.length;
    const beatEverything = won && !hasNext;

    drawGrass(this, 41);
    drawOutskirts(this, 44);
    drawPond(this, POND, 42);
    scatterDecor(this, { ponds: [POND], blocked: [{ x: 200, y: 40, width: 880, height: 480 }] }, 43);

    // Panel.
    const panel = drawCard(this.add.graphics(), 820, 420, { radius: 28, borderWidth: 5 });
    this.add.container(cx, 260, [panel]).setDepth(50);

    // Losing should never feel harsh: silly message, same big "again" button.
    this.add
      .text(cx, 108, won ? 'You saved the duck house!' : 'The raccoons had a snack party!', {
        ...textStyle(52, { weight: '700', strokeThickness: 10 }),
        color: won ? '#ffd23f' : '#ffb3c1',
        align: 'center',
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5)
      .setDepth(51);
    this.add
      .text(
        cx,
        172,
        beatEverything ? 'You beat every level! The flock is so proud.' : won ? 'The flock is safe and proud.' : 'The ducks want a rematch!',
        textStyle(30, { color: COLORS.inkCss, strokeThickness: 0 }),
      )
      .setOrigin(0.5)
      .setDepth(51);

    // Stars and score for a win.
    const stars = this.result.stars ?? 0;
    if (won) {
      for (let s = 0; s < 3; s++) {
        const earned = s < stars;
        const star = this.add
          .image(cx + (s - 1) * 90, 250, 'star')
          .setDisplaySize(80, 80)
          .setTint(earned ? 0xffd23f : 0xd8d2cc)
          .setDepth(52);
        // Pop in one after another; stars you didn't earn are smaller and grey.
        const full = star.scaleX;
        star.setScale(0);
        this.tweens.add({ targets: star, scale: earned ? full : full * 0.8, delay: 300 + s * 250, duration: 300, ease: 'Back.Out' });
      }
      const score = this.add
        .text(cx, 318, `Score  ${this.result.score ?? 0}`, textStyle(30, { color: COLORS.inkCss, strokeThickness: 0, weight: '700' }))
        .setOrigin(0.5)
        .setDepth(51);
      this.drawPostButton(cx + 300, 318);
      if (this.result.newBest) {
        this.add
          .text(score.x + score.width / 2 + 12, 318, 'New best!', textStyle(22, { color: '#e0447a', stroke: '#ffffff', strokeThickness: 5 }))
          .setOrigin(0, 0.5)
          .setDepth(51)
          .setAngle(-6);
      }
    }

    // Happy ducks hop when you win; on a loss they shake their heads.
    DUCK_ORDER.forEach((kind, i) => {
      const y = won ? 400 : 320;
      const duck = this.add.image(cx - 240 + i * 160, y, `duck-${kind}`).setDisplaySize(won ? 90 : 110, won ? 90 : 110).setDepth(51);
      this.tweens.add(
        won
          ? { targets: duck, y: y - 30, duration: 320, yoyo: true, repeat: -1, delay: i * 120, ease: 'Quad.Out' }
          : { targets: duck, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: -1, delay: i * 80 },
      );
    });

    if (won) {
      // Confetti.
      this.add
        .particles(0, -20, 'feather', {
          x: { min: 0, max: WORLD.width },
          speedY: { min: 80, max: 180 },
          speedX: { min: -40, max: 40 },
          rotate: { min: 0, max: 360 },
          lifespan: 5000,
          frequency: 60,
          scale: { min: 0.4, max: 0.8 },
          tint: [0xffd23f, 0xff7aa2, 0x3fbf5f, 0x3d8fe0, 0xffffff],
        })
        .setDepth(60);
    }

    const go = (scene: string, data?: object) => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
    };
    const again: GameSceneData = { difficulty, level };
    const levels: LevelSelectSceneData = { difficulty };
    const y = 560;
    if (hasNext) {
      // Next level is the big, obvious choice.
      const next: GameSceneData = { difficulty, level: level + 1 };
      const small = { width: 230, height: 84 };
      drawBigButton(this, cx - 290, y + 5, '↻  Again', COLORS.blue, COLORS.blueDark, () => go('GameScene', again), small).setDepth(70);
      drawBigButton(this, cx, y, 'Next  ▶', COLORS.green, COLORS.greenDark, () => go('GameScene', next)).setDepth(70);
      drawBigButton(this, cx + 290, y + 5, 'Levels', COLORS.blue, COLORS.blueDark, () => go('LevelSelectScene', levels), small).setDepth(70);
    } else {
      drawBigButton(this, cx - 170, y, '↻  Again', COLORS.green, COLORS.greenDark, () => go('GameScene', again)).setDepth(70);
      drawBigButton(this, cx + 170, y, 'Levels', COLORS.blue, COLORS.blueDark, () => go('LevelSelectScene', levels)).setDepth(70);
    }

    this.cameras.main.fadeIn(300, 0, 0, 0);
    playSound(this, won ? 'win' : 'lose');
  }

  /** "Post" puts this win on the public leaderboard (asks for a name first). */
  private drawPostButton(x: number, y: number): void {
    const { level, difficulty, hearts, peas } = this.result;
    if (hearts === undefined || peas === undefined) return;
    const button = drawBigButton(
      this,
      x,
      y,
      'Post',
      COLORS.gold,
      0xc99a1a,
      async () => {
        let posted: { id: number } | undefined;
        const ok = await askForName(async (name) => {
          const result = await postScore({ name, level, difficulty, hearts, peas });
          if (!result.ok) return result.error;
          posted = result.data;
          return undefined;
        });
        if (!ok || !posted) {
          // Cancelled: put a fresh button back (big buttons only fire once).
          button.destroy();
          this.drawPostButton(x, y);
          return;
        }
        const data: LeaderboardSceneData = {
          level,
          difficulty,
          highlightId: posted.id,
          back: { scene: 'LevelSelectScene', data: { difficulty } },
        };
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('LeaderboardScene', data));
      },
      { width: 150, height: 56, fontSize: 24, icon: 'icon-trophy' },
    );
    button.setDepth(70);
  }
}
