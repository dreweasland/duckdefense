import { describe, expect, it } from 'vitest';
import { ENDLESS } from '../data/endless';
import { LEVELS } from '../data/levels';
import { play } from './simulate';
import { bossCount, bossesFor, endlessWave, endlessWaves } from './endless';
import { buyDuck, createGame, mapFromLevel, repairCost, repairHouse, sellValue, startWave, trainDuck, trainingCost, upgradeDuck } from './game';
import { parseLevel } from './level';
import { spawnEnemy } from './battle';
import { ENEMIES } from '../data/enemies';

const kinds = (n: number) => endlessWave(n).groups.map((g) => g.enemy);

describe('Endless Pond waves', () => {
  it('start with just raccoons, then add each predator at its wave', () => {
    expect(kinds(1)).toEqual(['raccoon']);
    for (const group of ENDLESS.groups) {
      expect(kinds(group.from)).toContain(group.enemy);
      if (group.from > 1) expect(kinds(group.from - 1)).not.toContain(group.enemy);
    }
  });

  it('bring bosses more and more often, and night every 3rd wave', () => {
    const { every, fasterFrom, fasterEvery, oneMoreEvery } = ENDLESS.boss;
    expect(kinds(every)).toContain('bandit');
    expect(kinds(every + 1)).not.toContain('bandit');
    expect(bossCount(fasterEvery)).toBe(0); // not every 5th wave yet...
    expect(bossCount(fasterFrom + fasterEvery)).toBeGreaterThan(0); // ...but later, yes
    expect(bossCount(oneMoreEvery * 2)).toBe(3);
    expect(endlessWave(ENDLESS.nightEvery).time).toBe('night');
    expect(endlessWave(1).time).toBe('day');
  });

  it('take turns through every boss, mixing them when more than one comes', () => {
    const bossWaves = Array.from({ length: 60 }, (_, i) => i + 1).filter((n) => bossesFor(n).length > 0);
    const firstFour = bossWaves.slice(0, 4).map((n) => bossesFor(n)[0]);
    expect(firstFour).toEqual(ENDLESS.boss.kinds);
    const pair = bossesFor(ENDLESS.boss.oneMoreEvery * 2);
    expect(new Set(pair).size).toBe(pair.length);
  });

  it('keep getting bigger, tougher, and faster', () => {
    const size = (n: number) => endlessWave(n).groups.reduce((sum, g) => sum + g.count, 0);
    for (let n = 1; n < 60; n++) {
      expect(size(n + 1)).toBeGreaterThanOrEqual(size(n));
      expect(endlessWave(n + 1).health!).toBeGreaterThan(endlessWave(n).health!);
      expect(endlessWave(n + 1).bonusPeas).toBeGreaterThan(endlessWave(n).bonusPeas);
    }
    expect(endlessWave(40).groups.every((g) => g.every >= ENDLESS.minEvery)).toBe(true);
    expect(endlessWaves()).toHaveLength(ENDLESS.maxWaves);
  });

  it("make predators tougher by the wave's health", () => {
    const game = createGame(mapFromLevel(parseLevel(LEVELS[ENDLESS.level]!.map)), endlessWaves(), 'easy');
    game.waveIndex = 20;
    startWave(game);
    const raccoon = spawnEnemy(game.battle, 'raccoon');
    expect(raccoon.maxHp).toBeCloseTo(ENEMIES.raccoon.maxHp * endlessWave(21).health!);
  });
});

describe('Endless Pond extras', () => {
  const newGame = (endless = true) => createGame(mapFromLevel(parseLevel(LEVELS[ENDLESS.level]!.map)), endlessWaves(), 'easy', undefined, endless);

  it('let a fully upgraded duck keep training, each level costing more', () => {
    const game = newGame();
    game.peas = 10_000;
    const duck = buyDuck(game, 'sunny', { x: 0, y: 0 })!;
    expect(trainingCost(game, duck.id)).toBeUndefined(); // upgrades first
    upgradeDuck(game, duck.id);
    upgradeDuck(game, duck.id);
    expect(trainingCost(game, duck.id)).toBeUndefined(); // the final upgrade too
    upgradeDuck(game, duck.id);
    const first = trainingCost(game, duck.id)!;
    expect(first).toBe(ENDLESS.training.firstCost);
    expect(trainDuck(game, duck.id)).toBe(true);
    expect(duck.training).toBe(1);
    expect(trainingCost(game, duck.id)).toBeGreaterThan(first);
    expect(sellValue('sunny', 3, 1)).toBeGreaterThan(sellValue('sunny', 3));
  });

  it('let you fix the duck house for peas, up to the hearts you started with', () => {
    const game = newGame();
    game.peas = 1_000;
    expect(repairCost(game)).toBeUndefined(); // already full
    game.hearts -= 2;
    const first = repairCost(game)!;
    expect(repairHouse(game)).toBe(true);
    expect(game.peas).toBe(1_000 - first);
    expect(repairCost(game)).toBeGreaterThan(first);
    repairHouse(game);
    expect(game.hearts).toBe(game.maxHearts);
    expect(repairHouse(game)).toBe(false);
  });

  it('are only in the Endless Pond', () => {
    const game = newGame(false);
    game.peas = 10_000;
    game.hearts -= 1;
    const duck = buyDuck(game, 'sunny', { x: 0, y: 0 })!;
    upgradeDuck(game, duck.id);
    upgradeDuck(game, duck.id);
    upgradeDuck(game, duck.id);
    expect(trainDuck(game, duck.id)).toBe(false);
    expect(repairHouse(game)).toBe(false);
  });
});

describe('Endless Pond balance', () => {
  const info = { ...LEVELS[ENDLESS.level]!, waves: endlessWaves() };

  it('lets a simple Easy player last a good while, but not forever', () => {
    // Bigger simulation steps keep this long run quick.
    const survived = play(info, 'easy', 'sunny', { upgrades: 'place-first', endless: true, step: 1 / 10 }).waveIndex;
    expect(survived).toBeGreaterThanOrEqual(15);
    expect(survived).toBeLessThan(80);
  }, 60_000);

  it('lets a simple Normal player get past the first few waves', () => {
    expect(play(info, 'normal', 'sunny', { upgrades: 'place-first' }).waveIndex).toBeGreaterThanOrEqual(5);
  });

  it('ends quickly with no ducks', () => {
    expect(play(info, 'easy', null).waveIndex).toBeLessThanOrEqual(5);
  });
});
