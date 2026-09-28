import { describe, expect, it } from 'vitest';
import { CRAIG } from '../data/craig';
import { BATTERY, FOUNTAIN, NIGHT } from '../data/dayNight';
import { DIFFICULTIES } from '../data/difficulty';
import { DUCKS } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import type { Wave } from '../data/waves';
import { buyDuck, createGame, isNight, scheduleWave, startWave, update, useBlessing, type GameEvent } from './game';
import { makePath } from './path';

// A short straight path so predators arrive quickly.
const path = makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
const oneRaccoon: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 25 };

function runUntilIdle(game: ReturnType<typeof createGame>): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < 10_000 && game.phase === 'wave'; i++) events.push(...update(game, 0.05));
  return events;
}

describe('game', () => {
  it('starts with the difficulty’s peas and hearts', () => {
    const game = createGame({ path }, [oneRaccoon], 'easy');
    expect(game.peas).toBe(DIFFICULTIES.easy.startingPeas);
    expect(game.hearts).toBe(DIFFICULTIES.easy.hearts);
  });

  it('makes predators slower on Easy', () => {
    const easy = createGame({ path }, [oneRaccoon], 'easy');
    startWave(easy);
    const [spawned] = update(easy, 0);
    expect(spawned).toMatchObject({ type: 'spawned' });
    expect(easy.battle.enemies[0]!.speed).toBe(ENEMIES.raccoon.speed * DIFFICULTIES.easy.enemySpeed);
  });

  it('spends peas to place a duck, and refuses when you can’t afford it', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    game.peas = DUCKS.sunny.cost + 5;
    expect(buyDuck(game, 'sunny', { x: 0, y: 50 })).toBeDefined();
    expect(game.peas).toBe(5);
    expect(buyDuck(game, 'sunny', { x: 0, y: 50 })).toBeUndefined();
    expect(game.battle.ducks).toHaveLength(1);
  });

  it('spaces out each group and sorts the whole wave by time', () => {
    const wave: Wave = {
      time: 'day',
      groups: [
        { enemy: 'raccoon', count: 2, every: 3 },
        { enemy: 'raccoon', count: 1, every: 1, after: 1 },
      ],
      bonusPeas: 0,
    };
    expect(scheduleWave(wave).map((s) => s.time)).toEqual([0, 1, 3]);
  });

  it('costs a heart when a predator reaches the house', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'normal');
    startWave(game);
    runUntilIdle(game);
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts - 1);
  });

  it('pays peas per chase-off plus the wave bonus, then waits for the next wave', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'normal');
    game.peas = 1000;
    buyDuck(game, 'sunny', { x: 100, y: 0 });
    buyDuck(game, 'sunny', { x: 100, y: 0 });
    buyDuck(game, 'sunny', { x: 100, y: 0 });
    const before = game.peas;
    startWave(game);
    const events = runUntilIdle(game);
    expect(events).toContainEqual({ type: 'waveCleared', waveIndex: 0, bonus: 25 });
    expect(game.peas).toBe(before + ENEMIES.raccoon.peas + 25);
    expect(game.phase).toBe('building');
    expect(game.waveIndex).toBe(1);
  });

  it('wins after the last wave is cleared', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    game.peas = 1000;
    for (let i = 0; i < 5; i++) buyDuck(game, 'sunny', { x: 100, y: 0 });
    startWave(game);
    expect(runUntilIdle(game)).toContainEqual({ type: 'won' });
    expect(game.phase).toBe('won');
  });

  it('loses when the hearts run out', () => {
    const lots: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 50, every: 0.1 }], bonusPeas: 0 };
    const game = createGame({ path }, [lots], 'normal');
    startWave(game);
    expect(runUntilIdle(game)).toContainEqual({ type: 'lost' });
    expect(game.hearts).toBe(0);
    expect(buyDuck(game, 'sunny', { x: 0, y: 0 })).toBeUndefined();
  });

  it('can only start a wave between waves', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'normal');
    expect(startWave(game)).toBe(true);
    expect(startWave(game)).toBe(false);
  });
});

describe('day, night, and the solar battery', () => {
  const nightRaccoon: Wave = { ...oneRaccoon, time: 'night' };
  const withFountain = { path, fountainAt: { x: 1000, y: 1000 } }; // far from the path

  it('charges in day waves even while the fountain runs', () => {
    const game = createGame(withFountain, [oneRaccoon], 'normal');
    startWave(game);
    update(game, 1);
    expect(game.battery).toBeCloseTo(BATTERY.startCharge + BATTERY.solarPerSecond - FOUNTAIN.drawPerSecond);
  });

  it('drains at night', () => {
    const game = createGame(withFountain, [nightRaccoon], 'normal');
    startWave(game);
    update(game, 1);
    expect(game.battery).toBeCloseTo(BATTERY.startCharge - FOUNTAIN.drawPerSecond);
  });

  it('turns the fountain off when the battery is empty', () => {
    const game = createGame(withFountain, [nightRaccoon], 'normal');
    startWave(game);
    game.battery = 0.01;
    update(game, 1);
    update(game, 0.1);
    expect(game.battery).toBe(0);
    expect(game.battle.fountain!.on).toBe(false);
  });

  it('sends faster predators in night waves', () => {
    const game = createGame({ path }, [oneRaccoon, nightRaccoon], 'normal');
    expect(isNight(game)).toBe(false);
    game.waveIndex = 1;
    expect(isNight(game)).toBe(true);
    startWave(game);
    update(game, 0);
    expect(game.battle.enemies[0]!.speed).toBe(ENEMIES.raccoon.speed * NIGHT.enemySpeed);
  });
});

describe("Craig's Guardian Blessing", () => {
  it('can only be used once per level', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    expect(useBlessing(game)).toBe(true);
    expect(useBlessing(game)).toBe(false);
  });

  it('shoos predators away from the house without losing a heart', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    useBlessing(game);
    startWave(game);
    const events = runUntilIdle(game);
    expect(events.some((e) => e.type === 'shooed')).toBe(true);
    expect(events.some((e) => e.type === 'reachedHouse')).toBe(false);
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts);
  });

  it('wears off after a while', () => {
    const late: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1, after: CRAIG.shieldTime }], bonusPeas: 0 };
    const game = createGame({ path }, [late], 'normal');
    startWave(game);
    useBlessing(game);
    runUntilIdle(game);
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts - 1);
  });
});
