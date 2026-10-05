import Phaser from 'phaser';
import type { Difficulty } from '../data/difficulty';
import { BACKDROP, COLORS, WORLD, setupCamera, textStyle, INK } from '../ui/theme';
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
  private card?: Phaser.GameObjects.Container;

  constructor() {
    super('PauseScene');
  }

  init(data: PauseSceneData): void {
    this.options = data;
    this.card = undefined;
  }

  create(): void {
    setupCamera(this);
    this.scene.bringToTop();
    // Dims the game and soaks up taps.
    this.add
      .rectangle(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height, 0x000000, 0.5)
      .setInteractive();

    this.showMenu();
    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 1);

    this.input.keyboard?.once('keydown-ESC', () => this.resume());
  }

  /** Swaps what the card shows (the menu, or an "are you sure?"), popping it in. */
  private showCard(parts: Phaser.GameObjects.GameObject[]): void {
    this.card?.destroy();
    this.card = this.add.container(WORLD.width / 2, WORLD.height / 2, [drawCard(this.add.graphics(), 480, 380, { radius: 28, borderWidth: 5 }), ...parts]);
    this.card.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: this.card, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
  }

  private showMenu(): void {
    const small = { width: 200, height: 76, fontSize: 30 };
    this.showCard([
      this.add.text(0, -138, 'Paused', textStyle(52, { weight: '700', color: COLORS.goldCss, strokeThickness: 10 })).setOrigin(0.5),
      // Keep playing is the big, obvious choice.
      drawBigButton(this, 0, -30, '▶  Play', COLORS.green, COLORS.greenDark, () => this.resume(), { width: 320 }),
      drawBigButton(this, -112, 100, '↻  Again', COLORS.blue, COLORS.blueDark, () => this.confirm('Start again?', 'GameScene', this.options.again), small),
      drawBigButton(this, 112, 100, 'Levels', COLORS.blue, COLORS.blueDark, () => this.confirm('Leave this game?', 'LevelSelectScene', this.levels()), small),
    ]);
  }

  /** "Are you sure?" before giving up the game being played, so a stray tap can't lose it. */
  private confirm(question: string, scene: string, data: object): void {
    this.showCard([
      this.add.text(0, -130, question, textStyle(44, { weight: '700', color: COLORS.goldCss, strokeThickness: 9 })).setOrigin(0.5),
      this.add.text(0, -74, "You'll lose your ducks and peas.", textStyle(24, INK)).setOrigin(0.5),
      // "No" is the big green one: going back to the game is the safe choice.
      drawBigButton(this, 0, 10, 'No, keep playing', COLORS.green, COLORS.greenDark, () => this.showMenu(), { width: 400, fontSize: 36 }),
      drawBigButton(this, 0, 122, 'Yes', COLORS.orange, COLORS.orangeDark, () => this.leave(scene, data), { width: 200, height: 76, fontSize: 30 }),
    ]);
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
