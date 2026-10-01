import { describe, expect, it } from 'vitest';
import { CRAIG } from '../data/craig';
import { BATTERY, FOUNTAIN, NIGHT } from '../data/dayNight';
import { DIFFICULTIES } from '../data/difficulty';
import { DUCKS, MOVE_SETTLE_TIME, SELL_REFUND } from '../data/ducks';
import { ENDLESS } from '../data/endless';
import { ENEMIES } from '../data/enemies';
import { EARLY_CALL, type Wave } from '../data/waves';
import {
  canUseBlessing,
  choosePerk,
  buyDuck,
  callNextWave,
  canCallEarly,
  createGame,
  earlyBonus,
  isNight,
  isSpotTaken,
  moveDuck,
  scheduleWave,
  sellDuck,
  setTargeting,
  wavePreview,
  sellValue,
  refundFor,
  scorePeas,
  upgradeDuck,
  startWave,
  update,
  useBlessing,
  type GameEvent,
} from './game';
import { makePath } from './path';

// A short straight path so predators arrive quickly.
const path = makePath([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
const oneRaccoon: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 25 };

function runUntilIdle(game: ReturnType<typeof createGame>): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < 10_000 && game.phase === 'wave'; i++) events.push(...update(game, 0.05));
  return events;
}

describe('game', () => {
  it('starts with the difficulty’s peas and hearts', () => {
    const game = createGame({ path }, [oneRaccoon], 'easy');
    expect(game.peas).toBe(DIFFICULTIES.easy.startingPeas);
    expect(game.hearts).toBe(DIFFICULTIES.easy.hearts);
  });

  it('makes predators slower on Easy', () => {
    const easy = createGame({ path }, [oneRaccoon], 'easy');
    startWave(easy);
    const [spawned] = update(easy, 0);
    expect(spawned).toMatchObject({ type: 'spawned' });
    expect(easy.battle.enemies[0]!.speed).toBe(ENEMIES.raccoon.speed * DIFFICULTIES.easy.enemySpeed);
  });

  it('spends peas to place a duck, and refuses when you can’t afford it', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    game.peas = DUCKS.sunny.cost + 5;
    expect(buyDuck(game, 'sunny', { x: 0, y: 50 })).toBeDefined();
    expect(game.peas).toBe(5);
    expect(buyDuck(game, 'sunny', { x: 0, y: 50 })).toBeUndefined();
    expect(game.battle.ducks).toHaveLength(1);
  });

  it('spaces out each group and sorts the whole wave by time', () => {
    const wave: Wave = {
      time: 'day',
      groups: [
        { enemy: 'raccoon', count: 2, every: 3 },
        { enemy: 'raccoon', count: 1, every: 1, after: 1 },
      ],
      bonusPeas: 0,
    };
    expect(scheduleWave(wave).map((s) => s.time)).toEqual([0, 1, 3]);
  });

  it('costs a heart when a predator reaches the house', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'normal');
    startWave(game);
    runUntilIdle(game);
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts - 1);
  });

  it('pays peas per chase-off plus the wave bonus, then waits for the next wave', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'normal');
    game.peas = 1000;
    buyDuck(game, 'sunny', { x: 100, y: 0 });
    buyDuck(game, 'sunny', { x: 100, y: 0 });
    buyDuck(game, 'sunny', { x: 100, y: 0 });
    const before = game.peas;
    startWave(game);
    const events = runUntilIdle(game);
    expect(events).toContainEqual({ type: 'waveCleared', waveIndex: 0, bonus: 25 });
    expect(game.peas).toBe(before + ENEMIES.raccoon.peas + 25);
    expect(game.phase).toBe('building');
    expect(game.waveIndex).toBe(1);
  });

  it('wins after the last wave is cleared', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    game.peas = 1000;
    for (let i = 0; i < 5; i++) buyDuck(game, 'sunny', { x: 100, y: 0 });
    startWave(game);
    expect(runUntilIdle(game)).toContainEqual({ type: 'won' });
    expect(game.phase).toBe('won');
  });

  it('loses when the hearts run out', () => {
    const lots: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 50, every: 0.1 }], bonusPeas: 0 };
    const game = createGame({ path }, [lots], 'normal');
    startWave(game);
    expect(runUntilIdle(game)).toContainEqual({ type: 'lost' });
    expect(game.hearts).toBe(0);
    expect(buyDuck(game, 'sunny', { x: 0, y: 0 })).toBeUndefined();
  });

  it('can only start a wave between waves', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'normal');
    expect(startWave(game)).toBe(true);
    expect(startWave(game)).toBe(false);
  });
});

describe('day, night, and the solar battery', () => {
  const nightRaccoon: Wave = { ...oneRaccoon, time: 'night' };
  const withFountain = { path, fountainAt: { x: 1000, y: 1000 } }; // far from the path

  it('charges in day waves even while the fountain runs', () => {
    const game = createGame(withFountain, [oneRaccoon], 'normal');
    startWave(game);
    update(game, 1);
    expect(game.battery).toBeCloseTo(BATTERY.startCharge + BATTERY.solarPerSecond - FOUNTAIN.drawPerSecond);
  });

  it('drains at night', () => {
    const game = createGame(withFountain, [nightRaccoon], 'normal');
    startWave(game);
    update(game, 1);
    expect(game.battery).toBeCloseTo(BATTERY.startCharge - FOUNTAIN.drawPerSecond);
  });

  it('turns the fountain off when the battery is empty', () => {
    const game = createGame(withFountain, [nightRaccoon], 'normal');
    startWave(game);
    game.battery = 0.01;
    update(game, 1);
    update(game, 0.1);
    expect(game.battery).toBe(0);
    expect(game.battle.fountain!.on).toBe(false);
  });

  it('sends faster predators in night waves', () => {
    const game = createGame({ path }, [oneRaccoon, nightRaccoon], 'normal');
    expect(isNight(game)).toBe(false);
    game.waveIndex = 1;
    expect(isNight(game)).toBe(true);
    startWave(game);
    update(game, 0);
    expect(game.battle.enemies[0]!.speed).toBe(ENEMIES.raccoon.speed * NIGHT.enemySpeed);
  });
});

describe("Craig's Guardian Blessing", () => {
  it('comes back every few waves in the Endless Pond, but never in a level', () => {
    const waves = Array.from({ length: ENDLESS.craigEvery + 1 }, () => oneRaccoon);
    for (const endless of [true, false]) {
      const game = createGame({ path }, waves, 'easy', undefined, endless);
      useBlessing(game);
      for (let w = 0; w < ENDLESS.craigEvery; w++) {
        expect(canUseBlessing(game)).toBe(false);
        if (game.perkChoice) choosePerk(game, game.perkChoice[0]!);
        startWave(game);
        runUntilIdle(game);
      }
      expect(game.waveIndex).toBe(ENDLESS.craigEvery);
      expect(canUseBlessing(game)).toBe(endless);
    }
  });

  it('can only be used once per level', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    expect(useBlessing(game)).toBe(true);
    expect(useBlessing(game)).toBe(false);
  });

  it('shoos predators away from the house without losing a heart', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    useBlessing(game);
    startWave(game);
    const events = runUntilIdle(game);
    expect(events.some((e) => e.type === 'shooed')).toBe(true);
    expect(events.some((e) => e.type === 'reachedHouse')).toBe(false);
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts);
  });

  it('wears off after a while', () => {
    const late: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 1, every: 1, after: CRAIG.shieldTime }], bonusPeas: 0 };
    const game = createGame({ path }, [late], 'normal');
    startWave(game);
    useBlessing(game);
    runUntilIdle(game);
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts - 1);
  });
});

describe('bosses', () => {
  it('cost more hearts when they reach the house', () => {
    const boss: Wave = { time: 'day', groups: [{ enemy: 'bandit', count: 1, every: 1 }], bonusPeas: 0 };
    const game = createGame({ path }, [boss, boss], 'normal');
    startWave(game);
    const arrived = runUntilIdle(game).filter((e) => e.type === 'reachedHouse');
    const bosses = arrived.filter((e) => e.type === 'reachedHouse' && e.enemy.kind === 'bandit').length;
    expect(bosses).toBe(1);
    // 5 hearts for the Bandit, 1 for each minion that also got in.
    expect(game.hearts).toBe(DIFFICULTIES.normal.hearts - ENEMIES.bandit.hearts - (arrived.length - bosses));
  });
});

describe('selling and moving ducks', () => {
  it('sells a duck for part of what it cost', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    startWave(game);
    const before = game.peas;
    expect(sellDuck(game, duck.id)).toBe(sellValue('sunny'));
    expect(sellValue('sunny')).toBe(Math.floor(DUCKS.sunny.cost * SELL_REFUND));
    expect(game.peas).toBe(before + sellValue('sunny'));
    expect(game.battle.ducks).toHaveLength(0);
  });

  it('gives every pea back for a duck placed since the last wave (upgrades too)', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const start = game.peas;
    const duck = buyDuck(game, 'curtis', { x: 0, y: 50 })!;
    upgradeDuck(game, duck.id);
    expect(refundFor(duck)).toBe(DUCKS.curtis.cost + DUCKS.curtis.upgrades[0].cost);
    sellDuck(game, duck.id);
    expect(game.peas).toBe(start);
  });

  it('only gives part back once a wave has started, or for a duck placed during a wave', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const early = buyDuck(game, 'curtis', { x: 0, y: 50 })!;
    startWave(game);
    const late = buyDuck(game, 'curtis', { x: 100, y: 50 })!;
    expect(refundFor(early)).toBe(sellValue('curtis'));
    expect(refundFor(late)).toBe(sellValue('curtis'));
  });

  it('counts peas spent on ducks toward the score, so selling never adds to it', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const start = scorePeas(game);
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    upgradeDuck(game, duck.id);
    expect(scorePeas(game)).toBe(start);
    startWave(game);
    sellDuck(game, duck.id);
    expect(scorePeas(game)).toBeLessThan(start);
  });

  it('frees the nest so another duck can go there', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const at = { x: 0, y: 50 };
    const duck = buyDuck(game, 'sunny', at)!;
    expect(isSpotTaken(game, at)).toBe(true);
    sellDuck(game, duck.id);
    expect(isSpotTaken(game, at)).toBe(false);
  });

  it('moves a duck to an empty spot', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    expect(moveDuck(game, duck.id, { x: 100, y: 50 })).toBe(true);
    expect(duck.position).toEqual({ x: 100, y: 50 });
  });

  it("won't move a duck onto another duck", () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const a = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    buyDuck(game, 'sunny', { x: 100, y: 50 });
    expect(moveDuck(game, a.id, { x: 100, y: 50 })).toBe(false);
    expect(a.position).toEqual({ x: 0, y: 50 });
  });

  it('makes a moved duck settle before it attacks again', () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    moveDuck(game, duck.id, { x: 100, y: 10 });
    startWave(game);
    const early = update(game, MOVE_SETTLE_TIME / 2);
    expect(early.some((e) => e.type === 'attack')).toBe(false);
  });

  it("can't sell or move after the level is over", () => {
    const game = createGame({ path }, [oneRaccoon], 'normal');
    const duck = buyDuck(game, 'sunny', { x: 0, y: 50 })!;
    game.phase = 'won';
    expect(sellDuck(game, duck.id)).toBeUndefined();
    expect(moveDuck(game, duck.id, { x: 100, y: 50 })).toBe(false);
  });
});

describe('targeting choices', () => {
  it('lets you change which predator a duck goes after', () => {
    const game = createGame({ path }, [oneRaccoon], 'easy');
    const duck = buyDuck(game, 'sunny', { x: 100, y: 50 })!;
    expect(setTargeting(game, duck.id, 'strong')).toBe(true);
    expect(duck.targeting).toBe('strong');
    expect(setTargeting(game, 999, 'last')).toBe(false);
  });
});

describe('wave preview', () => {
  const waves: Wave[] = [
    { time: 'day', groups: [{ enemy: 'raccoon', count: 3, every: 1 }], bonusPeas: 0 },
    {
      time: 'day',
      groups: [
        { enemy: 'raccoon', count: 2, every: 1, after: 4 },
        { enemy: 'fox', count: 2, every: 1 },
        { enemy: 'raccoon', count: 1, every: 1 },
      ],
      bonusPeas: 0,
    },
  ];

  it("counts each kind of predator in a wave, in the order they show up", () => {
    expect(wavePreview(waves, 1)).toEqual([
      { enemy: 'fox', count: 2, isNew: true },
      { enemy: 'raccoon', count: 3, isNew: false },
    ]);
  });

  it('marks predators new the first time they appear in the level', () => {
    expect(wavePreview(waves, 0)).toEqual([{ enemy: 'raccoon', count: 3, isNew: true }]);
  });

  it('is empty past the last wave', () => {
    expect(wavePreview(waves, 2)).toEqual([]);
  });
});

describe('calling the next wave early', () => {
  const twoRaccoons: Wave = { time: 'day', groups: [{ enemy: 'raccoon', count: 2, every: 0.5 }], bonusPeas: 40 };
  const nightWave: Wave = { time: 'night', groups: [{ enemy: 'raccoon', count: 1, every: 1 }], bonusPeas: 30 };
  const longPath = makePath([{ x: 0, y: 0 }, { x: 5000, y: 0 }]);

  it('only works once every predator in the wave has shown up, and there is a next wave', () => {
    const game = createGame({ path: longPath }, [twoRaccoons, nightWave], 'easy');
    expect(canCallEarly(game)).toBe(false); // still building
    startWave(game);
    update(game, 0.1);
    expect(canCallEarly(game)).toBe(false); // one raccoon still to come
    update(game, 0.5);
    expect(canCallEarly(game)).toBe(true);
    expect(earlyBonus(game)).toBe(2 * EARLY_CALL.peasPerPredator);
  });

  it("pays this wave's bonus plus the early bonus, and sends the next wave with the old one still out", () => {
    const game = createGame({ path: longPath }, [twoRaccoons, nightWave], 'easy');
    startWave(game);
    update(game, 0.6);
    const peas = game.peas;
    expect(callNextWave(game)).toBe(40 + 2 * EARLY_CALL.peasPerPredator);
    expect(game.peas).toBe(peas + 40 + 2 * EARLY_CALL.peasPerPredator);
    expect(game.waveIndex).toBe(1);
    expect(game.phase).toBe('wave');
    expect(game.battle.night).toBe(true);
    expect(game.battle.enemies).toHaveLength(2);
    expect(game.pending).toHaveLength(1);
  });

  it("can't be called on the last wave", () => {
    const game = createGame({ path: longPath }, [twoRaccoons], 'easy');
    startWave(game);
    update(game, 0.6);
    expect(canCallEarly(game)).toBe(false);
    expect(callNextWave(game)).toBeUndefined();
  });

  it('still wins once the last wave and everything left over are chased off', () => {
    const game = createGame({ path }, [oneRaccoon, oneRaccoon], 'easy');
    buyDuck(game, 'sunny', { x: 100, y: 30 });
    buyDuck(game, 'sunny', { x: 60, y: 30 });
    startWave(game);
    update(game, 0.01);
    callNextWave(game);
    const events = runUntilIdle(game);
    expect(game.phase).toBe('won');
    // The first wave's bonus was paid when it was called, so only the last wave reports clearing.
    expect(events.filter((e) => e.type === 'waveCleared')).toEqual([{ type: 'waveCleared', waveIndex: 1, bonus: 25 }]);
  });
});
