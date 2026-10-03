// A simple computer player, used by the balance tests to check levels can be won (or lost).
// It places ducks (one kind, or a team taking turns) in the best nests and optionally upgrades.
import type { Challenge } from '../data/challenges';
import type { Difficulty } from '../data/difficulty';
import { DUCKS, type DuckKind } from '../data/ducks';
import type { LevelInfo } from '../data/levels';
import {
  buyDuck,
  canBuy,
  canUpgrade,
  choosePerk,
  createGame,
  isOver,
  mapFromLevel,
  repairHouse,
  startWave,
  trainDuck,
  trainingCost,
  update,
  upgradeDuck,
  useBlessing,
  type Game,
} from './game';
import { distance, type Point } from './geometry';
import { parseLevel } from './level';
import { makePath, pointAt } from './path';
import { bonusNestsFor } from './endless';
import { nextUpgrade } from './upgrades';

/** Slots sorted so the ones that can see the most of every predator route come first. */
function bestSlots(info: LevelInfo, range: number): Point[] {
  const level = parseLevel(info.map);
  const house = level.path[level.path.length - 1]!;
  // The ground path, plus a hawk's line from each sky point.
  // Like a real player, care about the ground path first (most predators walk).
  const routes = [
    { path: makePath(level.path), weight: 2 },
    ...level.sky.map((from) => ({ path: makePath([from, house]), weight: 1 })),
  ];
  const coverage = (slot: Point) => {
    let seen = 0;
    for (const { path, weight } of routes) {
      for (let d = 0; d <= path.length; d += 10) if (distance(slot, pointAt(path, d)) <= range) seen += weight;
    }
    return seen;
  };
  return [...level.slots].sort((a, b) => coverage(b) - coverage(a));
}

export interface Strategy {
  /** Call Craig for the last wave. */
  craig?: boolean;
  /**
   * How to spend spare peas on upgrades between waves:
   * - 'none': never upgrade
   * - 'place-first': fill every nest first, then upgrade (cheapest upgrade first)
   * - 'upgrade-first': max out the ducks you have before buying another
   */
  upgrades?: 'none' | 'place-first' | 'upgrade-first';
  /** Play with a Daily Challenge twist. */
  challenge?: Challenge;
  /** Play the Endless Pond (the level's waves should be the endless ones). */
  endless?: boolean;
  /** In the Endless Pond, spend spare peas on training ducks and fixing the duck house. */
  extras?: boolean;
  /** Seconds per simulation step (default 1/30). Bigger is faster to run but a little rougher. */
  step?: number;
  /** Stop after this many waves (to keep very long Endless Pond runs quick to test). */
  maxWaves?: number;
  /** Which final upgrade path to take (0 or 1, default 0). */
  path?: number;
}

/**
 * Before each wave, spend peas on ducks in the best slots (and upgrades, per the strategy).
 * `kind` is one kind of duck, a team that takes turns (first one first), or null for no ducks.
 */
export function play(info: LevelInfo, difficulty: Difficulty, kind: DuckKind | readonly DuckKind[] | null, strategy: Strategy = {}): Game {
  const game = createGame(mapFromLevel(parseLevel(info.map)), info.waves, difficulty, strategy.challenge, strategy.endless);
  const team = kind === null ? [] : typeof kind === 'string' ? [kind] : [...kind];
  const slots = bestSlots(info, team[0] ? DUCKS[team[0]].range : 0);
  let placed = 0;
  /** The next duck on the team to place. */
  const nextKind = () => team[placed % team.length];
  const upgrades = strategy.upgrades ?? 'none';
  const path = strategy.path ?? 0;

  /** The cheapest upgrade you can afford right now, if any. */
  const cheapestUpgrade = () =>
    game.battle.ducks
      .filter((d) => canUpgrade(game, d.id, path))
      .sort((a, b) => nextUpgrade(a.kind, a.level, path)!.cost - nextUpgrade(b.kind, b.level, path)!.cost)[0];
  /** The duck whose next training level costs least, if you can afford one. */
  const cheapestTraining = () =>
    game.battle.ducks
      .filter((d) => (trainingCost(game, d.id) ?? Infinity) <= game.peas)
      .sort((a, b) => trainingCost(game, a.id)! - trainingCost(game, b.id)!)[0];
  const anyUpgradeLeft = () => game.battle.ducks.some((d) => nextUpgrade(d.kind, d.level));

  let usedBonusNests = false;
  while (!isOver(game) && game.waveIndex < (strategy.maxWaves ?? Infinity)) {
    // Endless Pond: take the first Pond Perk on offer.
    if (game.perkChoice) choosePerk(game, game.perkChoice[0]!);
    if (game.battle.mods.bonusNests && !usedBonusNests) {
      usedBonusNests = true;
      slots.push(...bonusNestsFor(parseLevel(info.map)));
    }
    for (;;) {
      const kind = nextKind();
      const canPlace = !!kind && slots.length > 0 && canBuy(game, kind);
      const upgrade = upgrades === 'none' ? undefined : cheapestUpgrade();
      if (upgrades === 'upgrade-first' && anyUpgradeLeft()) {
        // Save up for upgrades while any duck can still improve.
        if (upgrade) upgradeDuck(game, upgrade.id, path);
        else break;
      } else if (canPlace) {
        buyDuck(game, kind!, slots.shift()!);
        placed++;
      } else if (upgrade) {
        upgradeDuck(game, upgrade.id, path);
      } else if (strategy.extras && repairHouse(game)) {
        // Fixed a heart.
      } else if (strategy.extras && cheapestTraining()) {
        trainDuck(game, cheapestTraining()!.id);
      } else {
        break;
      }
    }
    if (strategy.craig && game.waveIndex === game.waves.length - 1) useBlessing(game);
    startWave(game);
    const dt = strategy.step ?? 1 / 30;
    for (let i = 0; i < 200_000 && game.phase === 'wave'; i++) update(game, dt);
  }
  return game;
}
