import { DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { distance, type Point } from './geometry';
import { pointAt, type Path } from './path';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Pixels per second, after the difficulty's speed multiplier. */
  speed: number;
  /** How far along the path it has walked, in pixels. */
  distance: number;
  /** Seconds it stays frozen (stunned or held) before walking again. */
  stopTime: number;
  /** Ducks that have already held this predator, so each only holds it once. */
  heldBy: number[];
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
}

export interface Battle {
  path: Path;
  enemies: Enemy[];
  ducks: Duck[];
  nextId: number;
  /** Multiplies every predator's speed (from the difficulty). */
  enemySpeed: number;
}

/** Things that happened during a step, so the scene can animate them. */
export type BattleEvent =
  | { type: 'attack'; duckId: number; target: Point; hitIds: number[]; wingFlap: boolean }
  | { type: 'alarmQuack'; duckId: number; stunnedIds: number[] }
  | { type: 'held'; duckId: number; enemyId: number }
  | { type: 'defeated'; enemy: Enemy; position: Point }
  | { type: 'reachedHouse'; enemy: Enemy };

export function createBattle(path: Path, enemySpeed = 1): Battle {
  return { path, enemies: [], ducks: [], nextId: 1, enemySpeed };
}

export function spawnEnemy(battle: Battle, kind: EnemyKind): Enemy {
  const stats = ENEMIES[kind];
  const enemy: Enemy = {
    id: battle.nextId++,
    kind,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    speed: stats.speed * battle.enemySpeed,
    distance: 0,
    stopTime: 0,
    heldBy: [],
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
  };
  battle.ducks.push(duck);
  return duck;
}

export function enemyPosition(battle: Battle, enemy: Enemy): Point {
  return pointAt(battle.path, enemy.distance);
}

function enemiesInRange(battle: Battle, from: Point, range: number): Enemy[] {
  return battle.enemies.filter((e) => e.hp > 0 && distance(enemyPosition(battle, e), from) <= range);
}

/** The predator in range that is closest to the house, if any. */
export function pickTarget(battle: Battle, from: Point, range: number): Enemy | undefined {
  let best: Enemy | undefined;
  for (const enemy of enemiesInRange(battle, from, range)) {
    if (!best || enemy.distance > best.distance) best = enemy;
  }
  return best;
}

/** Advances the battle by `dt` seconds. */
export function step(battle: Battle, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];

  // 1. Predators walk toward the house, unless something has frozen them.
  for (const enemy of battle.enemies) {
    if (enemy.stopTime > 0) {
      enemy.stopTime = Math.max(0, enemy.stopTime - dt);
    } else {
      enemy.distance += enemy.speed * dt;
    }
    if (enemy.distance >= battle.path.length) {
      events.push({ type: 'reachedHouse', enemy });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.distance < battle.path.length);

  // 2. Special abilities.
  for (const duck of battle.ducks) {
    duck.abilityCooldown = Math.max(0, duck.abilityCooldown - dt);
    if (duck.abilityCooldown > 0) continue;
    const stats = DUCKS[duck.kind];

    // Chester's Alarm Quack: freeze every predator in range.
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

    // Curtis holds the line: stop the next predator that walks up, once each.
    if (stats.holdTheLine) {
      const target = enemiesInRange(battle, duck.position, stats.range)
        .filter((e) => !e.heldBy.includes(duck.id))
        .sort((a, b) => b.distance - a.distance)[0];
      if (target) {
        target.stopTime = Math.max(target.stopTime, stats.holdTheLine.holdTime);
        target.heldBy.push(duck.id);
        duck.abilityCooldown = stats.holdTheLine.holdTime;
        events.push({ type: 'held', duckId: duck.id, enemyId: target.id });
      }
    }
  }

  // 3. Ducks that are ready attack the predator closest to the house.
  for (const duck of battle.ducks) {
    duck.cooldown = Math.max(0, duck.cooldown - dt);
    if (duck.cooldown > 0) continue;

    const stats = DUCKS[duck.kind];
    const target = pickTarget(battle, duck.position, stats.range);
    if (!target) continue;

    const targetPos = enemyPosition(battle, target);
    const hit = battle.enemies.filter(
      (e) =>
        e.hp > 0 &&
        (e === target || distance(enemyPosition(battle, e), targetPos) <= stats.splashRadius),
    );
    for (const enemy of hit) enemy.hp -= stats.damage;
    duck.cooldown = stats.attackInterval;
    duck.attacks++;

    // Potato's Wing Flap: every Nth hit knocks the target back along the path.
    const wingFlap = !!stats.wingFlap && duck.attacks % stats.wingFlap.everyNthAttack === 0;
    if (wingFlap && stats.wingFlap) {
      target.distance = Math.max(0, target.distance - stats.wingFlap.pushBack);
    }

    events.push({ type: 'attack', duckId: duck.id, target: targetPos, hitIds: hit.map((e) => e.id), wingFlap });
  }

  // 4. Predators out of health run away.
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0) {
      events.push({ type: 'defeated', enemy, position: enemyPosition(battle, enemy) });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.hp > 0);

  return events;
}
