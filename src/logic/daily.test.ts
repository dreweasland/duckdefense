import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../data/challenges';
import { DIFFICULTIES } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import type { Wave } from '../data/waves';
import { challengeSettings, challengeWaves, dailyDate, dailyFor, isPostableDate } from './daily';
import { buyDuck, canBuy, canSell, canUseBlessing, createGame, sellDuck } from './game';
import { makePath } from './path';

describe('daily challenge', () => {
  it("uses today's date in UTC", () => {
    expect(dailyDate(new Date('2026-09-29T23:30:00-07:00'))).toBe('2026-09-30');
  });

  it('gives everyone the same level and twist for a date', () => {
    const a = dailyFor('2026-09-29')!;
    expect(dailyFor('2026-09-29')).toEqual(a);
    expect(a.level).toBeGreaterThanOrEqual(0);
    expect(a.level).toBeLessThan(LEVEL_COUNT);
    expect(CHALLENGES).toContain(a.challenge);
  });

  it("doesn't repeat a twist until every twist has had a day", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= CHALLENGES.length; d++) seen.add(dailyFor(`2026-10-${String(d).padStart(2, '0')}`)!.challenge.name);
    expect(seen.size).toBe(CHALLENGES.length);
  });

  it('uses every level over a month', () => {
    const levels = new Set<number>();
    for (let d = 1; d <= 30; d++) levels.add(dailyFor(`2026-11-${String(d).padStart(2, '0')}`)!.level);
    expect(levels.size).toBe(LEVEL_COUNT);
  });

  it('rejects dates that are not real', () => {
    expect(dailyFor('2026-02-30')).toBeUndefined();
    expect(dailyFor('yesterday')).toBeUndefined();
  });

  it('takes scores for today or yesterday only', () => {
    const now = new Date('2026-09-29T00:10:00Z');
    expect(isPostableDate('2026-09-29', now)).toBe(true);
    expect(isPostableDate('2026-09-28', now)).toBe(true);
    expect(isPostableDate('2026-09-27', now)).toBe(false);
    expect(isPostableDate('2026-09-30', now)).toBe(false);
    expect(isPostableDate('nope', now)).toBe(false);
  });

  it('changes peas, hearts, and speed', () => {
    const settings = challengeSettings('normal', { name: 'x', description: 'x', startingPeas: 0.5, hearts: 0.5, enemySpeed: 1.2 });
    expect(settings.startingPeas).toBe(DIFFICULTIES.normal.startingPeas / 2);
    expect(settings.hearts).toBe(DIFFICULTIES.normal.hearts / 2);
    expect(settings.enemySpeed).toBeCloseTo(DIFFICULTIES.normal.enemySpeed * 1.2);
    expect(challengeSettings('easy')).toEqual(DIFFICULTIES.easy);
  });

  it('can make every wave night and add predators to each one', () => {
    const waves: Wave[] = [{ time: 'day', groups: [{ enemy: 'raccoon', count: 2, every: 1 }], bonusPeas: 10 }];
    const changed = challengeWaves(waves, { name: 'x', description: 'x', allNight: true, extra: { enemy: 'fox', count: 1, every: 1 } });
    expect(changed).toEqual([
      { time: 'night', groups: [{ enemy: 'raccoon', count: 2, every: 1 }, { enemy: 'fox', count: 1, every: 1 }], bonusPeas: 10 },
    ]);
    expect(waves[0]!.time).toBe('day'); // the level's own waves aren't touched
  });

  it('can leave ducks out, turn off selling, and give Craig the day off', () => {
    const path = makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
    const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 0 };
    const game = createGame({ path }, [wave], 'easy', { name: 'x', description: 'x', ducks: ['sunny'], noSelling: true, noCraig: true });
    expect(canBuy(game, 'potato')).toBe(false);
    expect(buyDuck(game, 'potato', { x: 0, y: 50 })).toBeUndefined();
    const sunny = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    expect(canSell(game)).toBe(false);
    expect(sellDuck(game, sunny.id)).toBeUndefined();
    expect(canUseBlessing(game)).toBe(false);
  });
});
