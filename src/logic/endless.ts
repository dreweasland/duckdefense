import { ENDLESS } from '../data/endless';
import type { SpawnGroup, Wave } from '../data/waves';

// Builds the Endless Pond's waves from the numbers in src/data/endless.ts.

/** Wave `n` of the Endless Pond (1 = the first wave). */
export function endlessWave(n: number): Wave {
  const since = (from: number) => n - from;
  const squeeze = 1 + ENDLESS.spacingPerWave * (n - 1);
  const groups: SpawnGroup[] = ENDLESS.groups
    .filter((g) => n >= g.from)
    .map((g) => ({
      enemy: g.enemy,
      count: Math.floor(g.count + g.perWave * since(g.from)),
      every: Math.max(ENDLESS.minEvery, g.every / squeeze),
      ...(g.after !== undefined && { after: g.after }),
    }));
  const bandits = bossCount(n);
  if (bandits > 0) groups.push({ enemy: 'bandit', count: bandits, every: 6, after: 8 });
  return {
    time: n % ENDLESS.nightEvery === 0 ? 'night' : 'day',
    groups,
    bonusPeas: ENDLESS.bonusPeas.first + ENDLESS.bonusPeas.perWave * (n - 1),
    health: ENDLESS.healthGrowth ** (n - 1),
  };
}

/** How many Night Bandits crash wave `n` (0 on most waves). */
export function bossCount(n: number): number {
  const { every, fasterFrom, fasterEvery, oneMoreEvery } = ENDLESS.boss;
  const bossWave = n >= fasterFrom ? n % fasterEvery === 0 : n % every === 0;
  return bossWave ? 1 + Math.floor(n / oneMoreEvery) : 0;
}

/** Every Endless Pond wave, in order. */
export function endlessWaves(): Wave[] {
  return Array.from({ length: ENDLESS.maxWaves }, (_, i) => endlessWave(i + 1));
}
