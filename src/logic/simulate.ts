// A simple computer player, used by the balance tests to check levels can be won (or lost).
// It places ducks (one kind, or a team taking turns) in the best nests and optionally upgrades.
import type { Challenge } from '../data/challenges';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import type { Enemy } from './battle';
import type { LevelInfo } from '../data/levels';
import {
  buyDuck,
  canBuy,
  canUpgrade,
  canUseBlessing,
  choosePerk,
  createGame,
  isOver,
  mapFromLevel,
  repairHouse,
  setTargeting,
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
import { canUsePower, usePower } from './powers';
import { nextUpgrade } from './upgrades';

/** The simulated player calls Craig when a predator is this close to the duck house. */
const CRAIG_CALL_DISTANCE = 200;
/** The 'smart' strategy upgrades its first few ducks (in the best nests) before filling more. */
const CORE_DUCKS = 3;

/** Slots sorted so the ones that can see the most of every predator route come first. */
export function bestSlots(info: LevelInfo, range: number): Point[] {
  const level = parseLevel(info.map);
  const house = level.path[level.path.length - 1]!;
  // The ground path, plus a hawk's line from each sky point.
  // Like a real player, care about the ground path first (most predators walk).
  const routes = [
    ...level.paths.map((trail) => ({ path: makePath(trail), weight: 2 })),
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
  /**
   * Call Craig once a predator is nearly at the duck house: during the last wave, or on any
   * wave when the hearts are nearly gone.
   */
  craig?: boolean;
  /**
   * How to spend spare peas on upgrades between waves:
   * - 'none': never upgrade
   * - 'place-first': fill every nest first, then upgrade (cheapest upgrade first)
   * - 'upgrade-first': max out the ducks you have before buying another
   * - 'smart': like a player who knows the game: a few ducks in the best nests, upgraded
   *   (best nest first) before weaker nests get a duck
   */
  upgrades?: 'none' | 'place-first' | 'upgrade-first' | 'smart';
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
  /** 'smart' only: how many ducks to place before upgrading comes first (default CORE_DUCKS). */
  core?: number;
  /** On a boss wave, aim every other duck at the strongest predator (default true). */
  bossAim?: boolean;
  /** Use every flock power the moment it's ready (a real player taps them; the balance tests don't). */
  powers?: boolean;
  /** Called after each wave, for watching how a game goes while tuning a level. */
  trace?: (game: Game) => void;
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
  /** The next duck on the team to place: taking turns, except that the 'smart' player picks a
   *  duck that can hit flyers when the coming wave has them and nobody out can. */
  const nextKind = () => {
    const turn = team[placed % team.length];
    if (strategy.upgrades !== 'smart' || isOver(game)) return turn;
    const wave = game.waves[game.waveIndex];
    const flyersComing = wave?.groups.some((g) => ENEMIES[g.enemy].flying) ?? false;
    const hitters = game.battle.ducks.filter((d) => DUCKS[d.kind].canHitFlying).length;
    const hitter = team.find((kind) => DUCKS[kind].canHitFlying);
    return flyersComing && hitters < 2 && hitter ? hitter : turn;
  };
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
  /** The earliest-placed duck (so the one in the best nest) with an upgrade you can afford, if any. */
  const bestNestUpgrade = () => game.battle.ducks.find((d) => canUpgrade(game, d.id, path));

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
      if (upgrades === 'smart') {
        const core = bestNestUpgrade();
        if (placed < (strategy.core ?? CORE_DUCKS) && canPlace) buyDuck(game, kind!, slots.shift()!), placed++;
        else if (core) upgradeDuck(game, core.id, path);
        else if (canPlace) buyDuck(game, kind!, slots.shift()!), placed++;
        else break;
      } else if (upgrades === 'upgrade-first' && anyUpgradeLeft()) {
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
    const lastWave = game.waveIndex === game.waves.length - 1;
    // If a boss is coming, Craig's shield is saved for it, and every other duck aims at the
    // strongest predator (like a player would): some peck the boss, the rest keep its minions off.
    const bossComing = game.waves[game.waveIndex]!.groups.some((g) => ENEMIES[g.enemy].boss);
    // A boss still to come later in the level: Craig's one shield is kept for it.
    const bossLater = game.waves.slice(game.waveIndex + 1).some((w) => w.groups.some((g) => ENEMIES[g.enemy].boss));
    const aim = strategy.bossAim ?? true;
    game.battle.ducks.forEach((duck, i) => setTargeting(game, duck.id, aim && bossComing && i % 2 === 0 ? 'strong' : 'first'));
    startWave(game);
    const dt = strategy.step ?? 1 / 30;
    for (let i = 0; i < 200_000 && game.phase === 'wave'; i++) {
      if (strategy.powers) for (const kind of DUCK_ORDER) if (canUsePower(game, kind)) usePower(game, kind);
      // Like a player watching the door: call Craig when something (the boss, if there is one) is
      // nearly in, on the last wave, or on any wave once the hearts are nearly gone.
      const atTheDoor = (e: Enemy) => e.path.length - e.distance < CRAIG_CALL_DISTANCE && (!bossComing || !!ENEMIES[e.kind].boss);
      const desperate = game.hearts <= Math.max(2, Math.ceil(game.maxHearts / 4)) && !bossLater;
      if (strategy.craig && (lastWave || desperate) && canUseBlessing(game) && game.battle.enemies.some(atTheDoor)) useBlessing(game);
      update(game, dt);
    }
    strategy.trace?.(game);
  }
  return game;
}
