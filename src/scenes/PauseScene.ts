import Phaser from 'phaser';
import type { Difficulty } from '../data/difficulty';
import { BACKDROP, COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBigButton, drawCard, drawSoundButton } from '../ui/widgets';
import type { GameSceneData } from './GameScene';
import type { LevelSelectSceneData } from './LevelSelectScene';

export interface PauseSceneData {
  /** What "Again" starts: the same level, Daily Challenge, or Endless Pond. */
  again: GameSceneData;
  difficulty: Difficulty;
  /** Called before leaving the game (Again or Levels), so it can save anything worth keeping. */
  onLeave?: () => void;
}

/**
 * The pause menu, shown over the (frozen) game: keep playing, start again, or go back to
 * the levels. GameScene opens it from the pause button.
 */
export class PauseScene extends Phaser.Scene {
  private options!: PauseSceneData;

  constructor() {
    super('PauseScene');
  }

  init(data: PauseSceneData): void {
    this.options = data;
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    const cx = WORLD.width / 2;
    const cy = WORLD.height / 2;

    // Dims the game and soaks up taps.
    this.add
      .rectangle(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height, 0x000000, 0.5)
      .setInteractive();

    const card = this.add.container(cx, cy, [
      drawCard(this.add.graphics(), 480, 380, { radius: 28, borderWidth: 5 }),
      this.add.text(0, -138, 'Paused', textStyle(52, { weight: '700', color: COLORS.goldCss, strokeThickness: 10 })).setOrigin(0.5),
      // Keep playing is the big, obvious choice.
      drawBigButton(this, 0, -30, '▶  Play', COLORS.green, COLORS.greenDark, () => this.resume(), { width: 320 }),
      drawBigButton(this, -112, 100, '↻  Again', COLORS.blue, COLORS.blueDark, () => this.leave('GameScene', this.options.again), {
        width: 200,
        height: 76,
        fontSize: 30,
      }),
      drawBigButton(this, 112, 100, 'Levels', COLORS.blue, COLORS.blueDark, () => this.leave('LevelSelectScene', this.levels()), {
        width: 200,
        height: 76,
        fontSize: 30,
      }),
    ]);
    card.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 1);

    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  private levels(): LevelSelectSceneData {
    return { difficulty: this.options.difficulty };
  }

  private resume(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  /** Fades out, then swaps the frozen game for another scene (or a fresh game). */
  private leave(scene: string, data: object): void {
    this.options.onLeave?.();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('GameScene');
      this.scene.start(scene, data);
    });
  }
}
