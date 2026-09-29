import { DUCKS, type DuckKind, type DuckStats, type Upgrade } from '../data/ducks';

// A duck's stats at an upgrade level (0 = not upgraded, 1 or 2 = upgraded).

export const MAX_UPGRADE_LEVEL = 2;

/** Base stats with each bought upgrade's changes layered on, in order. */
export function statsAt(kind: DuckKind, level: number): DuckStats {
  let stats = DUCKS[kind];
  for (const upgrade of stats.upgrades.slice(0, level)) {
    const { wingFlap, alarmQuack, holdTheLine, ...simple } = upgrade.changes;
    stats = {
      ...stats,
      ...simple,
      wingFlap: stats.wingFlap && { ...stats.wingFlap, ...wingFlap },
      alarmQuack: stats.alarmQuack && { ...stats.alarmQuack, ...alarmQuack },
      holdTheLine: stats.holdTheLine && { ...stats.holdTheLine, ...holdTheLine },
    };
  }
  return stats;
}

/** The next upgrade for a duck at this level, if there is one. */
export function nextUpgrade(kind: DuckKind, level: number): Upgrade | undefined {
  return level < MAX_UPGRADE_LEVEL ? DUCKS[kind].upgrades[level] : undefined;
}

/** The duck's name at this level, e.g. "Seasoned Sunny". */
export function nameAt(kind: DuckKind, level: number): string {
  return level > 0 ? DUCKS[kind].upgrades[level - 1]!.name : DUCKS[kind].name;
}

/** Everything spent on a duck: its price plus the upgrades bought. */
export function totalSpent(kind: DuckKind, level: number): number {
  return DUCKS[kind].cost + DUCKS[kind].upgrades.slice(0, level).reduce((sum, u) => sum + u.cost, 0);
}
