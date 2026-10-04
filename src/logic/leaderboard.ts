import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import { isDifficulty, type Difficulty } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import { ENDLESS, endlessLevel } from '../data/endless';
import { findTrial } from '../data/trials';
import { challengeSettings, dailyFor, isPostableDate } from './daily';
import { scoreFor } from './progress';

// Rules for the public leaderboard, shared by the game and the server so both agree.

export const NAME_MAX_LENGTH = 12;
/** More peas than this (leftover plus spent on ducks) isn't possible in a real game. */
export const MAX_PEAS = 20_000;

const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Tidies a typed name and checks it's allowed on the public leaderboard. */
export function checkName(raw: string): NameCheck {
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: false, reason: 'Type a name first!' };
  if (name.length > NAME_MAX_LENGTH) return { ok: false, reason: `Names can be up to ${NAME_MAX_LENGTH} letters.` };
  if (!/^[A-Za-z0-9 ]+$/.test(name)) return { ok: false, reason: 'Just letters and numbers, please.' };
  // Check the name with its spaces taken out too, so "f u c k" doesn't slip past the filter.
  if (profanity.hasMatch(name) || profanity.hasMatch(name.replace(/ /g, ''))) {
    return { ok: false, reason: 'Try a different name.' };
  }
  return { ok: true, name };
}

export interface ScoreSubmission {
  name: string;
  level: number;
  difficulty: Difficulty;
  hearts: number;
  /** Peas left over plus peas spent on the ducks still out (scorePeas in game.ts). */
  peas: number;
  /** The Daily Challenge date (YYYY-MM-DD), for a daily score. Its level comes from the date. */
  daily?: string;
  /** The Level Trial's id, for a trial score. Its level comes from the trial. */
  trial?: string;
}

export type SubmissionCheck = { ok: true; entry: ScoreSubmission & { score: number } } | { ok: false; reason: string };

/** Validates a score someone wants to post, and works out the score itself (never trusting a sent one). */
export function checkSubmission(body: unknown, now: Date = new Date()): SubmissionCheck {
  if (typeof body !== 'object' || body === null) return { ok: false, reason: 'Bad request.' };
  const { name, difficulty, hearts, peas, daily, trial, endless, waves } = body as Record<string, unknown>;
  let { level } = body as Record<string, unknown>;
  const nameCheck = checkName(typeof name === 'string' ? name : '');
  if (!nameCheck.ok) return nameCheck;
  if (!isDifficulty(difficulty)) return { ok: false, reason: 'Unknown difficulty.' };

  // An Endless Pond run: the score is how many waves were survived, on the map's own board.
  if (endless === true) {
    if (!Number.isInteger(waves) || (waves as number) < 1 || (waves as number) > ENDLESS.maxWaves) {
      return { ok: false, reason: 'That score is not possible.' };
    }
    const map = level === undefined ? 0 : level;
    if (!Number.isInteger(map) || (map as number) < 0 || (map as number) >= LEVEL_COUNT) return { ok: false, reason: 'Unknown level.' };
    const entry: ScoreSubmission = { name: nameCheck.name, level: endlessLevel(map as number), difficulty, hearts: 0, peas: 0 };
    return { ok: true, entry: { ...entry, score: waves as number } };
  }

  // A Daily Challenge score: only for today (or yesterday), and the date decides the level and twist.
  const today = daily === undefined ? undefined : typeof daily === 'string' ? dailyFor(daily) : undefined;
  if (daily !== undefined && (!today || !isPostableDate(today.date, now))) {
    return { ok: false, reason: "That Daily Challenge is over. Try today's!" };
  }
  if (today) level = today.level;

  // A Level Trial score: the trial decides the level and twist (and it can't also be a daily).
  const found = trial === undefined ? undefined : typeof trial === 'string' ? findTrial(trial) : undefined;
  if (trial !== undefined && (!found || today)) return { ok: false, reason: 'Unknown trial.' };
  if (found) level = found.level;
  const twist = today?.challenge ?? found?.trial;

  if (!Number.isInteger(level) || (level as number) < 0 || (level as number) >= LEVEL_COUNT) {
    return { ok: false, reason: 'Unknown level.' };
  }
  const maxHearts = challengeSettings(difficulty, twist).hearts;
  if (!Number.isInteger(hearts) || (hearts as number) < 1 || (hearts as number) > maxHearts) {
    return { ok: false, reason: 'That score is not possible.' };
  }
  if (!Number.isInteger(peas) || (peas as number) < 0 || (peas as number) > MAX_PEAS) {
    return { ok: false, reason: 'That score is not possible.' };
  }
  const entry: ScoreSubmission = {
    name: nameCheck.name,
    level: level as number,
    difficulty,
    hearts: hearts as number,
    peas: peas as number,
    ...(today && { daily: today.date }),
    ...(found && { trial: found.trial.id }),
  };
  return { ok: true, entry: { ...entry, score: scoreFor(entry.hearts, entry.peas, entry.difficulty) } };
}
