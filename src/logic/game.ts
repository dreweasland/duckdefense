import { CRAIG } from '../data/craig';
import { BATTERY, FOUNTAIN } from '../data/dayNight';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { DUCKS, MOVE_SETTLE_TIME, SELL_REFUND, type DuckKind } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import type { Wave } from '../data/waves';
import { createBattle, placeDuck, spawnEnemy, step, type Battle, type BattleEvent, type Duck, type Enemy } from './battle';
import { distance, type Point } from './geometry';
import { nextUpgrade, totalSpent } from './upgrades';
import type { Level } from './level';
import { makePath, type Path } from './path';

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
  /** Solar battery charge, 0 to BATTERY.capacity. Powers the fountain. */
  battery: number;
  /** Craig's Guardian Blessing can be used once per level. */
  blessingUsed: boolean;
  /** Seconds of Craig's shield left (only counts down during waves). */
  shieldTime: number;
}

/** What the game needs from a level. */
export interface GameMap {
  path: Path;
  sky?: Point[];
  /** Where the solar fountain is (leave out for no fountain). */
  fountainAt?: Point;
  /** Where predators from the pond climb out (leave out for no pond). */
  pondAt?: Point;
}

/** The fountain sits in the middle of the level's first pond, and turtles climb out of it. */
export function mapFromLevel(level: Level): GameMap {
  const pond = level.ponds[0]?.center;
  return { path: makePath(level.path), sky: level.sky, fountainAt: pond, pondAt: pond };
}

export type GameEvent =
  | BattleEvent
  | { type: 'spawned'; enemy: Enemy }
  | { type: 'shooed'; enemy: Enemy }
  | { type: 'waveCleared'; waveIndex: number; bonus: number }
  | { type: 'won' }
  | { type: 'lost' };

export function createGame(map: GameMap, waves: readonly Wave[], difficulty: Difficulty): Game {
  if (waves.length === 0) {
    throw new Error('A level needs at least one wave');
  }
  const settings = DIFFICULTIES[difficulty];
  return {
    battle: createBattle(map.path, { sky: map.sky, fountainAt: map.fountainAt, pondAt: map.pondAt, enemySpeed: settings.enemySpeed }),
    waves,
    peas: settings.startingPeas,
    hearts: settings.hearts,
    waveIndex: 0,
    phase: 'building',
    waveTime: 0,
    pending: [],
    battery: BATTERY.startCharge,
    blessingUsed: false,
    shieldTime: 0,
  };
}

/** Day or night for the wave being fought, or the next one while building. */
export function isNight(game: Game): boolean {
  const wave = game.waves[Math.min(game.waveIndex, game.waves.length - 1)]!;
  return wave.time === 'night';
}

export function canUseBlessing(game: Game): boolean {
  return !game.blessingUsed && !isOver(game);
}

/** Craig's Guardian Blessing: shield the duck house. Once per level. */
export function useBlessing(game: Game): boolean {
  if (!canUseBlessing(game)) return false;
  game.blessingUsed = true;
  game.shieldTime = CRAIG.shieldTime;
  return true;
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

/** Peas you'd get back for selling a duck: part of everything spent on it, upgrades included. */
export function sellValue(kind: DuckKind, level = 0): number {
  return Math.floor(totalSpent(kind, level) * SELL_REFUND);
}

/** Whether a duck can be upgraded right now (not maxed out, and you have the peas). */
export function canUpgrade(game: Game, duckId: number): boolean {
  const duck = game.battle.ducks.find((d) => d.id === duckId);
  const upgrade = duck && nextUpgrade(duck.kind, duck.level);
  return !isOver(game) && !!upgrade && game.peas >= upgrade.cost;
}

/** Buys a duck's next upgrade. Returns false if it's maxed out or you can't afford it. */
export function upgradeDuck(game: Game, duckId: number): boolean {
  if (!canUpgrade(game, duckId)) return false;
  const duck = game.battle.ducks.find((d) => d.id === duckId)!;
  game.peas -= nextUpgrade(duck.kind, duck.level)!.cost;
  duck.level++;
  return true;
}

/** Sells a duck for part of its cost. Returns the peas refunded, or undefined if it can't be sold. */
export function sellDuck(game: Game, duckId: number): number | undefined {
  if (isOver(game)) return undefined;
  const duck = game.battle.ducks.find((d) => d.id === duckId);
  if (!duck) return undefined;
  game.battle.ducks = game.battle.ducks.filter((d) => d !== duck);
  const refund = sellValue(duck.kind, duck.level);
  game.peas += refund;
  return refund;
}

export function isSpotTaken(game: Game, at: Point): boolean {
  return game.battle.ducks.some((d) => distance(d.position, at) < 1);
}

/** Moves a duck to an empty spot. It needs a moment to settle before it attacks again. */
export function moveDuck(game: Game, duckId: number, to: Point): boolean {
  if (isOver(game) || isSpotTaken(game, to)) return false;
  const duck = game.battle.ducks.find((d) => d.id === duckId);
  if (!duck) return false;
  duck.position = { ...to };
  duck.cooldown = Math.max(duck.cooldown, MOVE_SETTLE_TIME);
  duck.abilityCooldown = Math.max(duck.abilityCooldown, MOVE_SETTLE_TIME);
  return true;
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
  game.battle.night = isNight(game);
  return true;
}

/** Advances the game by `dt` seconds. Nothing moves between waves. */
export function update(game: Game, dt: number): GameEvent[] {
  if (game.phase !== 'wave') return [];
  const events: GameEvent[] = [];

  game.waveTime += dt;
  updateBattery(game, dt);
  game.shieldTime = Math.max(0, game.shieldTime - dt);
  while (game.pending.length > 0 && game.pending[0]!.time <= game.waveTime) {
    const spawn = game.pending.shift()!;
    events.push({ type: 'spawned', enemy: spawnEnemy(game.battle, spawn.enemy) });
  }

  const shielded = game.shieldTime > 0;
  for (const event of step(game.battle, dt)) {
    if (event.type === 'reachedHouse' && shielded) {
      // Craig shoos it away: no heart lost (and no peas either).
      events.push({ type: 'shooed', enemy: event.enemy });
      continue;
    }
    events.push(event);
    if (event.type === 'defeated') game.peas += ENEMIES[event.enemy.kind].peas;
    if (event.type === 'reachedHouse') game.hearts = Math.max(0, game.hearts - ENEMIES[event.enemy.kind].hearts);
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

/** The sun charges the battery in day waves; the fountain runs off it whenever it has charge. */
function updateBattery(game: Game, dt: number): void {
  if (!isNight(game)) game.battery += BATTERY.solarPerSecond * dt;
  const fountain = game.battle.fountain;
  if (fountain) {
    fountain.on = game.battery > 0;
    if (fountain.on) game.battery -= FOUNTAIN.drawPerSecond * dt;
  }
  game.battery = Math.min(BATTERY.capacity, Math.max(0, game.battery));
}
