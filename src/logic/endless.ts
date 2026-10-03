import { ENDLESS } from '../data/endless';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { VARIANTS, type VariantKind } from '../data/variants';
import { ENDLESS_PERKS_AREA, ENDLESS_REPAIR_AREA, HUD_AREAS, type Area } from '../data/layout';
import type { SpawnGroup, Wave } from '../data/waves';
import { closestPointOnPolyline, distance, inEllipse, type Point } from './geometry';
import type { Level } from './level';

// Builds the Endless Pond's waves from the numbers in src/data/endless.ts, and finds spots
// for the New Nests boss reward on whichever map is being played.

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
  for (const [index, variant] of variantsFor(n, groups.length).entries()) {
    const group = groups[index]!;
    if (variant && variantFits(group.enemy, variant)) group.variant = variant;
  }
  bossesFor(n).forEach((enemy, i) => groups.push({ enemy, count: 1, every: 1, after: 8 + i * 6 }));
  return {
    time: n % ENDLESS.nightEvery === 0 ? 'night' : 'day',
    groups,
    bonusPeas: ENDLESS.bonusPeas.first + ENDLESS.bonusPeas.perWave * (n - 1),
    health: ENDLESS.healthGrowth ** (n - 1),
  };
}

/**
 * Which groups of wave `n` get a variant (by group index): none before ENDLESS.variants.from,
 * then one group, and one more every `moreEvery` waves. The groups and the twists take turns,
 * so neighbouring waves look different.
 */
export function variantsFor(n: number, groupCount: number): (VariantKind | undefined)[] {
  const { from, moreEvery, kinds } = ENDLESS.variants;
  const result: (VariantKind | undefined)[] = Array.from({ length: groupCount }, () => undefined);
  if (n < from || groupCount === 0) return result;
  const twisted = Math.min(groupCount, 1 + Math.floor((n - from) / moreEvery));
  for (let i = 0; i < twisted; i++) {
    result[(n + i) % groupCount] = kinds[(n + i) % kinds.length];
  }
  return result;
}

/** Whether a twist makes sense on a predator: no sneaky flyers, and a skunk is enough trouble already. */
function variantFits(enemy: EnemyKind, variant: VariantKind): boolean {
  const stats = ENEMIES[enemy];
  if (stats.boss || stats.sprays) return false;
  if (VARIANTS[variant].sneaky && (stats.flying || stats.sneaky)) return false;
  return true;
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

// Where a bonus nest can go: the same clearances the level checks ask of a designed nest.
export const NEST_CLEARANCE = {
  path: 56, // at least this far from the path
  nest: 75, // and from other nests
  pond: 40, // outside the pond and its sandy shore
  radius: 36, // the nest drawing's size, kept out from under buttons and the duck house
  edge: 50, // inside the map by this much
  grid: 20, // candidate spots are checked this far apart
};

/** The box the duck house drawing covers around the end of the path. */
export function houseBox(door: Point): Area {
  return { x: door.x - 75, y: door.y - 105, width: 150, height: 145 };
}

function circleHitsArea(c: Point, r: number, a: Area): boolean {
  const nx = Math.max(a.x, Math.min(c.x, a.x + a.width));
  const ny = Math.max(a.y, Math.min(c.y, a.y + a.height));
  return distance(c, { x: nx, y: ny }) < r;
}

/**
 * Spots for the New Nests boss reward on this map: the places nearest the path (so the ducks
 * there have something to peck) that are still clear of the path, the pond, the other nests,
 * the duck house, and the buttons. The same for everyone, so the leaderboard stays fair.
 */
export function bonusNestsFor(level: Level, count = ENDLESS.bonusNestCount): Point[] {
  const { path, edge, grid, nest, pond, radius } = NEST_CLEARANCE;
  const door = level.path[level.path.length - 1]!;
  const blocked = [...HUD_AREAS, ENDLESS_PERKS_AREA, ENDLESS_REPAIR_AREA, houseBox(door)];
  const width = 1280;
  const height = 720;
  const candidates: { at: Point; toPath: number }[] = [];
  for (let y = edge; y <= height - edge; y += grid) {
    for (let x = edge; x <= width - edge; x += grid) {
      const at = { x, y };
      const toPath = distance(at, closestPointOnPolyline(at, level.path));
      if (toPath <= path) continue;
      if (level.slots.some((slot) => distance(at, slot) < nest)) continue;
      if (level.ponds.some((p) => inEllipse(at, { ...p, radiusX: p.radiusX + pond, radiusY: p.radiusY + pond }))) continue;
      if (blocked.some((area) => circleHitsArea(at, radius, area))) continue;
      candidates.push({ at, toPath });
    }
  }
  candidates.sort((a, b) => a.toPath - b.toPath || a.at.y - b.at.y || a.at.x - b.at.x);
  const picked: Point[] = [];
  for (const { at } of candidates) {
    if (picked.length >= count) break;
    if (picked.every((other) => distance(at, other) >= nest)) picked.push(at);
  }
  return picked;
}
