import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import type { Challenge } from '../data/challenges';
import { isDifficulty, type Difficulty } from '../data/difficulty';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { LEVEL_COUNT } from '../data/levelCount';
import { VARIANTS, type VariantKind } from '../data/variants';
import { EARLY_CALL, LEVEL_WAVES } from '../data/waves';
import { ENDLESS, endlessLevel } from '../data/endless';
import { findTrial } from '../data/trials';
import { challengeSettings, challengeWaves, dailyFor, isPostableDate } from './daily';
import { scoreFor } from './progress';

// Rules for the public leaderboard, shared by the game and the server so both agree.

export const NAME_MAX_LENGTH = 12;

/**
 * How long a boss is allowed to stay alive calling in minions when working out the most
 * peas a level can pay. Minions pay peas too, and a boss keeps whistling until it's beaten
 * or gets in, so there's no hard limit; five minutes is far longer than any real fight.
 */
export const BOSS_TIME_ALLOWANCE = 300;

/**
 * The most peas a level can possibly pay out (so the most that can count toward a score):
 * the starting peas, every predator's reward (with its variant's bonus), every wave bonus,
 * the early-call bonus for every predator, and the minions a boss could call in
 * BOSS_TIME_ALLOWANCE seconds. A posted score with more peas than this was made up.
 */
export function maxPeasFor(level: number, difficulty: Difficulty, twist?: Challenge): number {
  const waves = challengeWaves(LEVEL_WAVES[level] ?? [], twist);
  const settings = challengeSettings(difficulty, twist);
  const reward = (kind: EnemyKind, variant?: VariantKind) =>
    Math.round(ENEMIES[kind].peas * (variant ? VARIANTS[variant].peas : 1) * settings.peas) + EARLY_CALL.peasPerPredator;
  let peas = settings.startingPeas;
  for (const wave of waves) {
    peas += Math.round(wave.bonusPeas * settings.peas);
    for (const group of wave.groups) {
      peas += group.count * reward(group.enemy, group.variant);
      const stats = ENEMIES[group.enemy];
      const summons = [stats.summons, stats.phase?.summons].filter((s) => s !== undefined);
      if (summons.length) {
        // The faster of the boss's two whistling rates, for the whole allowance.
        const perSecond = Math.max(...summons.map((s) => s.count / s.every));
        const minion = summons[0]!.enemy;
        peas += group.count * Math.ceil(perSecond * BOSS_TIME_ALLOWANCE) * reward(minion);
      }
    }
  }
  return peas;
}

const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

/**
 * What the server's rate limit counts posts by. An IPv4 address is one player; an IPv6
 * player gets a whole /64 block of addresses to pick from, so only its first half counts.
 */
export function rateLimitKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  // Expand "::" so there are always 8 groups, then keep the first 4.
  const [head = '', tail = ''] = ip.split('::');
  const front = head ? head.split(':') : [];
  const back = tail ? tail.split(':') : [];
  const groups = [...front, ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back];
  return groups
    .slice(0, 4)
    .map((g) => g.toLowerCase().replace(/^0+(?=\w)/, ''))
    .join(':');
}

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
  if (!Number.isInteger(peas) || (peas as number) < 0 || (peas as number) > maxPeasFor(level as number, difficulty, twist)) {
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
