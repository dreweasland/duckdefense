import { describe, expect, it } from 'vitest';
import { DUCKS } from '../data/ducks';
import { ENDLESS } from '../data/endless';
import { ENEMIES } from '../data/enemies';
import { BOSS_PRICKLE, PERK_CHOICES, PERK_ORDER, PERKS } from '../data/perks';
import type { Wave } from '../data/waves';
import { createBattle, duckStats, enemyPosition, placeDuck, spawnEnemy, step } from './battle';
import { callNextWave, canUseBlessing, choosePerk, createGame, startWave, update, useBlessing } from './game';
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

describe('boss rewards', () => {
  const rewards = PERK_ORDER.filter((id) => PERKS[id].boss);
  const straight = () => createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { sky: [{ x: 0, y: -400 }] });

  it('are offered after a boss wave instead of the usual perks, until every one is taken', () => {
    expect(rewards.length).toBeGreaterThanOrEqual(PERK_CHOICES);
    for (const id of offerPerks({}, 10, true)) expect(PERKS[id].boss).toBe(true);
    for (const id of offerPerks({}, 10)) expect(PERKS[id].boss).toBeUndefined();
    const oneLeft = Object.fromEntries(rewards.slice(1).map((id) => [id, 1]));
    expect(offerPerks(oneLeft, 20, true)).toEqual([rewards[0]]);
    const allTaken = Object.fromEntries(rewards.map((id) => [id, 1]));
    const offer = offerPerks(allTaken, 20, true);
    expect(offer).toHaveLength(PERK_CHOICES);
    for (const id of offer) expect(PERKS[id].boss).toBeUndefined();
  });

  it('come up in a game after the first boss wave (wave 10)', () => {
    const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 40 };
    const game = createGame({ path: makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]) }, Array.from({ length: 12 }, () => wave), 'easy', undefined, true);
    placeDuck(game.battle, 'sunny', { x: 100, y: 30 });
    for (let w = 0; w < 10; w++) {
      if (game.perkChoice) {
        for (const id of game.perkChoice) expect(PERKS[id].boss).toBeUndefined();
        choosePerk(game, game.perkChoice[0]!);
      }
      startWave(game);
      for (let i = 0; i < 2000 && game.phase === 'wave'; i++) update(game, 0.05);
    }
    expect(game.waveIndex).toBe(10);
    for (const id of game.perkChoice!) expect(PERKS[id].boss).toBe(true);
  });

  it('Soggy Splash: predators Sunny splashes are soaked and slower for a while', () => {
    const battle = straight();
    battle.mods = perkMods({ soggySplash: 1 });
    placeDuck(battle, 'sunny', { x: 1000, y: 20 });
    const raccoon = spawnEnemy(battle, 'raccoon');
    raccoon.distance = 1000;
    step(battle, 0);
    expect(raccoon.soakedTime).toBe(PERKS.soggySplash.effect.soak!.time);
    step(battle, 0.1);
    expect(raccoon.distance).toBeCloseTo(1000 + raccoon.speed * PERKS.soggySplash.effect.soak!.speed * 0.1);
  });

  it('Sky Quack: Chester\'s quack blows hawks backward', () => {
    const battle = straight();
    battle.mods = perkMods({ skyQuack: 1 });
    const hawk = spawnEnemy(battle, 'hawk');
    hawk.distance = 300;
    const at = enemyPosition(hawk);
    placeDuck(battle, 'chester', { x: at.x + 100, y: at.y }); // in reach, but too far for the hawk to scare him
    step(battle, 0);
    expect(hawk.distance).toBeCloseTo(300 - PERKS.skyQuack.effect.quackPush!);
  });

  it('Prickly Curtis: predators in his zone lose a share of their full health (bosses much less)', () => {
    const battle = straight();
    battle.mods = perkMods({ pricklyCurtis: 1 });
    const curtis = placeDuck(battle, 'curtis', { x: 1000, y: 20 });
    curtis.cooldown = 99; // no pecking, so only the prickles count
    const raccoon = spawnEnemy(battle, 'raccoon');
    const bandit = spawnEnemy(battle, 'bandit');
    raccoon.distance = bandit.distance = 1000;
    step(battle, 1);
    const share = PERKS.pricklyCurtis.effect.prickle!;
    expect(raccoon.hp).toBeCloseTo(ENEMIES.raccoon.maxHp * (1 - share));
    expect(bandit.hp).toBeCloseTo(ENEMIES.bandit.maxHp * (1 - share * BOSS_PRICKLE));
    expect(curtis.report.damage).toBeCloseTo(ENEMIES.raccoon.maxHp * share + ENEMIES.bandit.maxHp * share * BOSS_PRICKLE);
  });

  it('Dizzy Flap: a flapped predator is frozen for a moment', () => {
    const battle = straight();
    battle.mods = perkMods({ dizzyFlap: 1 });
    const potato = placeDuck(battle, 'potato', { x: 1000, y: 20 });
    potato.attacks = DUCKS.potato.wingFlap!.everyNthAttack - 1; // the next peck is a flap
    const turtle = spawnEnemy(battle, 'raccoon');
    turtle.distance = 1000;
    turtle.hp = turtle.maxHp = 10_000;
    step(battle, 0);
    expect(turtle.stopTime).toBeCloseTo(PERKS.dizzyFlap.effect.flapStun!);
  });

  it("Craig's Watch: her blessing comes back sooner", () => {
    const wave: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 40 };
    const game = createGame({ path: makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]) }, Array.from({ length: 12 }, () => wave), 'easy', undefined, true);
    const every = PERKS.craigsWatch.effect.craigEvery!;
    expect(every).toBeLessThan(ENDLESS.craigEvery);
    game.perkChoice = ['craigsWatch'];
    choosePerk(game, 'craigsWatch');
    useBlessing(game);
    game.waveIndex = every - 1;
    startWave(game);
    for (let i = 0; i < 2000 && game.phase === 'wave'; i++) update(game, 0.05);
    if (game.perkChoice) choosePerk(game, game.perkChoice[0]!);
    expect(game.waveIndex).toBe(every);
    expect(canUseBlessing(game)).toBe(true);
  });

  it('New Nests: turns on the extra nests', () => {
    expect(perkMods({}).bonusNests).toBe(0);
    expect(perkMods({ newNests: 1 }).bonusNests).toBe(1);
  });
});
