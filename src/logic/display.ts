// Screen sizing math (no Phaser here, so it can be tested with real device sizes).

export const WORLD_SIZE = { width: 1280, height: 720 };

/**
 * Most canvas pixels we'll ever ask for. Phones kill the page if a canvas gets too big
 * (iPhones especially), so this stays well under their limits.
 */
export const MAX_CANVAS_PIXELS = 4_500_000;

/**
 * The world-unit size of everything visible for a window. Wider than 16:9 shows extra
 * scenery at the sides; taller shows extra above and below. Held upright (portrait), the
 * game stays plain 16:9, since the "turn me sideways" screen covers it anyway.
 */
/** Wider than this (like a 32:9 monitor) gets thin bars rather than more scenery. */
export const MAX_ASPECT = 2.4;

export function viewSizeFor(windowWidth: number, windowHeight: number): { width: number; height: number } {
  const aspect = Math.min(MAX_ASPECT, windowWidth / Math.max(1, windowHeight));
  const worldAspect = WORLD_SIZE.width / WORLD_SIZE.height;
  if (aspect < 1) return { ...WORLD_SIZE };
  return aspect >= worldAspect
    ? { width: Math.round(WORLD_SIZE.height * aspect), height: WORLD_SIZE.height }
    : { width: WORLD_SIZE.width, height: Math.round(WORLD_SIZE.width / aspect) };
}

/**
 * How many canvas pixels to draw per world unit: enough to match the screen's real
 * pixels (sharp on phones), but never more than 2, and never so many that the canvas
 * goes over MAX_CANVAS_PIXELS. Based on the device held sideways, which is how it's played.
 */
export function renderScaleFor(screenWidth: number, screenHeight: number, devicePixelRatio: number): number {
  const long = Math.max(screenWidth, screenHeight);
  const short = Math.max(1, Math.min(screenWidth, screenHeight));
  const view = viewSizeFor(long, short);
  // World units -> screen pixels when the view fills the screen sideways.
  const screenPixelsPerUnit = Math.min(long / view.width, short / view.height) * devicePixelRatio;
  const byMemory = Math.sqrt(MAX_CANVAS_PIXELS / (view.width * view.height));
  const scale = Math.min(2, screenPixelsPerUnit, byMemory);
  // Round up to a quarter so textures don't end up a hair too small, but keep a sane floor.
  return Math.max(0.75, Math.min(2, Math.ceil(scale * 4) / 4));
}

/**
 * A number short enough to fit in a small space: 9,876 stays as it is, then 12.3K, 4.56M,
 * 1.2B. (Long Endless Pond runs rack up damage in the millions.)
 */
export function shortNumber(n: number): string {
  const whole = Math.round(n);
  if (Math.abs(whole) < 10_000) return whole.toLocaleString('en-US');
  for (const [size, letter] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) {
    if (Math.abs(whole) >= size) {
      const value = whole / size;
      // Three digits in all: 1.23M, 12.3M, 123M. Cut, don't round up, so 999,999 isn't "1000K".
      const places = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
      const cut = Math.trunc(value * 10 ** places) / 10 ** places;
      return `${cut}${letter}`;
    }
  }
  return String(whole);
}
