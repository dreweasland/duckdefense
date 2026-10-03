import { DUCK_ORDER, type DuckKind } from '../data/ducks';
import { POWERS } from '../data/powers';
import { flapStorm, holdTheLine, megaQuack, tidalWave, type PowerResult } from './battle';
import type { Game } from './game';

// Flock powers: when each can be used, and using one. The numbers live in src/data/powers.ts.

export type PowerState = 'ready' | 'resting' | 'noDuck' | 'notNow';

/** Why a power can't be used right now, or 'ready'. */
export function powerState(game: Game, kind: DuckKind): PowerState {
  if (!game.battle.ducks.some((d) => d.kind === kind)) return 'noDuck';
  if ((game.powers[kind] ?? 0) > 0) return 'resting';
  if (game.phase !== 'wave') return 'notNow';
  return 'ready';
}

export function canUsePower(game: Game, kind: DuckKind): boolean {
  return powerState(game, kind) === 'ready';
}

/** Seconds until the power is ready again (0 when it is). */
export function powerCooldown(game: Game, kind: DuckKind): number {
  return game.powers[kind] ?? 0;
}

/** Uses a kind's power, if it's ready: every duck of that kind does its big move. */
export function usePower(game: Game, kind: DuckKind): PowerResult | undefined {
  if (!canUsePower(game, kind)) return undefined;
  const result = POWER_MOVES[kind](game);
  game.powers[kind] = POWERS[kind].cooldown;
  return result;
}

const POWER_MOVES: Record<DuckKind, (game: Game) => PowerResult> = {
  sunny: (game) => tidalWave(game.battle),
  potato: (game) => flapStorm(game.battle),
  chester: (game) => megaQuack(game.battle),
  curtis: (game) => holdTheLine(game.battle),
};

/** Powers rest while a wave is on (the game calls this each tick during one). */
export function restPowers(game: Game, dt: number): void {
  for (const kind of DUCK_ORDER) {
    const left = game.powers[kind];
    if (left) game.powers[kind] = Math.max(0, left - dt);
  }
}
