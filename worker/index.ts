// The Duck Defense Worker: serves the game (static assets) and a small leaderboard API.
//
//   GET    /api/scores?level=0&difficulty=easy          top scores for a level
//   GET    /api/scores?daily=2026-09-29&difficulty=easy top scores for a Daily Challenge
//   GET    /api/scores?endless=1&level=0&difficulty=easy most Endless Pond waves survived on a map
//   GET    /api/scores?trial=potatoPatrol&difficulty=easy top scores for a Level Trial
//   POST   /api/scores                                  post a win { name, level, difficulty, hearts, peas, daily? | trial? }
//                                                       or an Endless Pond run { name, difficulty, endless: true, level, waves }
//   DELETE /api/scores/:id                       remove an entry (needs the ADMIN_TOKEN secret)

import { checkSubmission, rateLimitKey } from '../src/logic/leaderboard';
import { LEVEL_COUNT } from '../src/data/levelCount';
import { endlessLevel, endlessMap } from '../src/data/endless';
import { dailyFor } from '../src/logic/daily';
import { isDifficulty } from '../src/data/difficulty';
import { findTrial } from '../src/data/trials';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Set with `npx wrangler secret put ADMIN_TOKEN`. Without it, deleting is turned off. */
  ADMIN_TOKEN?: string;
}

const TOP_SCORES = 10;
// Each player (by IP) can post at most this many scores per this many seconds.
const RATE_LIMIT = { max: 3, seconds: 60 };
// The hashed address is only needed for the rate limit, so it's wiped from rows older than this.
const KEEP_IP_HASH = '-1 day';
const MAX_BODY_BYTES = 1000;
// The rows on one board: a level's scores, one day's Daily Challenge scores, or a Level Trial's.
const BOARD_FILTER = { level: 'level = ? AND daily IS NULL AND trial IS NULL', daily: 'daily = ?', trial: 'trial = ?' } as const;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/scores') {
        if (request.method === 'GET') return await listScores(url, env);
        if (request.method === 'POST') return await postScore(request, env);
        return json({ error: 'Method not allowed.' }, 405);
      }
      const remove = url.pathname.match(/^\/api\/scores\/(\d+)$/);
      if (remove && request.method === 'DELETE') return await deleteScore(Number(remove[1]), request, env);
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: 'Something went wrong. Try again later.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function listScores(url: URL, env: Env): Promise<Response> {
  const difficulty = url.searchParams.get('difficulty');
  if (!isDifficulty(difficulty)) return json({ error: 'Unknown difficulty.' }, 400);

  // Which board: a day's Daily Challenge, a Level Trial, or a level's (Endless Pond runs have their own level number).
  let board: { column: 'daily' | 'trial'; value: string } | { column: 'level'; value: number };
  const dailyParam = url.searchParams.get('daily');
  const trialParam = url.searchParams.get('trial');
  if (dailyParam !== null) {
    const daily = dailyFor(dailyParam);
    if (!daily) return json({ error: 'Unknown day.' }, 400);
    board = { column: 'daily', value: daily.date };
  } else if (trialParam !== null) {
    if (!findTrial(trialParam)) return json({ error: 'Unknown trial.' }, 400);
    board = { column: 'trial', value: trialParam };
  } else {
    const sent = Number(url.searchParams.get('level') ?? 0);
    const level = url.searchParams.get('endless') === '1' ? endlessLevel(sent) : sent;
    const realLevel = Number.isInteger(level) && level >= 0 && level < LEVEL_COUNT;
    if (!realLevel && endlessMap(level) === undefined) return json({ error: 'Unknown level.' }, 400);
    board = { column: 'level', value: level };
  }
  const { results } = await env.DB.prepare(
    `SELECT id, name, score, hearts, created_at AS createdAt FROM scores
     WHERE ${BOARD_FILTER[board.column]} AND difficulty = ?
     ORDER BY score DESC, created_at ASC
     LIMIT ?`,
  )
    .bind(board.value, difficulty, TOP_SCORES)
    .all();
  return json({ scores: results });
}

async function postScore(request: Request, env: Env): Promise<Response> {
  // Only the game posts here. A browser on another site can still send a request (it can't
  // read the answer, but it would spend the player's rate limit), so turn those away: the
  // browser says where a request came from, and the game always sends JSON.
  const site = request.headers.get('Sec-Fetch-Site');
  if (site !== null && site !== 'same-origin' && site !== 'none') return json({ error: 'Not allowed.' }, 403);
  if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'Send JSON.' }, 415);
  }
  const text = await readBody(request, MAX_BODY_BYTES);
  if (text === undefined) return json({ error: 'Too big.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const check = checkSubmission(body);
  if (!check.ok) return json({ error: check.reason }, 400);
  const { entry } = check;

  const ipHash = await hash(`duckdefense:${rateLimitKey(request.headers.get('CF-Connecting-IP') ?? 'unknown')}`);
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM scores WHERE ip_hash = ? AND created_at > datetime('now', ?)`,
  )
    .bind(ipHash, `-${RATE_LIMIT.seconds} seconds`)
    .first<{ count: number }>();
  if ((recent?.count ?? 0) >= RATE_LIMIT.max) {
    return json({ error: 'Slow down! Try again in a minute.' }, 429);
  }

  // Old rows don't need their address hash any more; drop it while we're here.
  await env.DB.prepare(`UPDATE scores SET ip_hash = '' WHERE ip_hash != '' AND created_at < datetime('now', ?)`).bind(KEEP_IP_HASH).run();

  const daily = entry.daily ?? null;
  const trial = entry.trial ?? null;
  const inserted = await env.DB.prepare(
    `INSERT INTO scores (name, level, difficulty, hearts, peas, score, ip_hash, daily, trial)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(entry.name, entry.level, entry.difficulty, entry.hearts, entry.peas, entry.score, ipHash, daily, trial)
    .first<{ id: number }>();
  // Rank among scores on the same board: this level's, this day's Daily Challenge, or this trial's.
  const board = daily !== null ? 'daily' : trial !== null ? 'trial' : 'level';
  const better = await env.DB.prepare(`SELECT COUNT(*) AS count FROM scores WHERE ${BOARD_FILTER[board]} AND difficulty = ? AND score > ?`)
    .bind(daily ?? trial ?? entry.level, entry.difficulty, entry.score)
    .first<{ count: number }>();
  return json({ id: inserted?.id, name: entry.name, score: entry.score, rank: (better?.count ?? 0) + 1 }, 201);
}

async function deleteScore(id: number, request: Request, env: Env): Promise<Response> {
  // Without a configured token (or with the wrong one), act like the route doesn't exist.
  const sent = request.headers.get('Authorization') ?? '';
  if (!env.ADMIN_TOKEN || !(await sameSecret(sent, `Bearer ${env.ADMIN_TOKEN}`))) {
    return json({ error: 'Not found.' }, 404);
  }
  const result = await env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
  return json({ deleted: result.meta.changes });
}

/**
 * Reads a request's body as text, or undefined if it's more than `maxBytes`. Stops reading
 * as soon as it's too big (the Content-Length header can be missing or wrong, so it isn't trusted).
 */
async function readBody(request: Request, maxBytes: number): Promise<string | undefined> {
  if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) return undefined;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maxBytes) return undefined;
    text += decoder.decode(value, { stream: true });
  }
}

async function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

async function hash(text: string): Promise<string> {
  return [...new Uint8Array(await sha256(text))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two secrets without giving away (by how long it takes) how much of a guess was right. */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256(a), sha256(b)]);
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}
