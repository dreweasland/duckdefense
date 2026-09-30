// Kept in its own file so this long simulation runs alongside the other tests.
import { describe, expect, it } from 'vitest';
import { ENDLESS } from '../data/endless';
import { LEVELS } from '../data/levels';
import { endlessWaves } from './endless';
import { play } from './simulate';

describe('Endless Pond extras balance', () => {
  it('lasts much longer when spare peas go on training and fixing the duck house, but still ends', () => {
    // On Easy, where a player runs out of things to buy (Normal usually ends before that).
    // This player stands in for a strong one: if it reaches wave 60, Endless got too easy
    // (tougher waves or more Bandits in src/data/endless.ts will fix it).
    const info = { ...LEVELS[ENDLESS.level]!, waves: endlessWaves() };
    const common = { upgrades: 'place-first', endless: true, step: 1 / 10 } as const;
    const plain = play(info, 'easy', 'sunny', common).waveIndex;
    const extras = play(info, 'easy', 'sunny', { ...common, extras: true, maxWaves: 60 }).waveIndex;
    expect(extras).toBeGreaterThan(plain * 1.3);
    expect(extras).toBeLessThan(60);
  }, 60_000);
});
