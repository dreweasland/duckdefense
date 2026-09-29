import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_PIXELS, WORLD_SIZE, renderScaleFor, viewSizeFor } from './display';

// Screen sizes in CSS pixels, with device pixel ratios, for common devices.
const DEVICES = [
  { name: 'iPhone SE', w: 375, h: 667, dpr: 2 },
  { name: 'iPhone 15', w: 393, h: 852, dpr: 3 },
  { name: 'iPhone 15 Pro Max', w: 430, h: 932, dpr: 3 },
  { name: 'Pixel 8', w: 412, h: 915, dpr: 2.625 },
  { name: 'Galaxy S24 Ultra', w: 384, h: 824, dpr: 3.75 },
  { name: 'iPad', w: 820, h: 1180, dpr: 2 },
  { name: 'iPad Pro 12.9', w: 1024, h: 1366, dpr: 2 },
  { name: 'laptop', w: 1440, h: 900, dpr: 2 },
  { name: '1080p monitor', w: 1920, h: 1080, dpr: 1 },
  { name: '1440p monitor', w: 2560, h: 1440, dpr: 1 },
];

describe('view size', () => {
  it('shows extra scenery at the sides on wide screens', () => {
    expect(viewSizeFor(1800, 800)).toEqual({ width: 1620, height: 720 });
  });

  it('shows extra scenery above and below on squarer screens', () => {
    expect(viewSizeFor(1024, 768)).toEqual({ width: 1280, height: 960 });
  });

  it('stops adding scenery past 2.4:1 (super-ultrawide monitors get thin bars)', () => {
    expect(viewSizeFor(5120, 1440)).toEqual({ width: 1728, height: 720 });
  });

  it('stays plain 16:9 when held upright (the turn-sideways screen covers it)', () => {
    expect(viewSizeFor(390, 844)).toEqual(WORLD_SIZE);
  });
});

describe('render scale', () => {
  for (const d of DEVICES) {
    it(`keeps the canvas a safe size on ${d.name}, held either way`, () => {
      const scale = renderScaleFor(d.w, d.h, d.dpr);
      for (const [w, h] of [
        [d.w, d.h],
        [d.h, d.w],
      ] as const) {
        const view = viewSizeFor(w, h);
        const pixels = Math.round(view.width * scale) * Math.round(view.height * scale);
        expect(pixels).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.3); // the quarter round-up can add a little
        expect(Math.round(view.width * scale)).toBeLessThanOrEqual(4096);
      }
    });
  }

  it('is sharp on phones: about as many canvas pixels as screen pixels', () => {
    // iPhone 15 sideways: 852 x 393 CSS px at 3x = 2556 x 1179 real pixels.
    const scale = renderScaleFor(393, 852, 3);
    const view = viewSizeFor(852, 393);
    expect(view.height * scale).toBeGreaterThanOrEqual(1179 * 0.9);
  });

  it('stays at 2x on a normal desktop, as before', () => {
    expect(renderScaleFor(2560, 1440, 1)).toBe(2);
  });

  it("doesn't waste pixels on low-resolution screens", () => {
    expect(renderScaleFor(1366, 768, 1)).toBeLessThan(2);
  });
});
