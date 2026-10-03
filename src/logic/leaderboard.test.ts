import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import { LEVELS } from '../data/levels';
import { ENDLESS, endlessLevel, endlessMap } from '../data/endless';
import { challengeSettings, dailyDate, dailyFor } from './daily';
import { findTrial } from '../data/trials';
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

describe('Level Trial submissions', () => {
  // Fragile House (level 4) keeps only 30% of the hearts.
  const trial = findTrial('fragileHouse')!;
  const good = { name: 'Trial Fan', difficulty: 'normal', hearts: 2, peas: 50, trial: 'fragileHouse' };

  it("takes the level from the trial and scores it like a level, on the trial's own board", () => {
    expect(checkSubmission({ ...good, level: 0 })).toEqual({
      ok: true,
      entry: { name: 'Trial Fan', level: trial.level, difficulty: 'normal', hearts: 2, peas: 50, trial: 'fragileHouse', score: scoreFor(2, 50, 'normal') },
    });
  });

  it("uses the trial's hearts to spot impossible scores", () => {
    const maxHearts = challengeSettings('normal', trial.trial).hearts;
    expect(checkSubmission({ ...good, hearts: maxHearts }).ok).toBe(true);
    expect(checkSubmission({ ...good, hearts: maxHearts + 1 }).ok).toBe(false);
  });

  it('rejects unknown trials, and a score that claims to be a daily too', () => {
    expect(checkSubmission({ ...good, trial: 'sunnysNap' }).ok).toBe(false);
    expect(checkSubmission({ ...good, trial: 7 }).ok).toBe(false);
    expect(checkSubmission({ ...good, daily: dailyDate() }).ok).toBe(false);
  });
});

describe('level count', () => {
  it('matches the levels list (update src/data/levelCount.ts when adding a level)', () => {
    expect(LEVEL_COUNT).toBe(LEVELS.length);
  });
});

describe('Endless Pond submissions', () => {
  it("scores the waves survived, on the map's own board (the first map unless one is sent)", () => {
    expect(checkSubmission({ name: 'Pond Pro', difficulty: 'normal', endless: true, waves: 23, hearts: 5, peas: 9999 })).toEqual({
      ok: true,
      entry: { name: 'Pond Pro', level: endlessLevel(0), difficulty: 'normal', hearts: 0, peas: 0, score: 23 },
    });
    expect(checkSubmission({ name: 'Pond Pro', difficulty: 'easy', endless: true, waves: 5, level: 3 })).toMatchObject({ ok: true, entry: { level: endlessLevel(3) } });
    expect(checkSubmission({ name: 'Pond Pro', difficulty: 'easy', endless: true, waves: 5, level: LEVEL_COUNT }).ok).toBe(false);
  });

  it('keeps Endless levels apart from real ones', () => {
    expect(endlessLevel(0)).toBe(-1); // the Backyard Pond's old scores stay where they were
    for (let map = 0; map < LEVEL_COUNT; map++) expect(endlessMap(endlessLevel(map))).toBe(map);
    expect(endlessMap(0)).toBeUndefined();
    expect(endlessMap(-1 - LEVEL_COUNT)).toBeUndefined();
  });

  it('rejects impossible wave counts', () => {
    const run = { name: 'Pond Pro', difficulty: 'easy', endless: true };
    expect(checkSubmission({ ...run, waves: 0 }).ok).toBe(false);
    expect(checkSubmission({ ...run, waves: ENDLESS.maxWaves + 1 }).ok).toBe(false);
    expect(checkSubmission({ ...run, waves: 2.5 }).ok).toBe(false);
  });
});
