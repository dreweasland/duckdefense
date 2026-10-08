import Phaser from 'phaser';
import { drawGrass, drawOutskirts, drawPond, scatterDecor } from '../art/terrain';
import type { Difficulty } from '../data/difficulty';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { DUCK_ORDER } from '../data/ducks';
import { COLORS, DIFFICULTY_COLORS, WORLD, entityDepth, setupCamera, textStyle } from '../ui/theme';
import { playSound } from '../audio/sfx';
import { hatFor } from '../logic/hats';
import { expertUnlocked } from '../logic/progress';
import { loadProgress } from '../save';
import { duckWithHat } from '../ui/hats';
import { drawBigButton, drawRoundButton, drawSoundButton, fadeToScene } from '../ui/widgets';
import type { LeaderboardSceneData } from './LeaderboardScene';
import type { LevelSelectSceneData } from './LevelSelectScene';

const POND = { center: { x: WORLD.width / 2, y: 420 }, radiusX: 330, radiusY: 95 };

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create(): void {
    setupCamera(this);
    const cx = WORLD.width / 2;

    drawGrass(this, 31);
    drawOutskirts(this, 34);
    drawPond(this, POND, 32);
    scatterDecor(this, { ponds: [POND], blocked: [{ x: 260, y: 40, width: 760, height: 250 }, { x: 250, y: 540, width: 780, height: 150 }] }, 33);

    // The flock, bobbing on the pond in their hats.
    const progress = loadProgress();
    DUCK_ORDER.forEach((kind, i) => {
      const x = cx - 240 + i * 160;
      const duck = duckWithHat(this, kind, x, 400, 110, hatFor(progress, kind)).setDepth(entityDepth(430));
      this.tweens.add({ targets: duck, y: 392, angle: 3, duration: 800 + i * 110, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });

    // Logo.
    const logo = this.add.text(cx, 150, 'Duck Defense', textStyle(118, { weight: '700', strokeThickness: 14 })).setOrigin(0.5);
    const gradient = logo.context.createLinearGradient(0, 0, 0, logo.height);
    gradient.addColorStop(0.2, '#fff3b0');
    gradient.addColorStop(0.8, '#ffb020');
    logo.setFill(gradient).setShadow(0, 8, 'rgba(0,0,0,0.3)', 0, true, true).setDepth(100);
    this.tweens.add({ targets: logo, scale: 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add
      .text(cx, 250, 'Protect the Nestera duck house!', textStyle(34, { strokeThickness: 7 }))
      .setOrigin(0.5)
      .setDepth(100);

    // Picking a difficulty starts the game. Easy is green and comes first; Expert joins the row
    // once a level has been won on Hard (the buttons squeeze up to make room).
    const start = (difficulty: Difficulty) => {
      const data: LevelSelectSceneData = { difficulty };
      fadeToScene(this, 'LevelSelectScene', data, 250);
    };
    const shown = DIFFICULTY_ORDER.filter((difficulty) => difficulty !== 'expert' || expertUnlocked(progress));
    const spacing = shown.length > 3 ? 262 : 300;
    const size = shown.length > 3 ? { width: 244, fontSize: 38 } : {};
    shown.forEach((difficulty, i) => {
      const x = cx + (i - (shown.length - 1) / 2) * spacing;
      const { fill, edge } = DIFFICULTY_COLORS[difficulty];
      drawBigButton(this, x, 610, DIFFICULTIES[difficulty].label, fill, edge, () => start(difficulty), size).setDepth(100);
    });

    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 100);

    // Top scores.
    const trophy = this.add.image(0, 0, 'icon-trophy').setDisplaySize(44, 44);
    const scores = drawRoundButton(this, WORLD.width - 70, 70, 42, COLORS.gold, COLORS.goldDark, [trophy]);
    scores.container.setDepth(100);
    scores.hit.on('pointerdown', () => {
      playSound(this, 'tap');
      const data: LeaderboardSceneData = { back: { scene: 'TitleScene' } };
      fadeToScene(this, 'LeaderboardScene', data);
    });
    // The Wardrobe: dress up the ducks.
    const hat = this.add.image(0, 2, 'hat-party').setDisplaySize(52, 47);
    const wardrobe = drawRoundButton(this, 70, 70, 42, COLORS.pink, COLORS.pinkDark, [hat]);
    wardrobe.container.setDepth(100);
    wardrobe.hit.on('pointerdown', () => {
      playSound(this, 'tap');
      fadeToScene(this, 'WardrobeScene');
    });
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }
}
