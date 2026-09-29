import Phaser from 'phaser';
import { drawGrass, drawOutskirts, drawPond, scatterDecor } from '../art/terrain';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER } from '../data/ducks';
import { LEVELS } from '../data/levels';
import { playSound } from '../audio/sfx';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBigButton, drawCard } from '../ui/widgets';
import type { GameSceneData } from './GameScene';

export interface ResultSceneData {
  won: boolean;
  difficulty: Difficulty;
  level: number;
}

const POND = { center: { x: WORLD.width / 2, y: 560 }, radiusX: 420, radiusY: 120 };

export class ResultScene extends Phaser.Scene {
  private result: ResultSceneData = { won: true, difficulty: 'easy', level: 0 };

  constructor() {
    super('ResultScene');
  }

  init(data: Partial<ResultSceneData>): void {
    this.result = { won: data.won ?? true, difficulty: data.difficulty ?? 'easy', level: data.level ?? 0 };
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
    scatterDecor(this, { ponds: [POND], blocked: [{ x: 200, y: 40, width: 880, height: 420 }] }, 43);

    // Panel.
    const panel = drawCard(this.add.graphics(), 820, 360, { radius: 28, borderWidth: 5 });
    this.add.container(cx, 250, [panel]).setDepth(50);

    // Losing should never feel harsh: silly message, same big "again" button.
    this.add
      .text(cx, 130, won ? 'You saved the duck house!' : 'The raccoons had a snack party!', {
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
        205,
        beatEverything ? 'You beat every level! The flock is so proud.' : won ? 'The flock is safe and proud.' : 'The ducks want a rematch!',
        textStyle(30, { color: COLORS.inkCss, strokeThickness: 0 }),
      )
      .setOrigin(0.5)
      .setDepth(51);

    // Happy ducks hop when you win; on a loss they shake their heads.
    DUCK_ORDER.forEach((kind, i) => {
      const duck = this.add.image(cx - 240 + i * 160, 320, `duck-${kind}`).setDisplaySize(110, 110).setDepth(51);
      this.tweens.add(
        won
          ? { targets: duck, y: 280, duration: 320, yoyo: true, repeat: -1, delay: i * 120, ease: 'Quad.Out' }
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
    if (hasNext) {
      // Next level is the big, obvious choice.
      const next: GameSceneData = { difficulty, level: level + 1 };
      const small = { width: 230, height: 84 };
      drawBigButton(this, cx - 290, 515, '↻  Again', COLORS.blue, COLORS.blueDark, () => go('GameScene', again), small).setDepth(70);
      drawBigButton(this, cx, 510, 'Next  ▶', COLORS.green, COLORS.greenDark, () => go('GameScene', next)).setDepth(70);
      drawBigButton(this, cx + 290, 515, '⌂  Home', COLORS.blue, COLORS.blueDark, () => go('TitleScene'), small).setDepth(70);
    } else {
      drawBigButton(this, cx - 170, 510, '↻  Again', COLORS.green, COLORS.greenDark, () => go('GameScene', again)).setDepth(70);
      drawBigButton(this, cx + 170, 510, '⌂  Home', COLORS.blue, COLORS.blueDark, () => go('TitleScene')).setDepth(70);
    }

    this.cameras.main.fadeIn(300, 0, 0, 0);
    playSound(this, won ? 'win' : 'lose');
  }
}
