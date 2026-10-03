import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../data/difficulty';
import type { HintId } from '../data/hints';
import type { Wave } from '../data/waves';
import { buyDuck, createGame, useBlessing } from './game';
import { pickHint } from './hints';
import { makePath } from './path';

const path = makePath([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 0 };
const none = new Set<HintId>();

function game() {
  return createGame({ path, sky: [{ x: 0, y: -100 }] }, [wave], 'easy');
}

describe("Craig's hints", () => {
  it('tells a new player to place a duck, but only if they have none', () => {
    const g = game();
    expect(pickHint(g, 'easy', { type: 'noDucksYet' }, 5, none)).toBe('placeFirstDuck');
    buyDuck(g, 'sunny', { x: 100, y: 50 });
    expect(pickHint(g, 'easy', { type: 'noDucksYet' }, 5, none)).toBeUndefined();
  });

  it('suggests calling Craig when hearts are low and her blessing is unused', () => {
    const g = game();
    g.hearts = DIFFICULTIES.easy.hearts / 2;
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'raccoon' }, 5, none)).toBe('callCraig');
    useBlessing(g);
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'raccoon' }, 5, none)).not.toBe('callCraig');
  });

  it('names the duck that beats the predator that got in, unless one is already out', () => {
    const g = game();
    buyDuck(g, 'chester', { x: 100, y: 50 });
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'hawk' }, 5, none)).toBe('hawks');
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'turtle' }, 5, none)).toBe('turtles');
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'mink' }, 5, none)).not.toBe('minks'); // Chester's out
    buyDuck(g, 'potato', { x: 300, y: 50 });
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'hawk' }, 5, none)).not.toBe('hawks');
  });

  it("doesn't name a duck that's staying home today (a Daily Challenge or trial)", () => {
    const g = createGame({ path, sky: [{ x: 0, y: -100 }] }, [wave], 'easy', { name: 'x', description: 'x', ducks: ['potato', 'chester'] });
    buyDuck(g, 'chester', { x: 100, y: 50 });
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'turtle' }, 5, none)).not.toBe('turtles'); // Sunny's home
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'hawk' }, 5, none)).toBe('hawks'); // Potato could still help
  });

  it('falls back to general tips: spend peas, upgrade, the Pecking Loop, then bends', () => {
    const g = game();
    buyDuck(g, 'sunny', { x: 100, y: 50 });
    buyDuck(g, 'chester', { x: 900, y: 50 }); // far from Sunny, so no Pecking Loop
    const lost = { type: 'heartLost', enemy: 'raccoon' } as const;
    expect(pickHint(g, 'easy', lost, 3, none)).toBe('spendPeas');
    expect(pickHint(g, 'easy', lost, 0, none)).toBe('powers'); // a power hasn't been tried yet
    g.powers = { sunny: 0, chester: 0 }; // both tried
    expect(pickHint(g, 'easy', lost, 0, none)).toBe('upgrade');
    g.peas = 0;
    expect(pickHint(g, 'easy', lost, 0, none)).toBe('peckingLoop');
    g.battle.ducks[1]!.position = { x: 150, y: 50 };
    expect(pickHint(g, 'easy', lost, 0, none)).toBe('bends');
  });

  it('never repeats a hint that was already shown', () => {
    const g = game();
    const shown = new Set<HintId>(['spendPeas', 'bends']);
    expect(pickHint(g, 'easy', { type: 'heartLost', enemy: 'raccoon' }, 5, shown)).toBeUndefined();
  });
});
