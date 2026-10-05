import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../data/difficulty';
import type { Wave } from '../data/waves';
import { createGame, scorePeas, type Game } from './game';
import { makePath } from './path';
import { emptyProgress, endlessBest, hasWonTrial, isUnlocked, levelRecord, recordEndless, recordWin, scoreFor, type Progress } from './progress';
import { endlessWavesSurvived, finishRun } from './run';

const path = makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 25 };

/** A game that's just ended, with the given hearts left (a win unless hearts is 0). */
function finished(hearts: number, options: { endless?: boolean; waves?: number; waveIndex?: number } = {}): Game {
  const game = createGame({ path }, Array.from({ length: options.waves ?? 3 }, () => wave), 'normal', undefined, options.endless);
  game.hearts = hearts;
  game.phase = hearts > 0 ? 'won' : 'lost';
  if (options.waveIndex !== undefined) game.waveIndex = options.waveIndex;
  return game;
}

describe('finishRun', () => {
  const level = { difficulty: 'normal' as const, level: 2 };

  it('scores a level win from hearts and peas and saves the stars and score', () => {
    const game = finished(DIFFICULTIES.normal.hearts);
    const { outcome, progress } = finishRun(game, level, emptyProgress());
    expect(outcome.won).toBe(true);
    expect(outcome.stars).toBe(3);
    expect(outcome.peas).toBe(scorePeas(game));
    expect(outcome.score).toBe(scoreFor(game.hearts, scorePeas(game), 'normal'));
    expect(levelRecord(progress, 'normal', 2)).toEqual({ stars: 3, bestScore: outcome.score });
    expect(isUnlocked(progress, 'normal', 3)).toBe(true);
  });

  it("a first score isn't a new best, but beating an earlier one is", () => {
    const game = finished(DIFFICULTIES.normal.hearts);
    expect(finishRun(game, level, emptyProgress()).outcome.newBest).toBe(false);
    const lower = recordWin(emptyProgress(), 'normal', 2, 1, 1);
    expect(finishRun(game, level, lower).outcome.newBest).toBe(true);
    const higher = recordWin(emptyProgress(), 'normal', 2, 3, 999_999);
    expect(finishRun(game, level, higher).outcome.newBest).toBe(false);
  });

  it('saves nothing for a loss', () => {
    const before = recordWin(emptyProgress(), 'normal', 0, 3, 500);
    const { outcome, progress } = finishRun(finished(0), level, before);
    expect(outcome.won).toBe(false);
    expect(outcome.score).toBeUndefined();
    expect(progress).toBe(before);
  });

  it('saves nothing in the Sandbox, win or lose', () => {
    const before = emptyProgress();
    const { outcome, progress } = finishRun(finished(99), { ...level, sandbox: true }, before);
    expect(outcome.sandbox).toBe(true);
    expect(outcome.score).toBeUndefined();
    expect(progress).toBe(before);
  });

  it('unlocks hats when the new stars cross a threshold', () => {
    // The Daisy needs 1 star: the first win anywhere earns it. A second win on the same level adds no stars.
    const first = finishRun(finished(DIFFICULTIES.normal.hearts), level, emptyProgress());
    expect(first.outcome.newHats).toContain('flower');
    const again = finishRun(finished(DIFFICULTIES.normal.hearts), level, first.progress);
    expect(again.outcome.newHats).toEqual([]);
  });

  it('a trial win earns its ribbon once and goes on no level record', () => {
    const mode = { ...level, trial: 'potatoPatrol' };
    const first = finishRun(finished(DIFFICULTIES.normal.hearts), mode, emptyProgress());
    expect(first.outcome.newRibbon).toBe(true);
    expect(first.outcome.score).toBeGreaterThan(0);
    expect(first.outcome.stars).toBeUndefined();
    expect(hasWonTrial(first.progress, 'normal', 'potatoPatrol')).toBe(true);
    expect(levelRecord(first.progress, 'normal', 2)).toBeUndefined();
    const again = finishRun(finished(DIFFICULTIES.normal.hearts), mode, first.progress);
    expect(again.outcome.newRibbon).toBe(false);
  });

  it('a Daily Challenge win is kept on its own and counts the streak', () => {
    const mode = { ...level, daily: '2026-10-05' };
    const { outcome, progress } = finishRun(finished(DIFFICULTIES.normal.hearts), mode, emptyProgress());
    expect(outcome.daily).toBe('2026-10-05');
    expect(outcome.streak).toBe(1);
    expect(levelRecord(progress, 'normal', 2)).toBeUndefined(); // doesn't unlock anything
    expect(progress.daily?.date).toBe('2026-10-05');
  });

  describe('Endless Pond', () => {
    const mode = { ...level, endless: true };

    it('counts the waves survived, not the one that got you', () => {
      expect(endlessWavesSurvived(finished(0, { endless: true, waveIndex: 7 }))).toBe(7);
      expect(endlessWavesSurvived(finished(5, { endless: true, waves: 9 }))).toBe(9);
    });

    it('saves the best waves and says when it is a new best', () => {
      const run = finishRun(finished(0, { endless: true, waveIndex: 7 }), mode, emptyProgress());
      expect(run.outcome.endlessWaves).toBe(7);
      expect(run.outcome.endlessBest).toBe(7);
      expect(run.outcome.newBest).toBe(false); // first run
      expect(endlessBest(run.progress, 'normal', 2)).toBe(7);

      const better = finishRun(finished(0, { endless: true, waveIndex: 10 }), mode, run.progress);
      expect(better.outcome.newBest).toBe(true);
      expect(better.outcome.endlessBest).toBe(10);

      const worse: Progress = recordEndless(emptyProgress(), 'normal', 2, 20);
      const short = finishRun(finished(0, { endless: true, waveIndex: 3 }), mode, worse);
      expect(short.outcome.newBest).toBe(false);
      expect(short.outcome.endlessBest).toBe(20);
      expect(endlessBest(short.progress, 'normal', 2)).toBe(20);
    });
  });
});
