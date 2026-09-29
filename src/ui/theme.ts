import Phaser from 'phaser';
import { WORLD_SIZE, renderScaleFor, viewSizeFor } from '../logic/display';

/** The game world is always 1280 x 720; everything is laid out in these units. */
export const WORLD = WORLD_SIZE;

/**
 * Canvas pixels per world unit, chosen once for this device: sharp on high-DPI phones and
 * tablets (2 on desktops), but capped so the canvas never gets big enough to crash a phone.
 * Each scene zooms its camera by the same amount.
 */
export const RENDER_SCALE = renderScaleFor(window.screen.width, window.screen.height, window.devicePixelRatio || 1);

/** The world-unit size of the whole visible area for a window (see logic/display.ts). */
export const viewSize = viewSizeFor;

/**
 * Everything behind the world is drawn over this area, so no edge shows on any screen shape
 * we support: up to about 2.4:1 wide (400 each side) and 4:3 tall (300 above and below).
 * Kept no bigger than needed, since it costs memory on phones.
 */
export const BACKDROP = { x: -400, y: -300, width: WORLD.width + 800, height: WORLD.height + 600 };

/** Zooms the camera to the render scale and keeps the world centered when the window resizes. */
export function setupCamera(scene: Phaser.Scene): void {
  const camera = scene.cameras.main;
  const center = () => camera.setZoom(RENDER_SCALE).centerOn(WORLD.width / 2, WORLD.height / 2);
  const onResize = (gameSize: Phaser.Structs.Size) => {
    camera.setSize(gameSize.width, gameSize.height);
    center();
  };
  center();
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
}

export const FONT = 'Fredoka, "Arial Rounded MT Bold", Arial, sans-serif';

export const COLORS = {
  ink: 0x2b2233, // outlines and dark text
  inkCss: '#2b2233',
  cream: 0xfff7e6,
  gold: 0xffd23f,
  goldCss: '#ffd23f',
  green: 0x3fbf5f,
  greenDark: 0x2a8c44,
  orange: 0xf28c28,
  orangeDark: 0xb8611a,
  blue: 0x3d8fe0,
  blueDark: 0x2a66a8,
  panel: 0x13241a,
  water: 0x9fd8ff,
  night: 0x0d1b3d,
  pink: 0xff7aa2,
};

/** Draw order. Characters and scenery sort by their y within the "entities" band. */
export const DEPTH = {
  ground: 0,
  path: 1,
  pond: 2,
  entities: 10, // + y / 1000
  effects: 20,
  shield: 30,
  night: 50,
  lights: 51,
  floatText: 60,
  banner: 90,
  hud: 100,
};

export function entityDepth(y: number): number {
  return DEPTH.entities + y / 1000;
}

/** Rounded, outlined text in the game's font, rendered sharp at the canvas scale. */
export function textStyle(
  size: number,
  options: { color?: string; stroke?: string; strokeThickness?: number; weight?: string } = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontStyle: options.weight ?? '600',
    fontSize: `${size}px`,
    color: options.color ?? '#ffffff',
    stroke: options.stroke ?? COLORS.inkCss,
    strokeThickness: options.strokeThickness ?? Math.max(3, Math.round(size / 7)),
    resolution: RENDER_SCALE,
  };
}
