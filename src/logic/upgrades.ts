import { DUCKS, type DuckKind, type DuckStats, type Upgrade } from '../data/ducks';

// A duck's stats at an upgrade level: 0 = not upgraded, 1 and 2 = its two upgrades,
// 3 = its final upgrade, where it picked one of two paths (`path` 0 or 1).

export const MAX_UPGRADE_LEVEL = 3;

/** The upgrades bought to reach `level`, in order (the final one is the picked path). */
function boughtUpgrades(kind: DuckKind, level: number, path = 0): Upgrade[] {
  const duck = DUCKS[kind];
  const bought = duck.upgrades.slice(0, Math.min(level, duck.upgrades.length));
  if (level > duck.upgrades.length) bought.push(duck.finals[path]!);
  return bought;
}

/** Base stats with each bought upgrade's changes layered on, in order. */
export function statsAt(kind: DuckKind, level: number, path = 0): DuckStats {
  let stats = DUCKS[kind];
  for (const upgrade of boughtUpgrades(kind, level, path)) {
    const { wingFlap, alarmQuack, slowZone, ...simple } = upgrade.changes;
    stats = {
      ...stats,
      ...simple,
      wingFlap: stats.wingFlap && { ...stats.wingFlap, ...wingFlap },
      alarmQuack: stats.alarmQuack && { ...stats.alarmQuack, ...alarmQuack },
      slowZone: stats.slowZone && { ...stats.slowZone, ...slowZone },
    };
  }
  return stats;
}

/**
 * What a duck at this level can buy next: one upgrade, the two final paths to pick from,
 * or nothing once it's fully upgraded.
 */
export function upgradeOptions(kind: DuckKind, level: number): Upgrade[] {
  const duck = DUCKS[kind];
  if (level < duck.upgrades.length) return [duck.upgrades[level]!];
  if (level === duck.upgrades.length) return [...duck.finals];
  return [];
}

/** Whether a duck is choosing its final path next. */
export function isFinalChoice(kind: DuckKind, level: number): boolean {
  return upgradeOptions(kind, level).length > 1;
}

/** The next upgrade for a duck at this level (for the final choice, path `path`; otherwise there's only one), if there is one. */
export function nextUpgrade(kind: DuckKind, level: number, path = 0): Upgrade | undefined {
  const options = upgradeOptions(kind, level);
  return options.length > 1 ? options[path] : options[0];
}

/** The duck's name at this level, e.g. "Seasoned Sunny" or "Tidal Sunny". */
export function nameAt(kind: DuckKind, level: number, path = 0): string {
  return boughtUpgrades(kind, level, path).at(-1)?.name ?? DUCKS[kind].name;
}

/** Everything spent on a duck: its price plus the upgrades bought. */
export function totalSpent(kind: DuckKind, level: number, path = 0): number {
  return DUCKS[kind].cost + boughtUpgrades(kind, level, path).reduce((sum, u) => sum + u.cost, 0);
}
