import Phaser from 'phaser';

/** The game world is always 1280 x 720; everything is laid out in these units. */
export const WORLD = { width: 1280, height: 720 };

/**
 * The canvas renders at this multiple of the world size so art stays sharp on
 * high-DPI phones and tablets. Each scene zooms its camera by the same amount.
 */
export const RENDER_SCALE = 2;

/**
 * The canvas matches the window's shape, so screens wider (or taller) than 16:9 see extra
 * scenery around the 1280 x 720 world instead of black bars. This is the world-unit size
 * of the whole visible area for a given window.
 */
export function viewSize(windowWidth: number, windowHeight: number): { width: number; height: number } {
  const aspect = windowWidth / Math.max(1, windowHeight);
  const worldAspect = WORLD.width / WORLD.height;
  return aspect >= worldAspect
    ? { width: Math.round(WORLD.height * aspect), height: WORLD.height }
    : { width: WORLD.width, height: Math.round(WORLD.width / aspect) };
}

/** Everything behind the world is drawn over this area, so no edge shows on any screen shape. */
export const BACKDROP = { x: -1500, y: -1500, width: WORLD.width + 3000, height: WORLD.height + 3000 };

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
