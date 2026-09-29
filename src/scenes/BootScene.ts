import Phaser from 'phaser';
import { allSprites } from '../art/sprites';
import { FONT, RENDER_SCALE } from '../ui/theme';

/** Turns the SVG art into textures and waits for the font, then shows the title. */
export class BootScene extends Phaser.Scene {
  private blobUrls: string[] = [];

  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const sprite of allSprites()) {
      const url = URL.createObjectURL(new Blob([sprite.svg], { type: 'image/svg+xml' }));
      this.blobUrls.push(url);
      // Loaded at the canvas's render scale so it stays sharp when the camera zooms.
      this.load.svg(sprite.key, url, { width: sprite.width * RENDER_SCALE, height: sprite.height * RENDER_SCALE });
    }
  }

  create(): void {
    this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    this.blobUrls = [];

    // Small white dot for particles (tinted per effect).
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillCircle(8, 8, 8).generateTexture('dot', 16, 16).destroy();

    // Wait for the web font (but not forever), so text doesn't pop in with the wrong font.
    const fontReady = document.fonts
      ? Promise.race([
          Promise.all([document.fonts.load(`600 32px ${FONT}`), document.fonts.load(`700 32px ${FONT}`)]),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ])
      : Promise.resolve();
    fontReady.finally(() => this.scene.start('TitleScene'));
  }
}
