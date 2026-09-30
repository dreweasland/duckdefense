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
  if (n % ENDLESS.bossEvery === 0) groups.push({ enemy: 'bandit', count: 1, every: 1, after: 8 });
  return {
    time: n % ENDLESS.nightEvery === 0 ? 'night' : 'day',
    groups,
    bonusPeas: ENDLESS.bonusPeas.first + ENDLESS.bonusPeas.perWave * (n - 1),
    health: 1 + ENDLESS.healthPerWave * (n - 1),
  };
}

/** Every Endless Pond wave, in order. */
export function endlessWaves(): Wave[] {
  return Array.from({ length: ENDLESS.maxWaves }, (_, i) => endlessWave(i + 1));
}
