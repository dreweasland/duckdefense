import Phaser from 'phaser';

/** The game world is always 1280 x 720; everything is laid out in these units. */
export const WORLD = { width: 1280, height: 720 };

/**
 * The canvas renders at this multiple of the world size so art stays sharp on
 * high-DPI phones and tablets. Each scene zooms its camera by the same amount.
 */
export const RENDER_SCALE = 2;

export function setupCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(RENDER_SCALE).centerOn(WORLD.width / 2, WORLD.height / 2);
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
