// A simple computer player, used by the balance tests to check levels can be won (or lost).
// It places one kind of duck in the best nests and optionally upgrades.
import type { Challenge } from '../data/challenges';
import type { Difficulty } from '../data/difficulty';
import { DUCKS, type DuckKind } from '../data/ducks';
import type { LevelInfo } from '../data/levels';
import { buyDuck, canBuy, canUpgrade, createGame, isOver, mapFromLevel, startWave, update, upgradeDuck, useBlessing, type Game } from './game';
import { distance, type Point } from './geometry';
import { parseLevel } from './level';
import { makePath, pointAt } from './path';
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
}

/** Before each wave, spend peas on `kind` ducks in the best slots (and upgrades, per the strategy). */
export function play(info: LevelInfo, difficulty: Difficulty, kind: DuckKind | null, strategy: Strategy = {}): Game {
  const game = createGame(mapFromLevel(parseLevel(info.map)), info.waves, difficulty, strategy.challenge);
  const slots = bestSlots(info, kind ? DUCKS[kind].range : 0);
  const upgrades = strategy.upgrades ?? 'none';

  /** The cheapest upgrade you can afford right now, if any. */
  const cheapestUpgrade = () =>
    game.battle.ducks
      .filter((d) => canUpgrade(game, d.id))
      .sort((a, b) => nextUpgrade(a.kind, a.level)!.cost - nextUpgrade(b.kind, b.level)!.cost)[0];
  const anyUpgradeLeft = () => game.battle.ducks.some((d) => nextUpgrade(d.kind, d.level));

  while (!isOver(game)) {
    for (;;) {
      const canPlace = !!kind && slots.length > 0 && canBuy(game, kind);
      const upgrade = upgrades === 'none' ? undefined : cheapestUpgrade();
      if (upgrades === 'upgrade-first' && anyUpgradeLeft()) {
        // Save up for upgrades while any duck can still improve.
        if (upgrade) upgradeDuck(game, upgrade.id);
        else break;
      } else if (canPlace) {
        buyDuck(game, kind!, slots.shift()!);
      } else if (upgrade) {
        upgradeDuck(game, upgrade.id);
      } else {
        break;
      }
    }
    if (strategy.craig && game.waveIndex === game.waves.length - 1) useBlessing(game);
    startWave(game);
    for (let i = 0; i < 200_000 && game.phase === 'wave'; i++) update(game, 1 / 30);
  }
  return game;
}
