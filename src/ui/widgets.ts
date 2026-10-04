import Phaser from 'phaser';
import { isMuted, playSound, setMuted } from '../audio/sfx';
import { COLORS, WORLD, textStyle } from './theme';

/** A dark rounded "pill" behind HUD counters. Returns the graphics so it can be layered. */
export function drawPill(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.Graphics {
  return scene.add
    .graphics()
    .fillStyle(COLORS.panel, 0.62)
    .fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2)
    .lineStyle(2, 0xffffff, 0.25)
    .strokeRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
}

/** A cream card with an ink outline, like the duck picker cards and result panel. */
export function drawCard(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  options: { fill?: number; border?: number; borderWidth?: number; radius?: number } = {},
): Phaser.GameObjects.Graphics {
  const radius = options.radius ?? 16;
  return graphics
    .clear()
    .fillStyle(0x000000, 0.25)
    .fillRoundedRect(-width / 2, -height / 2 + 5, width, height, radius)
    .fillStyle(options.fill ?? COLORS.cream)
    .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
    .lineStyle(options.borderWidth ?? 3, options.border ?? COLORS.ink)
    .strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
}

/**
 * A big, chunky button with a 3D edge that presses down when tapped.
 * Calls onTap once, after the press animation starts.
 */
export function drawBigButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: number,
  edgeColor: number,
  onTap: () => void,
  options: { width?: number; height?: number; icon?: string; fontSize?: number } = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 280;
  const height = options.height ?? 96;
  const edge = 8;
  const face = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const draw = (pressed: boolean) => {
    const top = pressed ? edge - 3 : 0;
    g.clear()
      .fillStyle(0x000000, 0.25)
      .fillRoundedRect(-width / 2, -height / 2 + edge + 4, width, height, 24)
      .fillStyle(edgeColor)
      .fillRoundedRect(-width / 2, -height / 2 + edge, width, height, 24)
      .fillStyle(color)
      .fillRoundedRect(-width / 2, -height / 2 + top, width, height, 24)
      .fillStyle(0xffffff, 0.18)
      .fillRoundedRect(-width / 2 + 10, -height / 2 + top + 8, width - 20, height / 3, 14)
      .lineStyle(4, COLORS.ink)
      .strokeRoundedRect(-width / 2, -height / 2 + top, width, height, 24);
    face.y = top;
  };
  draw(false);

  const fontSize = options.fontSize ?? 42;
  const text = scene.add.text(options.icon ? fontSize / 2 : 0, -2, label, textStyle(fontSize, { weight: '700' })).setOrigin(0.5);
  face.add(text);
  if (options.icon) {
    face.add(scene.add.image(text.x - text.width / 2 - fontSize * 0.55, -2, options.icon).setDisplaySize(fontSize, fontSize));
  }

  const hit = scene.add.zone(0, edge / 2, width, height + edge).setInteractive({ useHandCursor: true });
  const button = scene.add.container(x, y, [g, face, hit]);
  hit.once('pointerdown', () => {
    draw(true);
    playSound(scene, 'tap');
    scene.time.delayedCall(90, onTap);
  });
  return button;
}

/** A small round speaker button that turns sound on and off (remembered between visits). */
export function drawSoundButton(scene: Phaser.Scene, x: number, y: number, depth: number): Phaser.GameObjects.Container {
  const icon = scene.add.graphics();
  const draw = () => {
    icon.clear().fillStyle(0xffffff).lineStyle(3, COLORS.ink);
    // Speaker.
    icon.fillRect(-12, -5, 7, 10).strokeRect(-12, -5, 7, 10);
    icon.fillTriangle(-5, -5, 5, -13, 5, 13).fillTriangle(-5, -5, 5, 13, -5, 5);
    icon.strokeTriangle(-5, -5, 5, -13, 5, 13);
    if (isMuted()) {
      icon.lineStyle(4, 0xff6b5a).lineBetween(9, -7, 19, 7).lineBetween(19, -7, 9, 7);
    } else {
      icon.lineStyle(3, 0xffffff);
      icon.beginPath().arc(6, 0, 8, -0.9, 0.9).strokePath();
      icon.beginPath().arc(6, 0, 14, -0.9, 0.9).strokePath();
    }
  };
  draw();
  const back = scene.add.circle(0, 0, 26, COLORS.panel, 0.7).setStrokeStyle(3, 0xffffff, 0.35);
  // Tap area bigger than the drawing, for fingers.
  back
    .setInteractive({
      hitArea: new Phaser.Geom.Circle(26, 26, 38),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    })
    .on('pointerdown', () => {
      setMuted(scene, !isMuted());
      draw();
      playSound(scene, 'tap');
    });
  return scene.add.container(x, y, [back, icon]).setDepth(depth);
}

/** A round button with an icon or glyph, e.g. play. */
export function drawRoundButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  color: number,
  edgeColor: number,
  content: Phaser.GameObjects.GameObject[],
): { container: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Arc } {
  const shadow = scene.add.circle(0, 7, radius, 0x000000, 0.25);
  const edge = scene.add.circle(0, 5, radius, edgeColor).setStrokeStyle(4, COLORS.ink);
  const face = scene.add.circle(0, 0, radius, color).setStrokeStyle(4, COLORS.ink);
  const shine = scene.add.ellipse(0, -radius * 0.45, radius * 1.2, radius * 0.5, 0xffffff, 0.2);
  const container = scene.add.container(x, y, [shadow, edge, face, shine, ...content]);
  face.setInteractive({ useHandCursor: true });
  return { container, hit: face };
}

/**
 * Stops every tween on these objects and everything inside them. Phaser keeps a tween running
 * after its target is destroyed, so a looping tween (a spinning star, a pulsing badge) on
 * something inside a container must be killed before the container goes.
 */
export function killTweensDeep(scene: Phaser.Scene, ...targets: Phaser.GameObjects.GameObject[]): void {
  const all: Phaser.GameObjects.GameObject[] = [];
  const collect = (object: Phaser.GameObjects.GameObject): void => {
    all.push(object);
    if (object instanceof Phaser.GameObjects.Container) object.each(collect);
  };
  targets.forEach(collect);
  scene.tweens.killTweensOf(all);
}

/** Fades the screen to black, then starts another scene. */
export function fadeToScene(scene: Phaser.Scene, key: string, data?: object, duration = 220): void {
  scene.cameras.main.fadeOut(duration, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

/** The round blue "back" arrow in the top-left corner. */
export function drawBackButton(scene: Phaser.Scene, onTap: () => void): void {
  const arrow = scene.add
    .graphics()
    .fillStyle(0xffffff)
    .fillTriangle(8, -16, 8, 16, -16, 0)
    .lineStyle(4, COLORS.ink)
    .strokeTriangle(8, -16, 8, 16, -16, 0);
  drawRoundButton(scene, 70, 70, 40, COLORS.blue, COLORS.blueDark, [arrow]).hit.on('pointerdown', () => {
    playSound(scene, 'tap');
    onTap();
  });
}

/** A white speech bubble with dark text, pointing down at (x, y). Fades up and away. */
export function popSpeechBubble(scene: Phaser.Scene, x: number, y: number, message: string, depth: number): void {
  const text = scene.add.text(0, 0, message, textStyle(22, { color: COLORS.inkCss, strokeThickness: 0 })).setOrigin(0.5);
  const width = text.width + 24;
  const height = text.height + 12;
  // Keep the bubble on screen (a speaker can be just off the edge).
  x = Math.max(width / 2 + 10, Math.min(WORLD.width - width / 2 - 10, x));
  y = Math.max(height + 20, y);
  const g = scene.add
    .graphics()
    .fillStyle(0xffffff)
    .fillRoundedRect(-width / 2, -height / 2, width, height, 12)
    .fillTriangle(-8, height / 2 - 1, 8, height / 2 - 1, 0, height / 2 + 10)
    .lineStyle(3, COLORS.ink)
    .strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
  const bubble = scene.add.container(x, y - height / 2 - 10, [g, text]).setDepth(depth).setScale(0);
  scene.tweens.chain({
    targets: bubble,
    tweens: [
      { scale: 1, duration: 180, ease: 'Back.Out' },
      { y: bubble.y - 24, alpha: 0, delay: 700, duration: 400 },
    ],
    onComplete: () => bubble.destroy(),
  });
}
