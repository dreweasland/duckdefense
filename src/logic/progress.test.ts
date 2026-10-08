import { describe, expect, it } from 'vitest';
import { LEVELS } from '../data/levels';
import { TRIALS } from '../data/trials';
import {
  dailyRecord,
  dailyStreak,
  emptyProgress,
  expertUnlocked,
  endlessBest,
  hasWonTrial,
  isUnlocked,
  parseProgress,
  recordDailyWin,
  recordEndless,
  recordTrialWin,
  recordWin,
  scoreFor,
  starsFor,
  trialsUnlocked,
  trialsWon,
} from './progress';

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
  it('is 100 per heart plus leftover peas, doubled on Normal and tripled on Hard', () => {
    expect(scoreFor(8, 150, 'easy')).toBe(950);
    expect(scoreFor(8, 150, 'normal')).toBe(1900);
    expect(scoreFor(4, 150, 'hard')).toBe(1650);
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
    const progress = recordWin(recordWin(emptyProgress(), 'normal', 2, 2, 1800), 'hard', 0, 1, 900);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
    // A save from before Hard existed still loads.
    expect(parseProgress(JSON.stringify({ version: 1, levels: { easy: { 0: { stars: 2, bestScore: 5 } }, normal: {} } })).levels.easy[0]).toEqual({ stars: 2, bestScore: 5 });
  });

  it('ignores corrupt or tampered saves', () => {
    expect(parseProgress('not json')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ levels: { easy: { 0: { stars: 99 } } } }))).toEqual(emptyProgress());
    // A hat that isn't one (an object's built-in property names would otherwise slip through "in").
    const save = { ...emptyProgress(), hats: { sunny: 'constructor', potato: 'party' } };
    expect(parseProgress(JSON.stringify(save)).hats).toEqual({ potato: 'party' });
  });
});

describe('Expert', () => {
  it('shows up once any level has been won on Hard', () => {
    expect(expertUnlocked(emptyProgress())).toBe(false);
    expect(expertUnlocked(recordWin(emptyProgress(), 'normal', 6, 3, 999))).toBe(false);
    expect(expertUnlocked(recordWin(emptyProgress(), 'hard', 0, 1, 100))).toBe(true);
  });

  it('keeps an old save (from before Expert) readable, with no Expert progress', () => {
    const old = JSON.stringify({ version: 1, levels: { easy: { 0: { stars: 3, bestScore: 500 } }, normal: {}, hard: {} } });
    expect(parseProgress(old).levels.expert).toEqual({});
    expect(parseProgress(old).levels.easy[0]).toEqual({ stars: 3, bestScore: 500 });
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
  it('keeps the most waves survived on each map and difficulty, and survives saving', () => {
    let progress = recordEndless(emptyProgress(), 'easy', 0, 12);
    progress = recordEndless(progress, 'easy', 0, 8);
    progress = recordEndless(progress, 'easy', 2, 3);
    progress = recordEndless(progress, 'normal', 0, 5);
    expect(progress.endless).toEqual({ easy: { 0: 12, 2: 3 }, normal: { 0: 5 } });
    expect(endlessBest(progress, 'easy', 2)).toBe(3);
    expect(endlessBest(progress, 'hard', 0)).toBe(0);
    expect(parseProgress(JSON.stringify(progress)).endless).toEqual(progress.endless);
  });

  it('reads a save from when Endless was only on the first map', () => {
    expect(parseProgress(JSON.stringify({ endless: { easy: 12, normal: 'lots' } })).endless).toEqual({ easy: { 0: 12 } });
  });
});

describe('Level Trials progress', () => {
  const first = TRIALS[0]![0]!.id;
  const second = TRIALS[0]![1]!.id;

  it('has a list of trials for every level, with ids that are all different', () => {
    expect(TRIALS).toHaveLength(LEVELS.length);
    const ids = TRIALS.flat().map((trial) => trial.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TRIALS.every((trials) => trials.length >= 1 && trials.length <= 3)).toBe(true);
  });

  it('opens a level’s trials once the level is beaten on that difficulty', () => {
    const progress = recordWin(emptyProgress(), 'easy', 0, 1, 100);
    expect(trialsUnlocked(progress, 'easy', 0)).toBe(true);
    expect(trialsUnlocked(progress, 'normal', 0)).toBe(false);
    expect(trialsUnlocked(progress, 'easy', 1)).toBe(false);
  });

  it('remembers each trial won, once, per difficulty', () => {
    let progress = recordTrialWin(emptyProgress(), 'easy', first);
    expect(recordTrialWin(progress, 'easy', first)).toBe(progress); // already won: nothing changes
    progress = recordTrialWin(progress, 'easy', second);
    expect(hasWonTrial(progress, 'easy', first)).toBe(true);
    expect(hasWonTrial(progress, 'normal', first)).toBe(false);
    expect(trialsWon(progress, 'easy', 0)).toBe(2);
    expect(trialsWon(progress, 'easy', 1)).toBe(0);
  });

  it('survives saving, dropping trials that no longer exist', () => {
    const progress = recordTrialWin(emptyProgress(), 'normal', first);
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
    const saved = JSON.stringify({ trials: { easy: [first, first, 'gone', 7], normal: 'nope' } });
    expect(parseProgress(saved).trials).toEqual({ easy: [first] });
  });
});
