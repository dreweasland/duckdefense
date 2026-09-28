import { DUCKS, type DuckKind } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { distance, type Point } from './geometry';
import { pointAt, type Path } from './path';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  /** How far along the path it has walked, in pixels. */
  distance: number;
}

export interface Duck {
  id: number;
  kind: DuckKind;
  position: Point;
  /** Seconds until this duck can attack again. */
  cooldown: number;
}

export interface Battle {
  path: Path;
  enemies: Enemy[];
  ducks: Duck[];
  nextId: number;
}

/** Things that happened during a step, so the scene can animate them. */
export type BattleEvent =
  | { type: 'attack'; duckId: number; target: Point; hitIds: number[] }
  | { type: 'defeated'; enemy: Enemy; position: Point }
  | { type: 'reachedHouse'; enemy: Enemy };

export function createBattle(path: Path): Battle {
  return { path, enemies: [], ducks: [], nextId: 1 };
}

export function spawnEnemy(battle: Battle, kind: EnemyKind): Enemy {
  const enemy = { id: battle.nextId++, kind, hp: ENEMIES[kind].maxHp, distance: 0 };
  battle.enemies.push(enemy);
  return enemy;
}

export function placeDuck(battle: Battle, kind: DuckKind, position: Point): Duck {
  const duck = { id: battle.nextId++, kind, position: { ...position }, cooldown: 0 };
  battle.ducks.push(duck);
  return duck;
}

export function enemyPosition(battle: Battle, enemy: Enemy): Point {
  return pointAt(battle.path, enemy.distance);
}

/** The predator in range that is closest to the house, if any. */
export function pickTarget(battle: Battle, from: Point, range: number): Enemy | undefined {
  let best: Enemy | undefined;
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0 || distance(enemyPosition(battle, enemy), from) > range) continue;
    if (!best || enemy.distance > best.distance) best = enemy;
  }
  return best;
}

/** Advances the battle by `dt` seconds. */
export function step(battle: Battle, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];

  // 1. Predators walk toward the house.
  for (const enemy of battle.enemies) {
    enemy.distance += ENEMIES[enemy.kind].speed * dt;
    if (enemy.distance >= battle.path.length) {
      events.push({ type: 'reachedHouse', enemy });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.distance < battle.path.length);

  // 2. Ducks that are ready attack the predator closest to the house.
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
    events.push({ type: 'attack', duckId: duck.id, target: targetPos, hitIds: hit.map((e) => e.id) });
  }

  // 3. Predators out of health run away.
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0) {
      events.push({ type: 'defeated', enemy, position: enemyPosition(battle, enemy) });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.hp > 0);

  return events;
}
