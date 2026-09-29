import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { ResultScene } from './scenes/ResultScene';
import { TitleScene } from './scenes/TitleScene';
import { RENDER_SCALE, viewSize } from './ui/theme';

// Size the canvas to the window's shape (at RENDER_SCALE for sharp art), so it fills the screen.
function canvasSize(): { width: number; height: number } {
  const parent = document.getElementById('game');
  const view = viewSize(parent?.clientWidth ?? window.innerWidth, parent?.clientHeight ?? window.innerHeight);
  return { width: view.width * RENDER_SCALE, height: view.height * RENDER_SCALE };
}

const initialSize = canvasSize();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#24452f',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Each scene's camera zooms by RENDER_SCALE and centers the 1280 x 720 world.
    width: initialSize.width,
    height: initialSize.height,
  },
  scene: [BootScene, TitleScene, LevelSelectScene, GameScene, ResultScene, LeaderboardScene],
});

// Phones and tablets held upright see a "turn me sideways" screen (see index.html);
// pause the game while it's showing.
const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
const onOrientation = () => (portrait.matches ? game.pause() : game.resume());
portrait.addEventListener('change', onOrientation);
game.events.once(Phaser.Core.Events.READY, onOrientation);

window.addEventListener('resize', () => {
  // Re-measure the page first: this listener can run before Phaser has noticed the resize.
  game.scale.getParentBounds();
  const size = canvasSize();
  if (size.width !== game.scale.width || size.height !== game.scale.height) {
    game.scale.setGameSize(size.width, size.height);
  }
  game.scale.refresh();
});

// Dev only: expose the game so playtests can fast-forward it from the browser
// console, e.g. `for (let i = 0; i < 600; i++) game.step(0, 1000 / 60)`.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
