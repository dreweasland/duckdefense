import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { DUCKS } from '../data/ducks';
import { POWERS, POWER_EFFECTS } from '../data/powers';
import type { Wave } from '../data/waves';
import { createBattle, flapStorm, holdTheLine, isHidden, megaQuack, placeDuck, spawnEnemy, step } from './battle';
import { buyDuck, createGame, startWave, update } from './game';
import { makePath } from './path';
import { canUsePower, powerCooldown, powerState, usePower } from './powers';

const path = makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]);
const quiet: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1, after: 100 }], bonusPeas: 0 };

function newBattle() {
  return createBattle(path);
}

describe('flock powers', () => {
  it('need a duck of the kind out, and a wave on, then rest after a use', () => {
    const game = createGame({ path }, [quiet], 'easy');
    expect(powerState(game, 'sunny')).toBe('noDuck');
    buyDuck(game, 'sunny', { x: 100, y: 50 });
    expect(powerState(game, 'sunny')).toBe('notNow');
    startWave(game);
    expect(powerState(game, 'sunny')).toBe('ready');
    expect(usePower(game, 'sunny')).toBeDefined();
    expect(powerState(game, 'sunny')).toBe('resting');
    expect(powerCooldown(game, 'sunny')).toBe(POWERS.sunny.cooldown);
    expect(usePower(game, 'sunny')).toBeUndefined();
    update(game, POWERS.sunny.cooldown / 2);
    expect(powerCooldown(game, 'sunny')).toBeCloseTo(POWERS.sunny.cooldown / 2);
    update(game, POWERS.sunny.cooldown);
    expect(canUsePower(game, 'sunny')).toBe(true);
  });

  it("Tidal Wave: every Sunny's giant splash hits everything in her reach and soaks it", () => {
    const game = createGame({ path }, [quiet], 'easy');
    const sunny = buyDuck(game, 'sunny', { x: 1000, y: 50 })!;
    startWave(game);
    const near = spawnEnemy(game.battle, 'raccoon');
    near.distance = 1000;
    const far = spawnEnemy(game.battle, 'raccoon');
    far.distance = 1000 + DUCKS.sunny.range + 50;
    const result = usePower(game, 'sunny')!;
    expect(result).toEqual({ duckIds: [sunny.id], hitIds: [near.id] });
    expect(near.hp).toBe(ENEMIES.raccoon.maxHp - DUCKS.sunny.damage * POWER_EFFECTS.tidalWave.damage);
    expect(near.soakedTime).toBe(POWER_EFFECTS.tidalWave.soak.time);
    expect(far.hp).toBe(ENEMIES.raccoon.maxHp);
    // Soaked predators crawl.
    const before = near.distance;
    near.stopTime = 0;
    step(game.battle, 1);
    expect(near.distance - before).toBeCloseTo(near.speed * POWER_EFFECTS.tidalWave.soak.speed);
  });

  it('Flap Storm: every predator in reach of a Potato is blown back and left dizzy, heavy ones less so', () => {
    const battle = newBattle();
    placeDuck(battle, 'potato', { x: 1000, y: 50 });
    const raccoon = spawnEnemy(battle, 'raccoon');
    raccoon.distance = 1000;
    const bandit = spawnEnemy(battle, 'bandit');
    bandit.distance = 1000;
    const result = flapStorm(battle);
    expect(result.hitIds).toEqual([raccoon.id, bandit.id]);
    expect(raccoon.distance).toBe(1000 - POWER_EFFECTS.flapStorm.pushBack);
    expect(bandit.distance).toBe(1000 - POWER_EFFECTS.flapStorm.pushBack * (1 - ENEMIES.bandit.pushResistance!));
    expect(raccoon.stopTime).toBe(POWER_EFFECTS.flapStorm.stun);
  });

  it('Mega Quack: freezes every predator on the map (quick ones less) and flushes out hiding ones', () => {
    const battle = newBattle();
    placeDuck(battle, 'chester', { x: 0, y: 50 });
    const mink = spawnEnemy(battle, 'mink');
    mink.distance = 1900; // nowhere near Chester
    const fox = spawnEnemy(battle, 'fox');
    megaQuack(battle);
    expect(mink.stopTime).toBe(POWER_EFFECTS.megaQuack.stunTime);
    expect(isHidden(mink)).toBe(false);
    expect(fox.stopTime).toBeCloseTo(POWER_EFFECTS.megaQuack.stunTime * (1 - ENEMIES.fox.stunResistance!));
  });

  it('Hold the Line: for a while nothing scares the flock and ground predators trudge', () => {
    const battle = createBattle(path, { sky: [{ x: 2000, y: -500 }] });
    const sunny = placeDuck(battle, 'sunny', { x: 2000, y: -480 }); // right under the hawk's path
    sunny.scaredTime = 2;
    placeDuck(battle, 'curtis', { x: 0, y: 50 });
    const raccoon = spawnEnemy(battle, 'raccoon');
    raccoon.distance = 1500; // out of Curtis's reach
    const hawk = spawnEnemy(battle, 'hawk');
    holdTheLine(battle);
    expect(sunny.scaredTime).toBe(0);
    expect(battle.rallyTime).toBe(POWER_EFFECTS.holdTheLine.time);
    const events = step(battle, 0.5);
    expect(events.find((e) => e.type === 'scared')).toMatchObject({ duckIds: [], fearlessIds: [sunny.id] });
    expect(raccoon.distance - 1500).toBeCloseTo(raccoon.speed * POWER_EFFECTS.holdTheLine.slow * 0.5);
    expect(hawk.distance).toBeCloseTo(hawk.speed * 0.5); // flyers don't care
    step(battle, POWER_EFFECTS.holdTheLine.time);
    expect(battle.rallyTime).toBe(0);
  });
});

