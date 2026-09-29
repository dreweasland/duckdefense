// Balance checks: play each level with a simple strategy and make sure the
// difficulty still feels right. If you tune numbers in src/data/ and one of
// these fails, the level probably got too easy or too hard.
import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../data/difficulty';
import { DUCKS, type DuckKind } from '../data/ducks';
import { LEVELS, type LevelInfo } from '../data/levels';
import { buyDuck, canBuy, createGame, isOver, mapFromLevel, startWave, update, useBlessing, type Game } from './game';
import { distance, type Point } from './geometry';
import { parseLevel } from './level';
import { makePath, pointAt } from './path';

/** Slots sorted so the ones that can see the most of every predator route come first. */
function bestSlots(info: LevelInfo, range: number): Point[] {
  const level = parseLevel(info.map);
  const house = level.path[level.path.length - 1]!;
  // The ground path, plus a hawk's line from each sky point.
  // Like a real player, care about the ground path first (most predators walk).
  const routes = [
    { path: makePath(level.path), weight: 2 },
    ...level.sky.map((from) => ({ path: makePath([from, house]), weight: 1 })),
  ];
  const coverage = (slot: Point) => {
    let seen = 0;
    for (const { path, weight } of routes) {
      for (let d = 0; d <= path.length; d += 10) if (distance(slot, pointAt(path, d)) <= range) seen += weight;
    }
    return seen;
  };
  return [...level.slots].sort((a, b) => coverage(b) - coverage(a));
}

/**
 * Before each wave, fill the best empty slots with `kind` until out of peas.
 * Optionally call Craig for the last wave.
 */
export function play(info: LevelInfo, difficulty: Difficulty, kind: DuckKind | null, craig = false): Game {
  const game = createGame(mapFromLevel(parseLevel(info.map)), info.waves, difficulty);
  const slots = bestSlots(info, kind ? DUCKS[kind].range : 0);
  while (!isOver(game)) {
    while (kind && slots.length > 0 && canBuy(game, kind)) buyDuck(game, kind, slots.shift()!);
    if (craig && game.waveIndex === game.waves.length - 1) useBlessing(game);
    startWave(game);
    for (let i = 0; i < 200_000 && game.phase === 'wave'; i++) update(game, 1 / 30);
  }
  return game;
}

for (const [index, info] of LEVELS.entries()) {
  describe(`level ${index + 1} balance: ${info.name}`, () => {
    it('Easy can be won just by placing Sunnys in good spots', () => {
      expect(play(info, 'easy', 'sunny').phase).toBe('won');
    });

    it('Normal can be won with Sunnys in good spots and Craig for the last wave', () => {
      expect(play(info, 'normal', 'sunny', true).phase).toBe('won');
    });

    it('Normal is lost if you place no ducks', () => {
      expect(play(info, 'normal', null).phase).toBe('lost');
    });
  });
}
