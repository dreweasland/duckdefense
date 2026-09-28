// Day and night, the solar battery, and the pond fountain.
// Like the real Victron setup: the sun charges the battery during day waves,
// and the fountain runs off the battery, so it drains at night.

export const NIGHT = {
  enemySpeed: 1.25, // predators move this much faster at night
};

export const BATTERY = {
  capacity: 100,
  startCharge: 60, // charge at the start of the level
  solarPerSecond: 6, // charge added per second during day waves
};

export const FOUNTAIN = {
  range: 170, // how far from the pond's center the spray reaches
  slow: 0.5, // ground predators in range move at this fraction of their speed
  drawPerSecond: 4, // battery used per second while it runs (during waves)
};
