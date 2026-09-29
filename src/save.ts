import { parseProgress, type Progress } from './logic/progress';

// Progress is kept in this browser's localStorage. Storage can be blocked (private
// browsing, some embedded views), so every access is wrapped and failures are ignored.

const KEY = 'duckdefense.progress';

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(KEY));
  } catch {
    return parseProgress(null);
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Not saved this time; the game still works.
  }
}
