import type { Difficulty } from '../data/difficulty';
import type { HatKind } from '../data/hats';
import { scorePeas, type Game } from './game';
import { newlyUnlocked, totalEarned } from './hats';
import {
  dailyRecord,
  dailyStreak,
  endlessBest,
  hasWonTrial,
  levelRecord,
  recordDailyWin,
  recordEndless,
  recordTrialWin,
  recordWin,
  scoreFor,
  starsFor,
  type Progress,
} from './progress';

// What happens when a game ends: the result to show, and what to save. Pure rules, no Phaser,
// so the "new best", ribbon, streak, and new-hat rules can be tested.

/** How a game was set up: which level, and which of the ways to play it (at most one is set). */
export interface RunMode {
  difficulty: Difficulty;
  /** Index into LEVELS. */
  level: number;
  /** The Daily Challenge's date (YYYY-MM-DD), if that's what was played. */
  daily?: string;
  /** The Level Trial's id, if that's what was played. */
  trial?: string;
  /** The Endless Pond on this level's map. */
  endless?: boolean;
  /** The Sandbox: nothing is saved. */
  sandbox?: boolean;
}

/** The result screen's facts about a finished game. */
export interface RunOutcome {
  won: boolean;
  difficulty: Difficulty;
  level: number;
  stars?: number; // only for a win
  score?: number;
  newBest?: boolean; // beat an earlier best (a first score isn't a "new best")
  hearts?: number; // hearts left and peas that count (see scorePeas), for posting to the leaderboard
  peas?: number;
  daily?: string; // the Daily Challenge date, if that's what was played
  trial?: string; // the Level Trial's id, if that's what was played
  sandbox?: boolean; // the Sandbox: nothing was saved
  newRibbon?: boolean; // a trial won for the first time on this difficulty
  streak?: number; // Daily Challenges won on days in a row, counting this one
  newHats?: HatKind[]; // hats this win unlocked
  endlessWaves?: number; // for an Endless Pond run: waves survived
  endlessBest?: number; // and the most ever survived on this difficulty
}

/** An Endless Pond run's score: the waves survived (the one that got you doesn't count). */
export function endlessWavesSurvived(game: Game): number {
  return game.phase === 'won' ? game.waves.length : game.waveIndex;
}

/**
 * Works out the result of a finished game and the progress to save.
 * - Sandbox: nothing is saved.
 * - Endless: the waves survived go on the map's record.
 * - A trial win earns its ribbon (ribbons can unlock hats); its score goes on the trial's board.
 * - A level win unlocks the next level and keeps the best stars and score; a Daily win is
 *   kept on its own and extends the streak. New stars can unlock hats.
 * A loss outside Endless saves nothing.
 */
export function finishRun(game: Game, mode: RunMode, progress: Progress): { outcome: RunOutcome; progress: Progress } {
  const won = game.phase === 'won';
  const outcome: RunOutcome = {
    won,
    difficulty: mode.difficulty,
    level: mode.level,
    daily: mode.daily,
    trial: mode.trial,
    sandbox: mode.sandbox,
  };
  if (mode.sandbox) return { outcome, progress };

  if (mode.endless) {
    const waves = endlessWavesSurvived(game);
    const previousBest = endlessBest(progress, mode.difficulty, mode.level);
    outcome.endlessWaves = waves;
    outcome.newBest = previousBest > 0 && waves > previousBest;
    outcome.endlessBest = Math.max(previousBest, waves);
    return { outcome, progress: recordEndless(progress, mode.difficulty, mode.level, waves) };
  }

  if (!won) return { outcome, progress };

  outcome.hearts = game.hearts;
  outcome.peas = scorePeas(game);
  outcome.score = scoreFor(game.hearts, outcome.peas, mode.difficulty);

  let saved: Progress;
  if (mode.trial) {
    outcome.newRibbon = !hasWonTrial(progress, mode.difficulty, mode.trial);
    saved = recordTrialWin(progress, mode.difficulty, mode.trial);
  } else {
    outcome.stars = starsFor(game.hearts, game.maxHearts);
    const previous = mode.daily ? dailyRecord(progress, mode.daily, mode.difficulty) : levelRecord(progress, mode.difficulty, mode.level);
    const previousBest = previous?.bestScore ?? 0;
    outcome.newBest = previousBest > 0 && outcome.score > previousBest;
    saved = mode.daily
      ? recordDailyWin(progress, mode.daily, mode.difficulty, outcome.stars, outcome.score)
      : recordWin(progress, mode.difficulty, mode.level, outcome.stars, outcome.score);
    if (mode.daily) outcome.streak = dailyStreak(saved, mode.daily);
  }
  outcome.newHats = newlyUnlocked(totalEarned(progress), totalEarned(saved));
  return { outcome, progress: saved };
}
