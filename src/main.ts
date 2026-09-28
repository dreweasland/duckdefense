import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#3f7d4e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [TitleScene, GameScene, ResultScene],
});

// Dev only: expose the game so playtests can fast-forward it from the browser
// console, e.g. `for (let i = 0; i < 600; i++) game.step(0, 1000 / 60)`.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
