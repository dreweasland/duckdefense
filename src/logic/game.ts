import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import type { Wave } from '../data/waves';
import { createBattle, placeDuck, spawnEnemy, step, type Battle, type BattleEvent, type Duck, type Enemy } from './battle';
import type { Point } from './geometry';
import type { Path } from './path';

/**
 * building: between waves, placing ducks
 * wave:     predators are coming
 * won/lost: the level is over
 */
export type GamePhase = 'building' | 'wave' | 'won' | 'lost';

export interface ScheduledSpawn {
  time: number; // seconds after the wave starts
  enemy: EnemyKind;
}

export interface Game {
  battle: Battle;
  waves: readonly Wave[];
  peas: number;
  hearts: number;
  /** The wave being fought, or the next one while building (0-based). */
  waveIndex: number;
  phase: GamePhase;
  /** Seconds since the current wave started. */
  waveTime: number;
  /** This wave's predators that haven't appeared yet, soonest first. */
  pending: ScheduledSpawn[];
}

export type GameEvent =
  | BattleEvent
  | { type: 'spawned'; enemy: Enemy }
  | { type: 'waveCleared'; waveIndex: number; bonus: number }
  | { type: 'won' }
  | { type: 'lost' };

export function createGame(path: Path, waves: readonly Wave[], difficulty: Difficulty): Game {
  if (waves.length === 0) {
    throw new Error('A level needs at least one wave');
  }
  const settings = DIFFICULTIES[difficulty];
  return {
    battle: createBattle(path, settings.enemySpeed),
    waves,
    peas: settings.startingPeas,
    hearts: settings.hearts,
    waveIndex: 0,
    phase: 'building',
    waveTime: 0,
    pending: [],
  };
}

export function isOver(game: Game): boolean {
  return game.phase === 'won' || game.phase === 'lost';
}

export function canBuy(game: Game, kind: DuckKind): boolean {
  return !isOver(game) && game.peas >= DUCKS[kind].cost;
}

/** Spends peas to place a duck. Returns undefined if you can't afford it. */
export function buyDuck(game: Game, kind: DuckKind, at: Point): Duck | undefined {
  if (!canBuy(game, kind)) return undefined;
  game.peas -= DUCKS[kind].cost;
  return placeDuck(game.battle, kind, at);
}

/** Lists every predator in a wave with the time it appears, soonest first. */
export function scheduleWave(wave: Wave): ScheduledSpawn[] {
  const spawns: ScheduledSpawn[] = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      spawns.push({ time: (group.after ?? 0) + i * group.every, enemy: group.enemy });
    }
  }
  return spawns.sort((a, b) => a.time - b.time);
}

/** Sends the next wave. Only works between waves. */
export function startWave(game: Game): boolean {
  if (game.phase !== 'building') return false;
  game.phase = 'wave';
  game.waveTime = 0;
  game.pending = scheduleWave(game.waves[game.waveIndex]!);
  return true;
}

/** Advances the game by `dt` seconds. Nothing moves between waves. */
export function update(game: Game, dt: number): GameEvent[] {
  if (game.phase !== 'wave') return [];
  const events: GameEvent[] = [];

  game.waveTime += dt;
  while (game.pending.length > 0 && game.pending[0]!.time <= game.waveTime) {
    const spawn = game.pending.shift()!;
    events.push({ type: 'spawned', enemy: spawnEnemy(game.battle, spawn.enemy) });
  }

  for (const event of step(game.battle, dt)) {
    events.push(event);
    if (event.type === 'defeated') game.peas += ENEMIES[event.enemy.kind].peas;
    if (event.type === 'reachedHouse') game.hearts = Math.max(0, game.hearts - 1);
  }

  if (game.hearts === 0) {
    game.phase = 'lost';
    events.push({ type: 'lost' });
    return events;
  }

  if (game.pending.length === 0 && game.battle.enemies.length === 0) {
    const bonus = game.waves[game.waveIndex]!.bonusPeas;
    game.peas += bonus;
    events.push({ type: 'waveCleared', waveIndex: game.waveIndex, bonus });
    game.waveIndex++;
    if (game.waveIndex >= game.waves.length) {
      game.phase = 'won';
      events.push({ type: 'won' });
    } else {
      game.phase = 'building';
    }
  }

  return events;
}
