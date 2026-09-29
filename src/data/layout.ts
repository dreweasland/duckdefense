// Screen areas covered by buttons and counters, in world units (the map is 1280 x 720).
// Keep nests (slots) and the duck house out of these when designing a level.

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HUD_AREAS: Area[] = [
  { x: 0, y: 0, width: 390, height: 105 }, // duck picker
  { x: 560, y: 0, width: 600, height: 70 }, // peas, hearts, wave, battery
  { x: 1150, y: 20, width: 110, height: 105 }, // start-wave button
  { x: 890, y: 78, width: 262, height: 70 }, // coming-next preview, and the call-early button
  { x: 40, y: 580, width: 120, height: 120 }, // Craig
  { x: 1210, y: 650, width: 70, height: 70 }, // sound on/off
];
