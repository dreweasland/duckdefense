import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { LEVEL_COUNT } from '../data/levelCount';
import { scoreFor } from './progress';

// Rules for the public leaderboard, shared by the game and the server so both agree.

export const NAME_MAX_LENGTH = 12;
/** More leftover peas than this isn't possible in a real game. */
export const MAX_PEAS = 20_000;

const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Tidies a typed name and checks it's allowed on the public leaderboard. */
export function checkName(raw: string): NameCheck {
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: false, reason: 'Type a name first!' };
  if (name.length > NAME_MAX_LENGTH) return { ok: false, reason: `Names can be up to ${NAME_MAX_LENGTH} letters.` };
  if (!/^[A-Za-z0-9 ]+$/.test(name)) return { ok: false, reason: 'Just letters and numbers, please.' };
  if (profanity.hasMatch(name)) return { ok: false, reason: 'Try a different name.' };
  return { ok: true, name };
}

export interface ScoreSubmission {
  name: string;
  level: number;
  difficulty: Difficulty;
  hearts: number;
  peas: number;
}

export type SubmissionCheck = { ok: true; entry: ScoreSubmission & { score: number } } | { ok: false; reason: string };

/** Validates a score someone wants to post, and works out the score itself (never trusting a sent one). */
export function checkSubmission(body: unknown): SubmissionCheck {
  if (typeof body !== 'object' || body === null) return { ok: false, reason: 'Bad request.' };
  const { name, level, difficulty, hearts, peas } = body as Record<string, unknown>;
  const nameCheck = checkName(typeof name === 'string' ? name : '');
  if (!nameCheck.ok) return nameCheck;
  if (difficulty !== 'easy' && difficulty !== 'normal') return { ok: false, reason: 'Unknown difficulty.' };
  if (!Number.isInteger(level) || (level as number) < 0 || (level as number) >= LEVEL_COUNT) {
    return { ok: false, reason: 'Unknown level.' };
  }
  const maxHearts = DIFFICULTIES[difficulty].hearts;
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
  };
  return { ok: true, entry: { ...entry, score: scoreFor(entry.hearts, entry.peas, entry.difficulty) } };
}
