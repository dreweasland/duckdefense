import { ENDLESS } from '../data/endless';
import type { EnemyKind } from '../data/enemies';
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
  bossesFor(n).forEach((enemy, i) => groups.push({ enemy, count: 1, every: 1, after: 8 + i * 6 }));
  return {
    time: n % ENDLESS.nightEvery === 0 ? 'night' : 'day',
    groups,
    bonusPeas: ENDLESS.bonusPeas.first + ENDLESS.bonusPeas.perWave * (n - 1),
    health: ENDLESS.healthGrowth ** (n - 1),
  };
}

/** The bosses that crash wave `n`, taking turns through ENDLESS.boss.kinds (none on most waves). */
export function bossesFor(n: number): EnemyKind[] {
  const count = bossCount(n);
  if (count === 0) return [];
  let bossWavesBefore = 0;
  for (let w = 1; w < n; w++) if (bossCount(w) > 0) bossWavesBefore++;
  const { kinds } = ENDLESS.boss;
  return Array.from({ length: count }, (_, i) => kinds[(bossWavesBefore + i) % kinds.length]!);
}

/** How many bosses crash wave `n` (0 on most waves). */
export function bossCount(n: number): number {
  const { every, fasterFrom, fasterEvery, oneMoreEvery } = ENDLESS.boss;
  const bossWave = n >= fasterFrom ? n % fasterEvery === 0 : n % every === 0;
  return bossWave ? 1 + Math.floor(n / oneMoreEvery) : 0;
}

/** Every Endless Pond wave, in order. */
export function endlessWaves(): Wave[] {
  return Array.from({ length: ENDLESS.maxWaves }, (_, i) => endlessWave(i + 1));
}
