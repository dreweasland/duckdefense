import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { LEVEL_COUNT } from '../data/levelCount';
import { LEVELS } from '../data/levels';
import { ENDLESS, endlessLevel, endlessMap } from '../data/endless';
import { TRIALS, findTrial } from '../data/trials';
import { EARLY_CALL } from '../data/waves';
import { challengeSettings, dailyDate, dailyFor } from './daily';
import { scorePeas } from './game';
import { BOSS_TIME_ALLOWANCE, NAME_MAX_LENGTH, checkName, checkSubmission, maxPeasFor, rateLimitKey } from './leaderboard';
import { scoreFor } from './progress';
import { play } from './simulate';

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

  it('rejects rude words spread out with spaces', () => {
    expect(checkName('s h i t').ok).toBe(false);
    expect(checkName('a s s').ok).toBe(false);
    expect(checkName('S H I T head').ok).toBe(false);
  });

  it("doesn't reject normal names that happen to contain rude letters", () => {
    expect(checkName('Assassin').ok).toBe(true);
    expect(checkName('Scunthorpe').ok).toBe(true);
    expect(checkName('Potato Dad').ok).toBe(true);
    expect(checkName('Scun thorpe').ok).toBe(true);
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
    expect(checkSubmission({ ...good, peas: maxPeasFor(good.level, 'normal') }).ok).toBe(true);
    expect(checkSubmission({ ...good, peas: maxPeasFor(good.level, 'normal') + 1 }).ok).toBe(false);
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

describe('maxPeasFor', () => {
  it('adds up the starting peas, every reward and bonus, and the early-call peas', () => {
    // Backyard Pond has no boss, so it's exactly: start + sum over waves of bonus + count x (reward + early call).
    const waves = LEVELS[0]!.waves;
    const expected = waves.reduce(
      (sum, wave) => sum + wave.bonusPeas + wave.groups.reduce((g, group) => g + group.count * (ENEMIES[group.enemy].peas + EARLY_CALL.peasPerPredator), 0),
      DIFFICULTIES.easy.startingPeas,
    );
    expect(maxPeasFor(0, 'easy')).toBe(expected);
    expect(maxPeasFor(0, 'hard')).toBe(expected - DIFFICULTIES.easy.startingPeas + DIFFICULTIES.hard.startingPeas);
  });

  it('allows for the minions a boss can call in while it is alive', () => {
    // Night Woods ends with the Night Bandit, who whistles up raccoons: the ceiling has room for a long fight.
    const level = LEVELS.findIndex((info) => info.waves.some((w) => w.groups.some((g) => g.enemy === 'bandit')));
    const bandit = ENEMIES.bandit;
    const fastest = Math.max(bandit.summons!.count / bandit.summons!.every, bandit.phase!.summons!.count / bandit.phase!.summons!.every);
    const minions = Math.ceil(fastest * BOSS_TIME_ALLOWANCE);
    const withoutBoss = maxPeasFor(level, 'easy') - minions * (ENEMIES.raccoon.peas + EARLY_CALL.peasPerPredator);
    expect(withoutBoss).toBeGreaterThan(0);
    expect(maxPeasFor(level, 'easy')).toBeGreaterThan(withoutBoss);
  });

  it('follows a twist: fewer starting peas, extra predators', () => {
    expect(maxPeasFor(0, 'normal', { name: 'Thin', description: '', startingPeas: 0.5 })).toBeLessThan(maxPeasFor(0, 'normal'));
    expect(maxPeasFor(0, 'normal', { name: 'More', description: '', extras: [{ enemy: 'raccoon', count: 2, every: 1 }] })).toBeGreaterThan(maxPeasFor(0, 'normal'));
  });

  it('is never beaten by a real game: the simulator wins every level and trial under the ceiling', () => {
    for (const [level, info] of LEVELS.entries()) {
      for (const difficulty of DIFFICULTY_ORDER) {
        const game = play(info, difficulty, ['sunny', 'potato', 'curtis', 'chester'], { upgrades: 'place-first', craig: true });
        expect(scorePeas(game)).toBeLessThanOrEqual(maxPeasFor(level, difficulty));
      }
    }
    for (const [level, trials] of TRIALS.entries()) {
      for (const trial of trials) {
        const game = play(LEVELS[level]!, 'easy', trial.ducks ?? 'sunny', { challenge: trial, upgrades: 'place-first' });
        expect(scorePeas(game)).toBeLessThanOrEqual(maxPeasFor(level, 'easy', trial));
      }
    }
  }, 60_000);
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

describe('rateLimitKey', () => {
  it('counts an IPv4 address as itself', () => {
    expect(rateLimitKey('203.0.113.7')).toBe('203.0.113.7');
  });

  it('counts a whole IPv6 /64 as one player, however the address is written', () => {
    expect(rateLimitKey('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3:8d3');
    expect(rateLimitKey('2001:DB8:85A3:08D3::1')).toBe('2001:db8:85a3:8d3');
    expect(rateLimitKey('2001:db8::1')).toBe('2001:db8:0:0');
    expect(rateLimitKey('::1')).toBe('0:0:0:0');
    expect(rateLimitKey('2001:db8:85a3:8d3:ffff::')).not.toBe(rateLimitKey('2001:db8:85a3:8d4::'));
  });
});
