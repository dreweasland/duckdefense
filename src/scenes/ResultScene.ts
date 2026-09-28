import Phaser from 'phaser';
import { drawBigButton, drawDuck } from '../art/placeholders';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER } from '../data/ducks';
import type { GameSceneData } from './GameScene';

export interface ResultSceneData {
  won: boolean;
  difficulty: Difficulty;
}

export class ResultScene extends Phaser.Scene {
  private result: ResultSceneData = { won: true, difficulty: 'easy' };

  constructor() {
    super('ResultScene');
  }

  init(data: Partial<ResultSceneData>): void {
    this.result = { won: data.won ?? true, difficulty: data.difficulty ?? 'easy' };
  }

  create(): void {
    const { width } = this.scale;
    const { won, difficulty } = this.result;

    // Losing should never feel harsh: silly message, same big "again" button.
    this.add
      .text(width / 2, 170, won ? 'You saved the duck house!' : 'The raccoons had a snack party!', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '64px',
        color: '#ffe066',
        stroke: '#3b2a00',
        strokeThickness: 10,
        align: 'center',
        wordWrap: { width: width - 120 },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 280, won ? 'The flock is safe and proud.' : 'The ducks want a rematch!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '34px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Happy ducks hop when you win; on a loss they shake their heads.
    DUCK_ORDER.forEach((kind, i) => {
      const duck = drawDuck(this, kind, width / 2 - 225 + i * 150, 420);
      this.tweens.add(
        won
          ? { targets: duck, y: 380, duration: 300, yoyo: true, repeat: -1, delay: i * 120, ease: 'Quad.Out' }
          : { targets: duck, angle: { from: -8, to: 8 }, duration: 250, yoyo: true, repeat: -1, delay: i * 80 },
      );
    });

    const again: GameSceneData = { difficulty };
    drawBigButton(this, width / 2 - 170, 600, '↻ Again', 0x2ecc71, () => this.scene.start('GameScene', again));
    drawBigButton(this, width / 2 + 170, 600, '⌂ Home', 0x3498db, () => this.scene.start('TitleScene'));
  }
}
