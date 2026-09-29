import { describe, expect, it } from 'vitest';
import { emptyProgress, isUnlocked, parseProgress, recordWin, scoreFor, starsFor } from './progress';

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
