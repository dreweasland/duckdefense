import { describe, expect, it } from 'vitest';
import { dailyRecord, dailyStreak, emptyProgress, isUnlocked, parseProgress, recordDailyWin, recordEndless, recordWin, scoreFor, starsFor } from './progress';

describe('stars', () => {
  it('gives 3 stars for keeping almost every heart', () => {
    expect(starsFor(20, 20)).toBe(3);
    expect(starsFor(9, 10)).toBe(3);
  });

  it('gives 2 stars for keeping at least half', () => {
    expect(starsFor(5, 10)).toBe(2);
  });

  it('always gives at least 1 star for a win', () => {
    expect(starsFor(1, 10)).toBe(1);
  });
});

describe('score', () => {
  it('is 100 per heart plus leftover peas, doubled on Normal', () => {
    expect(scoreFor(8, 150, 'easy')).toBe(950);
    expect(scoreFor(8, 150, 'normal')).toBe(1900);
  });
});

describe('progress', () => {
  it('starts with only the first level open', () => {
    const progress = emptyProgress();
    expect(isUnlocked(progress, 'easy', 0)).toBe(true);
    expect(isUnlocked(progress, 'easy', 1)).toBe(false);
  });

  it('unlocks the next level on a win, per difficulty', () => {
    const progress = recordWin(emptyProgress(), 'easy', 0, 2, 500);
    expect(isUnlocked(progress, 'easy', 1)).toBe(true);
    expect(isUnlocked(progress, 'normal', 1)).toBe(false);
  });

  it('keeps the best stars and score', () => {
    let progress = recordWin(emptyProgress(), 'easy', 0, 3, 900);
    progress = recordWin(progress, 'easy', 0, 1, 1200);
    expect(progress.levels.easy[0]).toEqual({ stars: 3, bestScore: 1200 });
  });

  it('survives being saved and loaded', () => {
    const progress = recordWin(emptyProgress(), 'normal', 2, 2, 1800);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });

  it('ignores corrupt or tampered saves', () => {
    expect(parseProgress('not json')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ levels: { easy: { 0: { stars: 99 } } } }))).toEqual(emptyProgress());
  });
});

describe('daily challenge streak', () => {
  const win = (progress: ReturnType<typeof emptyProgress>, date: string) => recordDailyWin(progress, date, 'easy', 1, 100);

  it('grows by one for each day in a row, and only once a day', () => {
    let progress = win(emptyProgress(), '2026-09-29');
    expect(dailyStreak(progress, '2026-09-29')).toBe(1);
    progress = win(progress, '2026-09-30');
    progress = recordDailyWin(progress, '2026-09-30', 'normal', 3, 500); // same day again
    expect(dailyStreak(progress, '2026-09-30')).toBe(2);
    progress = win(progress, '2026-10-01'); // across a month end
    expect(dailyStreak(progress, '2026-10-01')).toBe(3);
  });

  it("still counts the next day before that day's challenge is won, then is lost", () => {
    const progress = win(win(emptyProgress(), '2026-09-29'), '2026-09-30');
    expect(dailyStreak(progress, '2026-10-01')).toBe(2);
    expect(dailyStreak(progress, '2026-10-02')).toBe(0);
    expect(dailyStreak(win(progress, '2026-10-02'), '2026-10-02')).toBe(1);
  });

  it('is saved, ignoring a broken one', () => {
    const progress = win(win(emptyProgress(), '2026-09-29'), '2026-09-30');
    expect(parseProgress(JSON.stringify(progress)).dailyStreak).toEqual({ count: 2, last: '2026-09-30' });
    expect(parseProgress(JSON.stringify({ dailyStreak: { count: -3, last: 'soon' } })).dailyStreak).toBeUndefined();
    expect(dailyStreak(emptyProgress(), '2026-09-30')).toBe(0);
  });
});

describe('daily challenge progress', () => {
  it('keeps the best result for the day on each difficulty', () => {
    let progress = recordDailyWin(emptyProgress(), '2026-09-29', 'easy', 2, 500);
    progress = recordDailyWin(progress, '2026-09-29', 'easy', 1, 900);
    progress = recordDailyWin(progress, '2026-09-29', 'normal', 3, 300);
    expect(dailyRecord(progress, '2026-09-29', 'easy')).toEqual({ stars: 2, bestScore: 900 });
    expect(dailyRecord(progress, '2026-09-29', 'normal')).toEqual({ stars: 3, bestScore: 300 });
    expect(dailyRecord(progress, '2026-09-30', 'easy')).toBeUndefined();
  });

  it("starts fresh on a new day, and doesn't touch level progress", () => {
    let progress = recordWin(emptyProgress(), 'easy', 0, 3, 100);
    progress = recordDailyWin(progress, '2026-09-29', 'easy', 2, 500);
    progress = recordDailyWin(progress, '2026-09-30', 'normal', 1, 50);
    expect(progress.daily).toEqual({ date: '2026-09-30', results: { normal: { stars: 1, bestScore: 50 } } });
    expect(progress.levels.easy[0]).toEqual({ stars: 3, bestScore: 100 });
  });

  it('survives saving and loading', () => {
    const progress = recordDailyWin(emptyProgress(), '2026-09-29', 'easy', 2, 500);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });
});

describe('Endless Pond progress', () => {
  it('keeps the most waves survived on each difficulty, and survives saving', () => {
    let progress = recordEndless(emptyProgress(), 'easy', 12);
    progress = recordEndless(progress, 'easy', 8);
    progress = recordEndless(progress, 'normal', 5);
    expect(progress.endless).toEqual({ easy: 12, normal: 5 });
    expect(parseProgress(JSON.stringify(progress)).endless).toEqual({ easy: 12, normal: 5 });
  });
});
