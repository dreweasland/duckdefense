import { FOUNTAIN, NIGHT } from '../data/dayNight';
import type { DuckKind } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { CHASES, PECKING_LOOP } from '../data/synergy';
import { distance, type Point } from './geometry';
import { makePath, pointAt, type Path } from './path';
import { statsAt } from './upgrades';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Pixels per second, after difficulty and night multipliers. */
  speed: number;
  /** The route it follows: the ground path, or a straight line from the sky for flyers. */
  path: Path;
  /** How far along its path it has walked (or flown), in pixels. */
  distance: number;
  /** Seconds it stays frozen (stunned or held) before moving again. */
  stopTime: number;
  /** Ducks that have already held this predator, so each only holds it once. */
  heldBy: number[];
  /** True while the fountain is slowing it (for drawing). */
  slowed: boolean;
  /** Seconds until it next calls for minions (only for predators that summon). */
  summonTime: number;
}

export interface Duck {
  id: number;
  kind: DuckKind;
  position: Point;
  /** Seconds until this duck can attack again. */
  cooldown: number;
  /** Seconds until this duck's special ability is ready again. */
  abilityCooldown: number;
  /** Attacks made so far, for "every Nth attack" abilities. */
  attacks: number;
  /** Upgrades bought: 0, 1, or 2. */
  level: number;
}

export interface Fountain {
  position: Point;
  /** Whether the fountain has power right now (the game sets this from the battery). */
  on: boolean;
}

export interface Battle {
  /** The ground path, ending at the duck house. */
  path: Path;
  /** Where flyers enter; they take turns. */
  sky: Point[];
  enemies: Enemy[];
  ducks: Duck[];
  fountain?: Fountain;
  nextId: number;
  flyersSpawned: number;
  /** Multiplies every predator's speed (from the difficulty). */
  enemySpeed: number;
  /** Predators that arrive while this is true move faster. */
  night: boolean;
}

/** Things that happened during a step, so the scene can animate them. */
export type BattleEvent =
  | { type: 'attack'; duckId: number; target: Point; hitIds: number[]; wingFlap: boolean }
  | { type: 'alarmQuack'; duckId: number; stunnedIds: number[] }
  | { type: 'held'; duckId: number; enemyId: number }
  | { type: 'summoned'; enemyId: number; minions: Enemy[] }
  | { type: 'defeated'; enemy: Enemy; position: Point }
  | { type: 'reachedHouse'; enemy: Enemy };

export interface BattleOptions {
  sky?: Point[];
  fountainAt?: Point;
  enemySpeed?: number;
}

export function createBattle(path: Path, options: BattleOptions = {}): Battle {
  return {
    path,
    sky: options.sky ?? [],
    enemies: [],
    ducks: [],
    fountain: options.fountainAt ? { position: options.fountainAt, on: false } : undefined,
    nextId: 1,
    flyersSpawned: 0,
    enemySpeed: options.enemySpeed ?? 1,
    night: false,
  };
}

export function housePosition(battle: Battle): Point {
  return battle.path.points[battle.path.points.length - 1]!;
}

export function spawnEnemy(battle: Battle, kind: EnemyKind): Enemy {
  const stats = ENEMIES[kind];
  let path = battle.path;
  if (stats.flying) {
    const from = battle.sky[battle.flyersSpawned % Math.max(1, battle.sky.length)];
    if (!from) {
      throw new Error(`A ${stats.name} needs somewhere to fly in from: add a "sky" layer with points to the map`);
    }
    battle.flyersSpawned++;
    path = makePath([from, housePosition(battle)]);
  }
  const enemy: Enemy = {
    id: battle.nextId++,
    kind,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    speed: stats.speed * battle.enemySpeed * (battle.night ? NIGHT.enemySpeed : 1),
    path,
    distance: 0,
    stopTime: 0,
    heldBy: [],
    slowed: false,
    summonTime: stats.summons?.every ?? 0,
  };
  battle.enemies.push(enemy);
  return enemy;
}

export function placeDuck(battle: Battle, kind: DuckKind, position: Point): Duck {
  const duck: Duck = {
    id: battle.nextId++,
    kind,
    position: { ...position },
    cooldown: 0,
    abilityCooldown: 0,
    attacks: 0,
    level: 0,
  };
  battle.ducks.push(duck);
  return duck;
}

export function enemyPosition(enemy: Enemy): Point {
  return pointAt(enemy.path, enemy.distance);
}

export function isFlying(enemy: Enemy): boolean {
  return ENEMIES[enemy.kind].flying;
}

function enemiesInRange(battle: Battle, from: Point, range: number): Enemy[] {
  return battle.enemies.filter((e) => e.hp > 0 && distance(enemyPosition(e), from) <= range);
}

/** The predator in range that is closest to the house, if any. */
export function pickTarget(battle: Battle, from: Point, range: number, canHitFlying = true): Enemy | undefined {
  let best: Enemy | undefined;
  for (const enemy of enemiesInRange(battle, from, range)) {
    if (!canHitFlying && isFlying(enemy)) continue;
    if (!best || remaining(enemy) < remaining(best)) best = enemy;
  }
  return best;
}

/** Pixels left before a predator reaches the house. */
function remaining(enemy: Enemy): number {
  return enemy.path.length - enemy.distance;
}

/**
 * The Pecking Loop: the nearby duck this duck chases, if there is one.
 * A duck with a chase partner attacks faster.
 */
export function chasePartner(battle: Battle, duck: Duck): Duck | undefined {
  const chases = CHASES[duck.kind];
  if (!chases) return undefined;
  return battle.ducks.find(
    (other) =>
      other !== duck &&
      other.kind === chases &&
      distance(other.position, duck.position) <= PECKING_LOOP.nearDistance,
  );
}

export function attackInterval(battle: Battle, duck: Duck): number {
  const base = statsAt(duck.kind, duck.level).attackInterval;
  return chasePartner(battle, duck) ? base / (1 + PECKING_LOOP.attackSpeedBonus) : base;
}

function inFountainSpray(battle: Battle, enemy: Enemy): boolean {
  const { fountain } = battle;
  return (
    !!fountain?.on &&
    !isFlying(enemy) && // the spray doesn't reach hawks up in the air
    distance(enemyPosition(enemy), fountain.position) <= FOUNTAIN.range
  );
}

/** Advances the battle by `dt` seconds. */
export function step(battle: Battle, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];

  // 1. Predators head for the house, unless something has frozen them.
  for (const enemy of battle.enemies) {
    enemy.slowed = inFountainSpray(battle, enemy);
    if (enemy.stopTime > 0) {
      enemy.stopTime = Math.max(0, enemy.stopTime - dt);
    } else {
      enemy.distance += enemy.speed * (enemy.slowed ? FOUNTAIN.slow : 1) * dt;
    }
    if (enemy.distance >= enemy.path.length) {
      events.push({ type: 'reachedHouse', enemy });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.distance < e.path.length);

  // 2. Bosses call for minions, which appear just behind them (not while stunned).
  for (const enemy of [...battle.enemies]) {
    const summons = ENEMIES[enemy.kind].summons;
    if (!summons || enemy.stopTime > 0) continue;
    enemy.summonTime -= dt;
    if (enemy.summonTime > 0) continue;
    enemy.summonTime = summons.every;
    const minions: Enemy[] = [];
    for (let i = 0; i < summons.count; i++) {
      const minion = spawnEnemy(battle, summons.enemy);
      if (!isFlying(minion)) minion.distance = Math.max(0, enemy.distance - 50 - i * 40);
      minions.push(minion);
    }
    events.push({ type: 'summoned', enemyId: enemy.id, minions });
  }

  // 3. Special abilities.
  for (const duck of battle.ducks) {
    duck.abilityCooldown = Math.max(0, duck.abilityCooldown - dt);
    if (duck.abilityCooldown > 0) continue;
    const stats = statsAt(duck.kind, duck.level);

    // Chester's Alarm Quack: freeze every predator in range, hawks included.
    if (stats.alarmQuack) {
      const inRange = enemiesInRange(battle, duck.position, stats.range);
      if (inRange.length > 0) {
        for (const enemy of inRange) {
          enemy.stopTime = Math.max(enemy.stopTime, stats.alarmQuack.stunTime);
        }
        duck.abilityCooldown = stats.alarmQuack.cooldown;
        events.push({ type: 'alarmQuack', duckId: duck.id, stunnedIds: inRange.map((e) => e.id) });
      }
    }

    // Curtis holds the line: stop the next ground predator that walks up, once each.
    if (stats.holdTheLine) {
      const target = enemiesInRange(battle, duck.position, stats.range)
        .filter((e) => !isFlying(e) && !ENEMIES[e.kind].tooBigToHold && !e.heldBy.includes(duck.id))
        .sort((a, b) => remaining(a) - remaining(b))[0];
      if (target) {
        target.stopTime = Math.max(target.stopTime, stats.holdTheLine.holdTime);
        target.heldBy.push(duck.id);
        duck.abilityCooldown = stats.holdTheLine.holdTime;
        events.push({ type: 'held', duckId: duck.id, enemyId: target.id });
      }
    }
  }

  // 4. Ducks that are ready attack the predator closest to the house.
  for (const duck of battle.ducks) {
    duck.cooldown = Math.max(0, duck.cooldown - dt);
    if (duck.cooldown > 0) continue;

    const stats = statsAt(duck.kind, duck.level);
    const target = pickTarget(battle, duck.position, stats.range, stats.canHitFlying);
    if (!target) continue;

    const targetPos = enemyPosition(target);
    const hit = battle.enemies.filter(
      (e) =>
        e.hp > 0 &&
        (e === target ||
          ((stats.canHitFlying || !isFlying(e)) && distance(enemyPosition(e), targetPos) <= stats.splashRadius)),
    );
    for (const enemy of hit) enemy.hp -= stats.damage;
    duck.cooldown = attackInterval(battle, duck);
    duck.attacks++;

    // Potato's Wing Flap: every Nth hit knocks the target back.
    const wingFlap = !!stats.wingFlap && duck.attacks % stats.wingFlap.everyNthAttack === 0;
    if (wingFlap && stats.wingFlap) {
      target.distance = Math.max(0, target.distance - stats.wingFlap.pushBack);
    }

    events.push({ type: 'attack', duckId: duck.id, target: targetPos, hitIds: hit.map((e) => e.id), wingFlap });
  }

  // 5. Predators out of health run away.
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0) {
      events.push({ type: 'defeated', enemy, position: enemyPosition(enemy) });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.hp > 0);

  return events;
}
