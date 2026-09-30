import { describe, expect, it } from 'vitest';
import { HAT_ORDER, HATS } from '../data/hats';
import { LEVEL_COUNT } from '../data/levelCount';
import { hatFor, isHatUnlocked, newlyUnlocked, totalStars, wearHat } from './hats';
import { emptyProgress, parseProgress, recordDailyWin, recordWin } from './progress';

function withStars(): ReturnType<typeof emptyProgress> {
  let progress = recordWin(emptyProgress(), 'easy', 0, 3, 100);
  progress = recordWin(progress, 'easy', 1, 2, 100);
  progress = recordWin(progress, 'normal', 0, 1, 100);
  return recordDailyWin(progress, '2026-09-29', 'easy', 3, 100); // dailies don't count
}

describe('hats', () => {
  it('counts stars from every level and difficulty', () => {
    expect(totalStars(emptyProgress())).toBe(0);
    expect(totalStars(withStars())).toBe(6);
  });

  it('unlocks hats as stars are earned, and the last one needs every star', () => {
    expect(isHatUnlocked('party', 0)).toBe(true);
    expect(newlyUnlocked(4, 7)).toEqual(HAT_ORDER.filter((h) => HATS[h].stars > 4 && HATS[h].stars <= 7));
    expect(Math.max(...Object.values(HATS).map((h) => h.stars))).toBe(LEVEL_COUNT * 3 * 2);
  });

  it('lists hats cheapest first, starting with a free one', () => {
    const costs = HAT_ORDER.map((h) => HATS[h].stars);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(costs[0]).toBe(0);
  });

  it('lets a duck wear an unlocked hat, but not a locked one', () => {
    let progress = wearHat(withStars(), 'sunny', 'bow');
    expect(hatFor(progress, 'sunny')).toBe('bow');
    progress = wearHat(progress, 'potato', 'wizard');
    expect(hatFor(progress, 'potato')).toBeUndefined();
    progress = wearHat(progress, 'sunny', undefined);
    expect(hatFor(progress, 'sunny')).toBeUndefined();
  });

  it('are saved with progress, ignoring hats that no longer exist', () => {
    const progress = wearHat(withStars(), 'chester', 'party');
    expect(parseProgress(JSON.stringify(progress)).hats).toEqual({ chester: 'party' });
    expect(parseProgress(JSON.stringify({ hats: { sunny: 'sombrero', curtis: 'flower' } })).hats).toEqual({ curtis: 'flower' });
  });
});
