import Phaser from 'phaser';
import { drawBigButton, drawDuck } from '../art/placeholders';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { DUCK_ORDER } from '../data/ducks';
import type { GameSceneData } from './GameScene';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    const { width } = this.scale;

    this.add
      .text(width / 2, 150, 'Duck Defense', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '96px',
        color: '#ffe066',
        stroke: '#3b2a00',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 240, 'Protect the Nestera duck house!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // The flock, bobbing on the pond.
    this.add.ellipse(width / 2, 410, 700, 170, 0x4aa3df);
    DUCK_ORDER.forEach((kind, i) => {
      const duck = drawDuck(this, kind, width / 2 - 225 + i * 150, 400);
      this.tweens.add({ targets: duck, y: 392, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });

    // Picking a difficulty starts the game. Easy is green and comes first.
    const start = (difficulty: Difficulty) => {
      const data: GameSceneData = { difficulty };
      this.scene.start('GameScene', data);
    };
    drawBigButton(this, width / 2 - 170, 610, DIFFICULTIES.easy.label, 0x2ecc71, () => start('easy'));
    drawBigButton(this, width / 2 + 170, 610, DIFFICULTIES.normal.label, 0xe67e22, () => start('normal'));
  }
}
