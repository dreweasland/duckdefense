import { ENDLESS_REPAIR_AREA } from '../../data/layout';

// Where the game screen's buttons and counters sit, in world units (1280 x 720).
// HUD_AREAS in src/data/layout.ts lists the same spots as areas, so levels keep their nests
// clear of them: change both together.

export const PEA_ICON = { x: 596, y: 38 };
/** Duck picker cards along the top-left, kept short so the path below stays visible. Low enough that the raised (selected) card and its corner badges never go off the top of the screen. */
export const CARD = { width: 84, height: 90, y: 54, spacing: 92, lift: 3 };
/** Flock power buttons: a column down the right edge, between the wave preview and the pause button, one per duck in picker order. */
export const POWER_BUTTON = { x: 1250, y: 250, spacing: 86, radius: 30 };
export const GO_BUTTON = { x: 1200, y: 70 };
export const REPAIR_BUTTON = {
  x: ENDLESS_REPAIR_AREA.x + ENDLESS_REPAIR_AREA.width / 2,
  y: ENDLESS_REPAIR_AREA.y + ENDLESS_REPAIR_AREA.height / 2,
  width: ENDLESS_REPAIR_AREA.width,
  height: 40,
};
/** Call the next wave early (during a wave, left of the fast-forward button). */
export const CALL_EARLY = { x: 1110, y: 112 };
/** "Coming next" chips, in a row that ends just left of the start button. */
export const PREVIEW = { right: 1146, y: 112, chip: 58, gap: 4, maxWidth: 256 };
export const CRAIG_BUTTON = { x: 100, y: 640 };
/** Just above the sound button. */
export const PAUSE_BUTTON = { x: 1245, y: 615 };
export const SOUND_BUTTON = { x: 1245, y: 685 };
export const BOSS_BAR_WIDTH = 360;
