import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { RENDER_SCALE, WORLD } from './ui/theme';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#24452f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Rendered at RENDER_SCALE x the world size for sharp art; each scene's camera zooms to match.
    width: WORLD.width * RENDER_SCALE,
    height: WORLD.height * RENDER_SCALE,
  },
  scene: [BootScene, TitleScene, GameScene, ResultScene],
});

// Dev only: expose the game so playtests can fast-forward it from the browser
// console, e.g. `for (let i = 0; i < 600; i++) game.step(0, 1000 / 60)`.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
