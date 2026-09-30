import { describe, expect, it } from 'vitest';
import { DUCKS } from '../data/ducks';
import { ENDLESS } from '../data/endless';
import { ENEMIES } from '../data/enemies';
import { PERK_CHOICES, PERKS } from '../data/perks';
import type { Wave } from '../data/waves';
import { createBattle, duckStats, placeDuck, spawnEnemy, step } from './battle';
import { callNextWave, choosePerk, createGame, startWave, update } from './game';
import { makePath } from './path';
import { NO_MODS, offerPerks, perkMods } from './perks';

describe('Pond Perk multipliers', () => {
  it('start with no change, and stack when a perk is picked again', () => {
    expect(perkMods({})).toEqual(NO_MODS);
    const mods = perkMods({ sharpBeaks: 2, braveFlock: 1, stickyMud: 2 });
    expect(mods.damage).toBeCloseTo(1 + 2 * PERKS.sharpBeaks.effect.damage!);
    expect(mods.scare).toBeCloseTo(0.5);
    expect(mods.slow).toBeCloseTo((1 - PERKS.stickyMud.effect.slow!) ** 2);
  });

  it('change what ducks can do in battle', () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]));
    const sunny = placeDuck(battle, 'sunny', { x: 1000, y: 20 });
    battle.mods = perkMods({ longNecks: 1, quickWings: 1, sharpBeaks: 1 });
    const stats = duckStats(battle, sunny);
    expect(stats.range).toBeCloseTo(DUCKS.sunny.range * 1.08);
    expect(stats.attackInterval).toBeCloseTo(DUCKS.sunny.attackInterval / 1.08);
    const raccoon = spawnEnemy(battle, 'raccoon');
    raccoon.distance = 1000;
    step(battle, 0);
    expect(raccoon.hp).toBeCloseTo(ENEMIES.raccoon.maxHp - DUCKS.sunny.damage * 1.1);
  });

  it('make ducks hit harder at night with Night Owls', () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]));
    battle.night = true;
    battle.mods = perkMods({ nightOwls: 1 });
    placeDuck(battle, 'potato', { x: 1000, y: 20 });
    const raccoon = spawnEnemy(battle, 'raccoon');
    raccoon.distance = 1000;
    step(battle, 0);
    expect(raccoon.hp).toBeCloseTo(ENEMIES.raccoon.maxHp - DUCKS.potato.damage * 1.2);
  });
});

describe('Pond Perk offers', () => {
  it('give the same choices for the same wave, and different choices on other waves', () => {
    expect(offerPerks({}, 5)).toEqual(offerPerks({}, 5));
    expect(offerPerks({}, 5)).toHaveLength(PERK_CHOICES);
    const offers = new Set([5, 10, 15, 20, 25].map((w) => offerPerks({}, w).join()));
    expect(offers.size).toBeGreaterThan(1);
  });

  it("don't offer a perk that's been picked the most times it can be", () => {
    for (let wave = 5; wave <= 100; wave += 5) expect(offerPerks({ braveFlock: 1 }, wave)).not.toContain('braveFlock');
  });
});

describe('Pond Perks in the Endless Pond', () => {
  const path = makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
  const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 40 };
  const waves = Array.from({ length: 12 }, () => wave);
  const endlessGame = () => createGame({ path }, waves, 'easy', undefined, true);

  /** Plays waves until one is offering perks (with a duck that chases everything off). */
  function reachOffer() {
    const game = endlessGame();
    game.peas = 1000;
    placeDuck(game.battle, 'sunny', { x: 100, y: 30 });
    for (let w = 0; w < ENDLESS.perkEvery; w++) {
      startWave(game);
      for (let i = 0; i < 2000 && game.phase === 'wave'; i++) update(game, 0.05);
    }
    return game;
  }

  it(`offer perks after every ${ENDLESS.perkEvery}th wave, and wait for a pick before the next wave`, () => {
    const game = reachOffer();
    expect(game.waveIndex).toBe(ENDLESS.perkEvery);
    expect(game.perkChoice).toHaveLength(PERK_CHOICES);
    expect(startWave(game)).toBe(false);
    expect(choosePerk(game, game.perkChoice![0]!)).toBe(true);
    expect(game.perkChoice).toBeUndefined();
    expect(startWave(game)).toBe(true);
  });

  it('only let you pick a perk that is on offer', () => {
    const game = reachOffer();
    const notOffered = (Object.keys(PERKS) as (keyof typeof PERKS)[]).find((id) => !game.perkChoice!.includes(id))!;
    expect(choosePerk(game, notOffered)).toBe(false);
  });

  it('apply one-time perks straight away: hearts (and room to fix them) and peas', () => {
    const game = endlessGame();
    game.perkChoice = ['patchedRoof', 'peaPile'];
    const { hearts, maxHearts } = game;
    choosePerk(game, 'patchedRoof');
    expect(game.hearts).toBe(hearts + 3);
    expect(game.maxHearts).toBe(maxHearts + 3);
    game.perkChoice = ['peaPile'];
    const peas = game.peas;
    choosePerk(game, 'peaPile');
    expect(game.peas).toBe(peas + 300);
  });

  it('are offered when calling a wave early passes a perk wave too', () => {
    const game = endlessGame();
    game.waveIndex = ENDLESS.perkEvery - 1;
    startWave(game);
    update(game, 0.01);
    callNextWave(game);
    expect(game.perkChoice).toHaveLength(PERK_CHOICES);
  });

  it("don't happen outside the Endless Pond", () => {
    const game = createGame({ path }, waves, 'easy');
    placeDuck(game.battle, 'sunny', { x: 100, y: 30 });
    for (let w = 0; w < ENDLESS.perkEvery; w++) {
      startWave(game);
      for (let i = 0; i < 2000 && game.phase === 'wave'; i++) update(game, 0.05);
    }
    expect(game.perkChoice).toBeUndefined();
  });
});
