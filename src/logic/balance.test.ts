// Balance checks: play level 1 with a simple strategy and make sure the
// difficulty still feels right. If you tune numbers in src/data/ and one of
// these fails, the level probably got too easy or too hard.
import { describe, expect, it } from 'vitest';
import level1 from '../../maps/level1.tmj?raw';
import type { Difficulty } from '../data/difficulty';
import { DUCKS, type DuckKind } from '../data/ducks';
import { LEVEL1_WAVES } from '../data/waves';
import { buyDuck, canBuy, createGame, isOver, startWave, update, type Game } from './game';
import { distance, type Point } from './geometry';
import { parseLevel } from './level';
import { makePath, pointAt } from './path';

const level = parseLevel(level1);
const path = makePath(level.path);

/** Slots sorted so the ones that can see the most path come first. */
function bestSlots(range: number): Point[] {
  const coverage = (slot: Point) => {
    let seen = 0;
    for (let d = 0; d <= path.length; d += 10) if (distance(slot, pointAt(path, d)) <= range) seen++;
    return seen;
  };
  return [...level.slots].sort((a, b) => coverage(b) - coverage(a));
}

/** Before each wave, fill the best empty slots with `kind` until out of peas. */
function play(difficulty: Difficulty, kind: DuckKind | null): Game {
  const game = createGame(path, LEVEL1_WAVES, difficulty);
  const slots = bestSlots(kind ? DUCKS[kind].range : 0);
  while (!isOver(game)) {
    while (kind && slots.length > 0 && canBuy(game, kind)) buyDuck(game, kind, slots.shift()!);
    startWave(game);
    for (let i = 0; i < 100_000 && game.phase === 'wave'; i++) update(game, 1 / 30);
  }
  return game;
}

describe('level 1 balance', () => {
  it('Easy can be won just by placing Sunnys in good spots', () => {
    expect(play('easy', 'sunny').phase).toBe('won');
  });

  it('Normal can be won just by placing Sunnys in good spots', () => {
    expect(play('normal', 'sunny').phase).toBe('won');
  });

  it('Normal is lost if you place no ducks', () => {
    expect(play('normal', null).phase).toBe('lost');
  });
});
