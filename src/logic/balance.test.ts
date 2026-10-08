// Balance checks: play each level with a simple strategy and make sure the
// difficulty still feels right. If you tune numbers in src/data/ and one of
// these fails, the level probably got too easy or too hard.
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../data/challenges';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { LEVELS } from '../data/levels';
import { TRIALS, findTrial } from '../data/trials';
import { play } from './simulate';
import { dailyFor } from './daily';

for (const [index, info] of LEVELS.entries()) {
  describe(`level ${index + 1} balance: ${info.name}`, () => {
    it('Easy can be won just by placing Sunnys in good spots', () => {
      expect(play(info, 'easy', 'sunny').phase).toBe('won');
    });

    it('Normal can be won with Sunnys in good spots and Craig for the last wave', () => {
      expect(play(info, 'normal', 'sunny', { craig: true }).phase).toBe('won');
    });

    it('Normal is lost if you place no ducks', () => {
      expect(play(info, 'normal', null).phase).toBe('lost');
    });

    it("Easy can still be won by a player who loves upgrading (upgrades before placing more ducks)", () => {
      expect(play(info, 'easy', 'sunny', { upgrades: 'upgrade-first' }).phase).toBe('won');
      expect(play(info, 'easy', 'potato', { upgrades: 'upgrade-first' }).phase).toBe('won');
    });

    it('Normal can be won placing ducks and upgrading with spare peas', () => {
      expect(play(info, 'normal', 'sunny', { upgrades: 'place-first' }).phase).toBe('won');
    });

    it('Hard can be won by a player who knows the game: a good team, upgrades in the best nests, Big Moves, and Craig', () => {
      // Hard is tight on purpose: it only has to fall to one of these setups (with either final path).
      const teams: DuckKind[][] = [
        ['sunny'], ['potato'], ['sunny', 'curtis'], ['potato', 'curtis'], ['potato', 'sunny', 'curtis', 'chester'], ['sunny', 'potato'],
        ['potato', 'potato', 'chester'], ['potato', 'chester'], ['sunny', 'sunny', 'curtis', 'chester'],
      ];
      const won = teams.some((team) =>
        [0, 1].some((path) =>
          [3, 5].some((core) => play(info, 'hard', team, { upgrades: 'smart', craig: true, powers: true, path, core, step: 1 / 20 }).phase === 'won'),
        ),
      );
      expect(won).toBe(true);
    });
  });
}

describe('daily challenge balance', () => {
  for (const challenge of CHALLENGES) {
    // Sunny if she's playing today, otherwise the first duck that is.
    const kind = challenge.ducks?.includes('sunny') === false ? challenge.ducks[0]! : 'sunny';
    for (const [index, info] of LEVELS.entries()) {
      it(`${challenge.name} can be won on Easy on level ${index + 1} by placing ${DUCKS[kind].name}s and upgrading`, () => {
        expect(play(info, 'easy', kind, { challenge, upgrades: 'place-first' }).phase).toBe('won');
      });
    }
  }
});

describe('double-twist daily balance', () => {
  // The next couple of months of double-twist days (the pairs are mixed up, so this samples
  // many of them): each can be won on Easy by a team of the ducks that are playing.
  const days: string[] = [];
  for (let d = 0; d < 60; d++) days.push(new Date(Date.UTC(2026, 9, 10 + d)).toISOString().slice(0, 10));
  for (const date of days) {
    const daily = dailyFor(date)!;
    if (!daily.challenge.name.includes(' + ')) continue;
    it(`${date}: ${daily.challenge.name} on ${LEVELS[daily.level]!.name} can be won on Easy`, () => {
      const allowed = DUCK_ORDER.filter((kind) => daily.challenge.ducks?.includes(kind) ?? true);
      const won = play(LEVELS[daily.level]!, 'easy', allowed, { challenge: daily.challenge, upgrades: 'place-first', craig: !daily.challenge.noCraig }).phase === 'won';
      expect(won).toBe(true);
    });
  }
});

describe('level trial balance', () => {
  for (const [index, trials] of TRIALS.entries()) {
    const info = LEVELS[index]!;
    for (const trial of trials) {
      const allowed = DUCK_ORDER.filter((kind) => trial.ducks?.includes(kind) ?? true);
      const names = allowed.map((kind) => DUCKS[kind].name).join(', ');

      it(`${trial.name} (level ${index + 1}) can be won on Easy by taking turns placing ${names} and upgrading`, () => {
        expect(play(info, 'easy', allowed, { challenge: trial, upgrades: 'place-first', craig: !trial.noCraig }).phase).toBe('won');
      });

      it(`${trial.name} (level ${index + 1}) can be won on Normal by a sensible team`, () => {
        // Sunnys or Potatoes alone, Potato with Curtis slowing things down for him, a team led
        // by Potato, or everyone who's playing: one of them should manage it.
        const only = (...team: DuckKind[]) => team.filter((kind) => allowed.includes(kind));
        const teams = [only('sunny'), only('potato'), only('potato', 'curtis'), only('potato', 'sunny', 'curtis', 'chester'), allowed].filter(
          (team) => team.length > 0,
        );
        const won = teams.some((team) => play(info, 'normal', team, { challenge: trial, upgrades: 'place-first', craig: !trial.noCraig }).phase === 'won');
        expect(won).toBe(true);
      });
    }
  }
});

describe('flock powers', () => {
  it('help: a team that taps its powers keeps more hearts on Hard than one that never does', () => {
    const team: DuckKind[] = ['potato', 'sunny', 'curtis', 'chester'];
    let withPowers = 0;
    let without = 0;
    for (const info of LEVELS) {
      withPowers += play(info, 'hard', team, { upgrades: 'place-first', craig: true, powers: true, step: 1 / 20 }).hearts;
      without += play(info, 'hard', team, { upgrades: 'place-first', craig: true, step: 1 / 20 }).hearts;
    }
    expect(withPowers).toBeGreaterThan(without);
  });
});

describe('the Skunk Patch trial', () => {
  it("can't be won on Normal by splashing alone, but a pecking team manages it", () => {
    const { trial, level } = findTrial('skunkPatch')!;
    const info = LEVELS[level]!;
    expect(play(info, 'normal', 'sunny', { challenge: trial, upgrades: 'place-first', craig: true }).phase).toBe('lost');
    expect(play(info, 'normal', ['potato', 'curtis'], { challenge: trial, upgrades: 'place-first', craig: true }).phase).toBe('won');
  });
});
