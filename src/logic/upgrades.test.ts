import { describe, expect, it } from 'vitest';
import { DUCK_ORDER, DUCKS, SELL_REFUND } from '../data/ducks';
import type { Wave } from '../data/waves';
import { createBattle, placeDuck, spawnEnemy, step } from './battle';
import { buyDuck, canUpgrade, createGame, sellDuck, sellValue, startWave, upgradeDuck } from './game';
import { makePath } from './path';
import { MAX_UPGRADE_LEVEL, nameAt, nextUpgrade, statsAt, totalSpent, upgradeOptions } from './upgrades';

describe('upgrade stats', () => {
  it('starts from the base stats', () => {
    expect(statsAt('sunny', 0)).toEqual(DUCKS.sunny);
  });

  it('layers each upgrade on in order', () => {
    const tier1 = DUCKS.sunny.upgrades[0].changes;
    const tier2 = DUCKS.sunny.upgrades[1].changes;
    expect(statsAt('sunny', 1)).toMatchObject(tier1);
    expect(statsAt('sunny', 2)).toMatchObject({ ...tier1, ...tier2 });
  });

  it('only changes the ability fields an upgrade lists', () => {
    // Loud Chester changes the stun time but keeps the cooldown.
    const loud = statsAt('chester', 1).alarmQuack!;
    expect(loud.cooldown).toBe(DUCKS.chester.alarmQuack!.cooldown);
    expect(loud.stunTime).toBe(DUCKS.chester.upgrades[0].changes.alarmQuack!.stunTime);
  });

  it('names the duck after its upgrade', () => {
    expect(nameAt('sunny', 0)).toBe('Sunny');
    expect(nameAt('sunny', 1)).toBe(DUCKS.sunny.upgrades[0].name);
  });

  it('has two upgrades then a choice of two final paths per duck, each actually better', () => {
    for (const kind of DUCK_ORDER) {
      expect(nextUpgrade(kind, MAX_UPGRADE_LEVEL)).toBeUndefined();
      expect(upgradeOptions(kind, 2)).toHaveLength(2);
      for (const path of [0, 1]) {
        for (let level = 1; level <= MAX_UPGRADE_LEVEL; level++) {
          expect(JSON.stringify(statsAt(kind, level, path)), `${kind} level ${level}`).not.toBe(JSON.stringify(statsAt(kind, level - 1, path)));
        }
      }
      // The two paths really are different.
      expect(JSON.stringify(statsAt(kind, 3, 0))).not.toBe(JSON.stringify(statsAt(kind, 3, 1)));
    }
  });

  it('names a duck on a final path after that path', () => {
    expect(nameAt('sunny', 3, 0)).toBe(DUCKS.sunny.finals[0].name);
    expect(nameAt('sunny', 3, 1)).toBe(DUCKS.sunny.finals[1].name);
  });
});

describe('buying upgrades', () => {
  const path = makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
  const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 0 };

  it('spends peas and raises the level, then takes the final path you pick, up to the max', () => {
    const game = createGame({ path }, [wave], 'normal');
    game.peas = 10_000;
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    const before = game.peas;
    expect(upgradeDuck(game, duck.id)).toBe(true);
    expect(duck.level).toBe(1);
    expect(game.peas).toBe(before - DUCKS.sunny.upgrades[0].cost);
    expect(upgradeDuck(game, duck.id)).toBe(true);
    const beforeFinal = game.peas;
    expect(upgradeDuck(game, duck.id, 1)).toBe(true);
    expect(duck.path).toBe(1);
    expect(game.peas).toBe(beforeFinal - DUCKS.sunny.finals[1].cost);
    expect(upgradeDuck(game, duck.id)).toBe(false);
    expect(duck.level).toBe(MAX_UPGRADE_LEVEL);
    expect(sellValue('sunny', 3, 0, 1)).toBe(Math.floor(totalSpent('sunny', 3, 1) * SELL_REFUND));
  });

  it("won't upgrade without enough peas", () => {
    const game = createGame({ path }, [wave], 'normal');
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    game.peas = DUCKS.sunny.upgrades[0].cost - 1;
    expect(canUpgrade(game, duck.id)).toBe(false);
    expect(upgradeDuck(game, duck.id)).toBe(false);
    expect(duck.level).toBe(0);
  });

  it('refunds part of the upgrades too when selling', () => {
    const game = createGame({ path }, [wave], 'normal');
    game.peas = 10_000;
    const duck = buyDuck(game, 'potato', { x: 0, y: 50 })!;
    upgradeDuck(game, duck.id);
    startWave(game);
    const before = game.peas;
    const spent = DUCKS.potato.cost + DUCKS.potato.upgrades[0].cost;
    expect(totalSpent('potato', 1)).toBe(spent);
    expect(sellValue('potato', 1)).toBe(Math.floor(spent * SELL_REFUND));
    expect(sellDuck(game, duck.id)).toBe(sellValue('potato', 1));
    expect(game.peas).toBe(before + sellValue('potato', 1));
  });

  it('makes the duck fight with its upgraded stats', () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]));
    const enemy = spawnEnemy(battle, 'raccoon');
    const duck = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    duck.level = 1;
    step(battle, 0);
    expect(enemy.hp).toBe(enemy.maxHp - statsAt('sunny', 1).damage);
  });
});
