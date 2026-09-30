import { describe, expect, it } from 'vitest';
import { ENDLESS } from '../data/endless';
import { LEVELS } from '../data/levels';
import { play } from './simulate';
import { endlessWave, endlessWaves } from './endless';
import { createGame, mapFromLevel, startWave } from './game';
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

  it('bring the Night Bandit every 10th wave, and night every 3rd', () => {
    expect(kinds(ENDLESS.bossEvery)).toContain('bandit');
    expect(kinds(ENDLESS.bossEvery + 1)).not.toContain('bandit');
    expect(endlessWave(ENDLESS.nightEvery).time).toBe('night');
    expect(endlessWave(1).time).toBe('day');
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

describe('Endless Pond balance', () => {
  const info = { ...LEVELS[ENDLESS.level]!, waves: endlessWaves() };

  it('lets a simple Easy player last a good while, but not forever', () => {
    const survived = play(info, 'easy', 'sunny', { upgrades: 'place-first' }).waveIndex;
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
