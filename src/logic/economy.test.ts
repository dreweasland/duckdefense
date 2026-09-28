import { describe, expect, it } from 'vitest';
import { canAfford, startingPeas } from './economy';

describe('economy', () => {
  it('gives Easy Mode more starting peas than Normal', () => {
    expect(startingPeas('easy')).toBeGreaterThan(startingPeas('normal'));
  });

  it('can afford a duck with exactly enough peas', () => {
    expect(canAfford(100, 100)).toBe(true);
  });

  it('cannot afford a duck with too few peas', () => {
    expect(canAfford(99, 100)).toBe(false);
  });
});
