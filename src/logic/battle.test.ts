import { describe, expect, it } from 'vitest';
import { DUCKS } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import { createBattle, placeDuck, spawnEnemy, step, type BattleEvent } from './battle';
import { makePath } from './path';

const sunny = DUCKS.sunny;
const raccoon = ENEMIES.raccoon;

// A straight path along y = 0, from x = 0 to x = 2000.
function newBattle() {
  return createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]));
}

describe('battle', () => {
  it('moves predators along the path at their speed', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    step(battle, 2);
    expect(enemy.distance).toBe(raccoon.speed * 2);
  });

  it('removes a predator when it reaches the house', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1999;
    const events = step(battle, 1);
    expect(events).toContainEqual({ type: 'reachedHouse', enemy });
    expect(battle.enemies).toHaveLength(0);
  });

  it('hits a predator in range', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    placeDuck(battle, 'sunny', { x: 0, y: sunny.range - 10 });
    step(battle, 0);
    expect(enemy.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it('ignores a predator out of range', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    placeDuck(battle, 'sunny', { x: 0, y: sunny.range + 10 });
    step(battle, 0);
    expect(enemy.hp).toBe(raccoon.maxHp);
  });

  it('waits for its cooldown between attacks', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    placeDuck(battle, 'sunny', { x: 0, y: 0 });
    step(battle, 0);
    step(battle, sunny.attackInterval / 2);
    expect(enemy.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it('targets the predator closest to the house', () => {
    const battle = newBattle();
    const behind = spawnEnemy(battle, 'raccoon');
    const ahead = spawnEnemy(battle, 'raccoon');
    behind.distance = 100;
    ahead.distance = 100 + sunny.splashRadius + 10; // too far apart to share a splash
    placeDuck(battle, 'sunny', { x: 110, y: 0 });
    step(battle, 0);
    expect(ahead.hp).toBe(raccoon.maxHp - sunny.damage);
    expect(behind.hp).toBe(raccoon.maxHp);
  });

  it('splashes predators right next to the target', () => {
    const battle = newBattle();
    const target = spawnEnemy(battle, 'raccoon');
    const neighbor = spawnEnemy(battle, 'raccoon');
    target.distance = 100;
    neighbor.distance = 100 - sunny.splashRadius / 2;
    placeDuck(battle, 'sunny', { x: 100, y: 0 });
    step(battle, 0);
    expect(neighbor.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it('chases off a predator once its health runs out', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    const duck = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    const events: BattleEvent[] = [];
    // Freeze time and let Sunny attack every step, so the raccoon can't walk out of range.
    for (let i = 0; i < 100 && battle.enemies.length > 0; i++) {
      duck.cooldown = 0;
      events.push(...step(battle, 0));
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'defeated', enemy }));
    expect(battle.enemies).toHaveLength(0);
  });
});
