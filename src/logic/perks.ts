import { PERK_CHOICES, PERK_ORDER, PERKS, type PerkId } from '../data/perks';

// Pond Perks: turning the perks you've picked into the multipliers the battle uses,
// and choosing which perks to offer (from the wave number, so everyone gets the same).

export type PerksTaken = Partial<Record<PerkId, number>>;

/** Multipliers the battle reads. 1 means "no change". */
export interface Mods {
  damage: number;
  range: number;
  attackSpeed: number;
  killPeas: number;
  dayBonus: number;
  nightDamage: number;
  scare: number; // multiplies how long ducks stay scared
  stun: number; // multiplies how long Chester's quack freezes
  slow: number; // multiplies Curtis's slow (smaller = slower predators)
  // Boss rewards (0 means "doesn't have it").
  craigEvery: number; // waves between Craig's blessings (0 = the usual ENDLESS.craigEvery)
  soakSpeed: number; // soaked predators move at this share of their speed (1 = no change)
  soakTime: number; // seconds a predator stays soaked after one of Sunny's splashes
  quackPush: number; // pixels Chester's quack blows flyers back
  prickle: number; // share of full health predators near Curtis lose each second
  flapStun: number; // seconds a flapped predator stays dizzy
  bonusNests: number; // 1 once the extra nests are open
}

export const NO_MODS: Readonly<Mods> = {
  damage: 1,
  range: 1,
  attackSpeed: 1,
  killPeas: 1,
  dayBonus: 1,
  nightDamage: 1,
  scare: 1,
  stun: 1,
  slow: 1,
  craigEvery: 0,
  soakSpeed: 1,
  soakTime: 0,
  quackPush: 0,
  prickle: 0,
  flapStun: 0,
  bonusNests: 0,
};

/** The multipliers from every perk picked so far. */
export function perkMods(taken: PerksTaken): Mods {
  const mods = { ...NO_MODS };
  for (const id of PERK_ORDER) {
    const times = taken[id] ?? 0;
    const e = PERKS[id].effect;
    mods.damage += (e.damage ?? 0) * times;
    mods.range += (e.range ?? 0) * times;
    mods.attackSpeed += (e.attackSpeed ?? 0) * times;
    mods.killPeas += (e.killPeas ?? 0) * times;
    mods.dayBonus += (e.dayBonus ?? 0) * times;
    mods.nightDamage += (e.nightDamage ?? 0) * times;
    mods.stun += (e.stun ?? 0) * times;
    mods.scare *= (1 - (e.scare ?? 0)) ** times;
    mods.slow *= (1 - (e.slow ?? 0)) ** times;
    if (times === 0) continue;
    if (e.craigEvery) mods.craigEvery = e.craigEvery;
    if (e.soak) {
      mods.soakSpeed = e.soak.speed;
      mods.soakTime = e.soak.time;
    }
    mods.quackPush += e.quackPush ?? 0;
    mods.prickle += e.prickle ?? 0;
    mods.flapStun += e.flapStun ?? 0;
    if (e.nests) mods.bonusNests = 1;
  }
  return mods;
}

/** A well-mixed number, so each wave's offer looks different. */
function mix(n: number): number {
  let h = Math.imul(n ^ 0x2545f491, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77);
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * The perks offered after wave `wave` (the same for everyone): ones not picked the most times
 * yet. After a boss wave (`boss`), the boss rewards still left are offered instead; once
 * they're all taken, it's back to the usual perks.
 */
export function offerPerks(taken: PerksTaken, wave: number, boss = false): PerkId[] {
  const left = PERK_ORDER.filter((id) => (taken[id] ?? 0) < PERKS[id].max);
  const rewards = boss ? left.filter((id) => PERKS[id].boss) : [];
  return (rewards.length > 0 ? rewards : left.filter((id) => !PERKS[id].boss))
    .map((id) => ({ id, order: mix(wave * 101 + PERK_ORDER.indexOf(id) * 7) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, PERK_CHOICES)
    .map((p) => p.id);
}
