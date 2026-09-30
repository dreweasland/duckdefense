// Kept in its own file so this long simulation runs alongside the other tests.
import { describe, expect, it } from 'vitest';
import { ENDLESS } from '../data/endless';
import { LEVELS } from '../data/levels';
import { endlessWaves } from './endless';
import { play } from './simulate';

describe('Endless Pond extras balance', () => {
  it('lasts longer when spare peas go on training and fixing the duck house, but still ends', () => {
    // On Easy, where a player runs out of things to buy (Normal usually ends before that).
    // Without extras, the same player lasts 15 to 80 waves (see endless.test.ts).
    const info = { ...LEVELS[ENDLESS.level]!, waves: endlessWaves() };
    // Bigger simulation steps keep this long run quick.
    const plain = play(info, 'easy', 'sunny', { upgrades: 'place-first', endless: true, step: 1 / 10 }).waveIndex;
    const extras = play(info, 'easy', 'sunny', { upgrades: 'place-first', endless: true, extras: true, step: 1 / 10 }).waveIndex;
    expect(extras).toBeGreaterThan(plain * 1.3);
    expect(extras).toBeLessThan(120);
  }, 120_000);
});
