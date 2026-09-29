// Day and night, the solar battery, and the pond fountain.
// Like the real Victron setup: the sun charges the battery during day waves,
// and the fountain runs off the battery, so it drains at night. While it runs,
// its refreshing spray makes nearby ducks hit harder.

export const NIGHT = {
  enemySpeed: 1.25, // predators move this much faster at night
};

export const BATTERY = {
  capacity: 100,
  startCharge: 60, // charge at the start of the level
  solarPerSecond: 6, // charge added per second during day waves
};

export const FOUNTAIN = {
  range: 310, // how far from the fountain its refreshing spray reaches (nests within this get the boost)
  damageBoost: 0.3, // ducks in the spray hit this much harder while it has power (0.3 = +30%)
  drawPerSecond: 4, // battery used per second while it runs (during waves)
};
