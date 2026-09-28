import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    const { width, height } = this.scale;

    // Placeholder pond until real art arrives.
    this.add.ellipse(width / 2, height / 2 + 120, 700, 220, 0x4aa3df);

    this.add
      .text(width / 2, height / 2 - 60, 'Duck Defense', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '96px',
        color: '#ffe066',
        stroke: '#3b2a00',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 40, 'Protect the Nestera duck house!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const tapToPlay = this.add
      .text(width / 2, height - 90, 'Tap to play', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: tapToPlay, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}
