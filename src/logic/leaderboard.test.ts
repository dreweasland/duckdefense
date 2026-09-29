import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import { LEVELS } from '../data/levels';
import { challengeSettings, dailyFor } from './daily';
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

describe('daily challenge submissions', () => {
  const now = new Date('2026-09-29T12:00:00Z');
  const today = dailyFor('2026-09-29')!;
  const good = { name: 'Sunny Fan', difficulty: 'easy', hearts: 3, peas: 100, daily: '2026-09-29' };

  it("takes today's level from the date, whatever level was sent", () => {
    const result = checkSubmission({ ...good, level: (today.level + 1) % LEVEL_COUNT }, now);
    expect(result).toEqual({
      ok: true,
      entry: { name: 'Sunny Fan', level: today.level, difficulty: 'easy', hearts: 3, peas: 100, daily: '2026-09-29', score: scoreFor(3, 100, 'easy') },
    });
  });

  it("allows yesterday's challenge (a game that started before midnight), but nothing older or newer", () => {
    expect(checkSubmission({ ...good, daily: '2026-09-28' }, now).ok).toBe(true);
    expect(checkSubmission({ ...good, daily: '2026-09-27' }, now).ok).toBe(false);
    expect(checkSubmission({ ...good, daily: '2026-09-30' }, now).ok).toBe(false);
    expect(checkSubmission({ ...good, daily: 20260929 }, now).ok).toBe(false);
  });

  it("uses the twist's hearts to spot impossible scores", () => {
    const maxHearts = challengeSettings('easy', today.challenge).hearts;
    expect(checkSubmission({ ...good, hearts: maxHearts }, now).ok).toBe(true);
    expect(checkSubmission({ ...good, hearts: maxHearts + 1 }, now).ok).toBe(false);
  });
});

describe('level count', () => {
  it('matches the levels list (update src/data/levelCount.ts when adding a level)', () => {
    expect(LEVEL_COUNT).toBe(LEVELS.length);
  });
});
