// The Duck Defense Worker: serves the game (static assets) and a small leaderboard API.
//
//   GET    /api/scores?level=0&difficulty=easy          top scores for a level
//   GET    /api/scores?daily=2026-09-29&difficulty=easy top scores for a Daily Challenge
//   GET    /api/scores?endless=1&difficulty=easy        most Endless Pond waves survived
//   POST   /api/scores                                  post a win { name, level, difficulty, hearts, peas, daily? }
//                                                       or an Endless Pond run { name, difficulty, endless: true, waves }
//   DELETE /api/scores/:id                       remove an entry (needs the ADMIN_TOKEN secret)

import { checkSubmission } from '../src/logic/leaderboard';
import { LEVEL_COUNT } from '../src/data/levelCount';
import { ENDLESS_LEVEL } from '../src/data/endless';
import { dailyFor } from '../src/logic/daily';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Set with `npx wrangler secret put ADMIN_TOKEN`. Without it, deleting is turned off. */
  ADMIN_TOKEN?: string;
}

const TOP_SCORES = 10;
// Each player (by IP) can post at most this many scores per this many seconds.
const RATE_LIMIT = { max: 3, seconds: 60 };
const MAX_BODY_BYTES = 1000;

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
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function listScores(url: URL, env: Env): Promise<Response> {
  const difficulty = url.searchParams.get('difficulty');
  if (difficulty !== 'easy' && difficulty !== 'normal') return json({ error: 'Unknown difficulty.' }, 400);

  const dailyParam = url.searchParams.get('daily');
  if (dailyParam !== null) {
    const daily = dailyFor(dailyParam);
    if (!daily) return json({ error: 'Unknown day.' }, 400);
    const { results } = await env.DB.prepare(
      `SELECT id, name, score, hearts, created_at AS createdAt FROM scores
       WHERE daily = ? AND difficulty = ?
       ORDER BY score DESC, created_at ASC
       LIMIT ?`,
    )
      .bind(daily.date, difficulty, TOP_SCORES)
      .all();
    return json({ scores: results });
  }

  // Endless Pond runs are stored under their own level number.
  const level = url.searchParams.get('endless') === '1' ? ENDLESS_LEVEL : Number(url.searchParams.get('level'));
  const realLevel = Number.isInteger(level) && level >= 0 && level < LEVEL_COUNT;
  if (!realLevel && level !== ENDLESS_LEVEL) return json({ error: 'Unknown level.' }, 400);
  const { results } = await env.DB.prepare(
    `SELECT id, name, score, hearts, created_at AS createdAt FROM scores
     WHERE level = ? AND difficulty = ? AND daily IS NULL
     ORDER BY score DESC, created_at ASC
     LIMIT ?`,
  )
    .bind(level, difficulty, TOP_SCORES)
    .all();
  return json({ scores: results });
}

async function postScore(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return json({ error: 'Too big.' }, 413);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const check = checkSubmission(body);
  if (!check.ok) return json({ error: check.reason }, 400);
  const { entry } = check;

  const ipHash = await hash(`duckdefense:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`);
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM scores WHERE ip_hash = ? AND created_at > datetime('now', ?)`,
  )
    .bind(ipHash, `-${RATE_LIMIT.seconds} seconds`)
    .first<{ count: number }>();
  if ((recent?.count ?? 0) >= RATE_LIMIT.max) {
    return json({ error: 'Slow down! Try again in a minute.' }, 429);
  }

  const daily = entry.daily ?? null;
  const inserted = await env.DB.prepare(
    `INSERT INTO scores (name, level, difficulty, hearts, peas, score, ip_hash, daily)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(entry.name, entry.level, entry.difficulty, entry.hearts, entry.peas, entry.score, ipHash, daily)
    .first<{ id: number }>();
  // Rank among scores on the same board: this level's, or this day's Daily Challenge.
  const better = await env.DB.prepare(
    daily === null
      ? `SELECT COUNT(*) AS count FROM scores WHERE level = ? AND difficulty = ? AND daily IS NULL AND score > ?`
      : `SELECT COUNT(*) AS count FROM scores WHERE daily = ? AND difficulty = ? AND score > ?`,
  )
    .bind(daily ?? entry.level, entry.difficulty, entry.score)
    .first<{ count: number }>();
  return json({ id: inserted?.id, name: entry.name, score: entry.score, rank: (better?.count ?? 0) + 1 }, 201);
}

async function deleteScore(id: number, request: Request, env: Env): Promise<Response> {
  // Without a configured token (or with the wrong one), act like the route doesn't exist.
  if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json({ error: 'Not found.' }, 404);
  }
  const result = await env.DB.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
  return json({ deleted: result.meta.changes });
}

async function hash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
