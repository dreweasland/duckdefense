import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import { LEVELS } from '../data/levels';
import { MAX_PEAS, NAME_MAX_LENGTH, checkName, checkSubmission } from './leaderboard';
import { scoreFor } from './progress';

describe('leaderboard names', () => {
  it('accepts simple names and tidies spaces', () => {
    expect(checkName('  Potato   Dad ')).toEqual({ ok: true, name: 'Potato Dad' });
  });

  it('rejects empty, long, or odd-character names', () => {
    expect(checkName('   ').ok).toBe(false);
    expect(checkName('x'.repeat(NAME_MAX_LENGTH + 1)).ok).toBe(false);
    expect(checkName('<b>hi</b>').ok).toBe(false);
    expect(checkName('😀').ok).toBe(false);
  });

  it('rejects rude names, including sneaky spellings', () => {
    expect(checkName('shit').ok).toBe(false);
    expect(checkName('sh1t head').ok).toBe(false);
  });

  it("doesn't reject normal names that happen to contain rude letters", () => {
    expect(checkName('Assassin').ok).toBe(true);
    expect(checkName('Scunthorpe').ok).toBe(true);
  });
});

describe('score submissions', () => {
  const good = { name: 'Sunny Fan', level: 0, difficulty: 'normal', hearts: 7, peas: 250 };

  it('works out the score itself', () => {
    const result = checkSubmission({ ...good, score: 999_999 });
    expect(result).toEqual({ ok: true, entry: { ...good, score: scoreFor(7, 250, 'normal') } });
  });

  it('rejects impossible scores', () => {
    expect(checkSubmission({ ...good, hearts: DIFFICULTIES.normal.hearts + 1 }).ok).toBe(false);
    expect(checkSubmission({ ...good, hearts: 0 }).ok).toBe(false); // you can't win with no hearts
    expect(checkSubmission({ ...good, peas: MAX_PEAS + 1 }).ok).toBe(false);
    expect(checkSubmission({ ...good, peas: 1.5 }).ok).toBe(false);
  });

  it('rejects unknown levels and difficulties', () => {
    expect(checkSubmission({ ...good, level: LEVEL_COUNT }).ok).toBe(false);
    expect(checkSubmission({ ...good, difficulty: 'nightmare' }).ok).toBe(false);
    expect(checkSubmission(null).ok).toBe(false);
  });

  it('checks the name too', () => {
    expect(checkSubmission({ ...good, name: 'shit' }).ok).toBe(false);
  });
});

describe('level count', () => {
  it('matches the levels list (update src/data/levelCount.ts when adding a level)', () => {
    expect(LEVEL_COUNT).toBe(LEVELS.length);
  });
});
