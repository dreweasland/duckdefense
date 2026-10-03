import { describe, expect, it } from 'vitest';
import { HAT_ORDER, HATS } from '../data/hats';
import { LEVEL_COUNT } from '../data/levelCount';
import { TRIALS } from '../data/trials';
import { hatFor, isHatUnlocked, newlyUnlocked, totalEarned, totalRibbons, totalStars, wearHat } from './hats';
import { emptyProgress, parseProgress, recordDailyWin, recordTrialWin, recordWin } from './progress';

const earned = (stars: number, ribbons = 0) => ({ stars, ribbons });

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

  it('unlocks hats as stars are earned, and the crown needs every star', () => {
    expect(isHatUnlocked('party', earned(0))).toBe(true);
    expect(newlyUnlocked(earned(4), earned(7))).toEqual(HAT_ORDER.filter((h) => !HATS[h].ribbons && HATS[h].stars > 4 && HATS[h].stars <= 7));
    expect(Math.max(...Object.values(HATS).map((h) => h.stars))).toBe(LEVEL_COUNT * 3 * 2);
  });

  it('counts Level Trial ribbons, which unlock the laurel wreath', () => {
    let progress = withStars();
    expect(totalRibbons(progress)).toBe(0);
    progress = recordTrialWin(progress, 'easy', TRIALS[0]![0]!.id);
    progress = recordTrialWin(progress, 'normal', TRIALS[0]![0]!.id);
    expect(totalEarned(progress)).toEqual({ stars: 6, ribbons: 2 });
    expect(isHatUnlocked('laurel', earned(36, HATS.laurel.ribbons! - 1))).toBe(false);
    expect(isHatUnlocked('laurel', earned(0, HATS.laurel.ribbons!))).toBe(true);
    expect(newlyUnlocked(earned(0, 11), earned(0, 12))).toEqual(['laurel']);
    expect(HATS.laurel.ribbons).toBeLessThanOrEqual(TRIALS.flat().length * 2);
  });

  it('lists star hats cheapest first, starting with a free one, then the ribbon hats', () => {
    const starHats = HAT_ORDER.filter((h) => !HATS[h].ribbons);
    const costs = starHats.map((h) => HATS[h].stars);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(costs[0]).toBe(0);
    expect(HAT_ORDER.slice(starHats.length).every((h) => HATS[h].ribbons)).toBe(true);
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
