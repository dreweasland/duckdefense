import type { Difficulty } from './data/difficulty';

// Talks to the leaderboard API in the Worker (worker/index.ts).

export interface ScoreRow {
  id: number;
  name: string;
  score: number;
  hearts: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    const body = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) return { ok: false, error: body.error ?? "Couldn't reach the leaderboard." };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: "Couldn't reach the leaderboard. Are you online?" };
  } finally {
    clearTimeout(timer);
  }
}

/** Which leaderboard: a level's, a day's Daily Challenge (YYYY-MM-DD), a Level Trial's (its id), or the Endless Pond. */
export type Board = { level: number } | { daily: string } | { trial: string } | { endless: true };

export async function fetchScores(board: Board, difficulty: Difficulty): Promise<ApiResult<ScoreRow[]>> {
  const query =
    'daily' in board
      ? `daily=${encodeURIComponent(board.daily)}`
      : 'trial' in board
        ? `trial=${encodeURIComponent(board.trial)}`
        : 'endless' in board
          ? 'endless=1'
          : `level=${board.level}`;
  const result = await request<{ scores: ScoreRow[] }>(`/api/scores?${query}&difficulty=${difficulty}`);
  return result.ok ? { ok: true, data: result.data.scores } : result;
}

export async function postScore(
  entry:
    | { name: string; level: number; difficulty: Difficulty; hearts: number; peas: number; daily?: string; trial?: string }
    | { name: string; difficulty: Difficulty; endless: true; waves: number },
): Promise<ApiResult<{ id: number; score: number; rank: number }>> {
  return request('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}
