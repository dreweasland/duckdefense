// Balance checks: play each level with a simple strategy and make sure the
// difficulty still feels right. If you tune numbers in src/data/ and one of
// these fails, the level probably got too easy or too hard.
import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../data/challenges';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { LEVELS } from '../data/levels';
import { TRIALS } from '../data/trials';
import { play } from './simulate';

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

    it('Hard can be won by a sensible team, upgrading with spare peas and calling Craig for the last wave', () => {
      const teams: DuckKind[][] = [['sunny'], ['potato'], ['sunny', 'curtis'], ['potato', 'curtis'], ['potato', 'sunny', 'curtis', 'chester'], ['sunny', 'potato']];
      const won = teams.some((team) => play(info, 'hard', team, { upgrades: 'place-first', craig: true }).phase === 'won');
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
