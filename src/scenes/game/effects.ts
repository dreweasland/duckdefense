import Phaser from 'phaser';
import type { Point } from '../../logic/geometry';
import { COLORS, DEPTH, WORLD } from '../../ui/theme';
import type { Effects } from './host';

/** The particle emitters a level uses, made once and fired with explode(). */
export function createEffects(scene: Phaser.Scene, fountainAt: Point, house: Point): Effects {
  const burst = (texture: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number) =>
    scene.add.particles(0, 0, texture, { emitting: false, ...config }).setDepth(depth);

  return {
    splash: burst(
      'dot',
      {
        speed: { min: 60, max: 170 },
        angle: { min: 200, max: 340 },
        gravityY: 420,
        lifespan: 420,
        scale: { start: 0.55, end: 0 },
        tint: [COLORS.water, 0xffffff, 0x5bb3e8],
      },
      DEPTH.effects,
    ),
    feathers: burst(
      'feather',
      {
        speed: { min: 40, max: 130 },
        rotate: { min: 0, max: 360 },
        gravityY: 60,
        lifespan: 900,
        scale: { start: 0.6, end: 0.3 },
        alpha: { start: 1, end: 0 },
        tint: [0x30343b, 0x5b606a],
      },
      DEPTH.effects,
    ),
    puff: burst(
      'glow',
      {
        speed: { min: 20, max: 70 },
        lifespan: 550,
        scale: { start: 0.12, end: 0.3 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xe8e4dc,
      },
      DEPTH.effects,
    ),
    stars: burst(
      'star',
      { speed: { min: 50, max: 140 }, lifespan: 500, scale: { start: 0.5, end: 0 }, tint: COLORS.goldLight },
      DEPTH.effects,
    ),
    sparkles: scene.add
      .particles(house.x, house.y - 50, 'star', {
        emitting: false,
        emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 100) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: 800,
        frequency: 90,
        scale: { start: 0.35, end: 0 },
        tint: [COLORS.goldLight, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.shield + 1),
    fountainSpray: scene.add
      .particles(fountainAt.x, fountainAt.y - 6, 'dot', {
        emitting: false,
        speed: { min: 50, max: 110 },
        angle: { min: 250, max: 290 },
        gravityY: 260,
        lifespan: 650,
        frequency: 40,
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xcfefff, COLORS.water],
      })
      .setDepth(DEPTH.pond + 0.5),
    fireflies: scene.add
      .particles(0, 0, 'glow', {
        emitting: false,
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(0, 130, WORLD.width, WORLD.height - 130) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        lifespan: 3200,
        frequency: 260,
        speed: { min: 4, max: 16 },
        scale: { start: 0.05, end: 0.02 },
        alpha: { values: [0, 1, 0.3, 1, 0] },
        tint: 0xfff27a,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.lights),
    mudSplash: burst(
      'dot',
      { speed: { min: 30, max: 90 }, angle: { min: 200, max: 340 }, gravityY: 320, lifespan: 380, scale: { start: 0.45, end: 0 }, tint: [0x4a3322, 0x6b4a33] },
      DEPTH.effects,
    ),
    thorns: burst(
      'dot',
      { speed: { min: 30, max: 80 }, lifespan: 320, scale: { start: 0.35, end: 0 }, tint: [0x6f8f3a, 0xf2e6c8, 0x6a2a5a] },
      DEPTH.effects,
    ),
  };
}
