import { describe, expect, it } from 'vitest';
import { DUCKS, FREEZE_RECOVERY } from '../data/ducks';
import { ENEMIES } from '../data/enemies';
import { ENDLESS } from '../data/endless';
import { FOUNTAIN, NIGHT } from '../data/dayNight';
import { PECKING_LOOP } from '../data/synergy';
import { attackInterval, createBattle, topDuck, damageTo, enemyPosition, isFlying, isHidden, isRefreshed, placeDuck, spawnEnemy, step, type BattleEvent } from './battle';
import { statsAt } from './upgrades';
import { perkMods } from './perks';
import { makePath } from './path';

const sunny = DUCKS.sunny;
const raccoon = ENEMIES.raccoon;

// A straight path along y = 0, from x = 0 to x = 2000.
function newBattle() {
  return createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]));
}

describe('battle', () => {
  it('moves predators along the path at their speed', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    step(battle, 2);
    expect(enemy.distance).toBe(raccoon.speed * 2);
  });

  it('removes a predator when it reaches the house', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1999;
    const events = step(battle, 1);
    expect(events).toContainEqual({ type: 'reachedHouse', enemy });
    expect(battle.enemies).toHaveLength(0);
  });

  it('hits a predator in range', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    placeDuck(battle, 'sunny', { x: 0, y: sunny.range - 10 });
    step(battle, 0);
    expect(enemy.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it('ignores a predator out of range', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    placeDuck(battle, 'sunny', { x: 0, y: sunny.range + 10 });
    step(battle, 0);
    expect(enemy.hp).toBe(raccoon.maxHp);
  });

  it('waits for its cooldown between attacks', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    placeDuck(battle, 'sunny', { x: 0, y: 0 });
    step(battle, 0);
    step(battle, sunny.attackInterval / 2);
    expect(enemy.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it('targets the predator closest to the house', () => {
    const battle = newBattle();
    const behind = spawnEnemy(battle, 'raccoon');
    const ahead = spawnEnemy(battle, 'raccoon');
    behind.distance = 100;
    ahead.distance = 100 + sunny.splashRadius + 10; // too far apart to share a splash
    placeDuck(battle, 'sunny', { x: 110, y: 0 });
    step(battle, 0);
    expect(ahead.hp).toBe(raccoon.maxHp - sunny.damage);
    expect(behind.hp).toBe(raccoon.maxHp);
  });

  it('splashes predators right next to the target', () => {
    const battle = newBattle();
    const target = spawnEnemy(battle, 'raccoon');
    const neighbor = spawnEnemy(battle, 'raccoon');
    target.distance = 100;
    neighbor.distance = 100 - sunny.splashRadius / 2;
    placeDuck(battle, 'sunny', { x: 100, y: 0 });
    step(battle, 0);
    expect(neighbor.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it('chases off a predator once its health runs out', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    const duck = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    const events: BattleEvent[] = [];
    // Freeze time and let Sunny attack every step, so the raccoon can't walk out of range.
    for (let i = 0; i < 100 && battle.enemies.length > 0; i++) {
      duck.cooldown = 0;
      events.push(...step(battle, 0));
    }
    expect(events).toContainEqual(expect.objectContaining({ type: 'defeated', enemy }));
    expect(battle.enemies).toHaveLength(0);
  });
});

describe('duck abilities', () => {
  it("Potato's Wing Flap knocks the target back on every Nth hit", () => {
    const { wingFlap, attackInterval } = DUCKS.potato;
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 500;
    enemy.speed = 0; // hold still so only the knockback moves it
    placeDuck(battle, 'potato', { x: 500, y: 0 });
    const flaps: boolean[] = [];
    for (let i = 0; i < wingFlap!.everyNthAttack; i++) {
      for (const e of step(battle, attackInterval)) if (e.type === 'attack') flaps.push(e.wingFlap);
    }
    expect(flaps.at(-1)).toBe(true);
    expect(flaps.slice(0, -1).every((f) => !f)).toBe(true);
    expect(enemy.distance).toBe(500 - wingFlap!.pushBack);
  });

  it("Chester's Alarm Quack freezes every predator in range", () => {
    const { alarmQuack } = DUCKS.chester;
    const battle = newBattle();
    const near = spawnEnemy(battle, 'raccoon');
    const alsoNear = spawnEnemy(battle, 'raccoon');
    const far = spawnEnemy(battle, 'raccoon');
    near.distance = 100;
    alsoNear.distance = 150;
    far.distance = 1000;
    placeDuck(battle, 'chester', { x: 120, y: 0 });
    const events = step(battle, 0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'alarmQuack', stunnedIds: [near.id, alsoNear.id] }));

    // Frozen predators don't move; the far one keeps walking.
    step(battle, alarmQuack!.stunTime / 2);
    expect(near.distance).toBe(100);
    expect(far.distance).toBeGreaterThan(1000);
  });

  it('Chester waits for his cooldown before quacking again', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 100;
    placeDuck(battle, 'chester', { x: 100, y: 0 });
    step(battle, 0);
    const events = step(battle, DUCKS.chester.alarmQuack!.cooldown / 2);
    expect(events.some((e) => e.type === 'alarmQuack')).toBe(false);
  });

  it('Curtis slows ground predators near him (and never gets scared)', () => {
    const { slowZone } = DUCKS.curtis;
    expect(DUCKS.curtis.fearless).toBe(true);
    const battle = newBattle();
    const near = spawnEnemy(battle, 'raccoon');
    const far = spawnEnemy(battle, 'raccoon');
    near.distance = 100;
    far.distance = 1000;
    placeDuck(battle, 'curtis', { x: 100, y: 0 });
    step(battle, 1);
    expect(near.slowed).toBe(true);
    expect(near.distance).toBeCloseTo(100 + raccoon.speed * slowZone!.slow);
    expect(far.distance).toBeCloseTo(1000 + raccoon.speed);
  });
});

describe('hawks', () => {
  // The house is at (2000, 0). Hawks enter from above it.
  function skyBattle() {
    return createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), {
      sky: [{ x: 2000, y: -500 }, { x: 1500, y: 0 }],
    });
  }

  it('fly in a straight line from a sky point to the house', () => {
    const hawk = spawnEnemy(skyBattle(), 'hawk');
    expect(enemyPosition(hawk)).toEqual({ x: 2000, y: -500 });
    expect(hawk.path.length).toBe(500);
  });

  it('take turns entering from each sky point', () => {
    const battle = skyBattle();
    spawnEnemy(battle, 'hawk');
    expect(enemyPosition(spawnEnemy(battle, 'hawk'))).toEqual({ x: 1500, y: 0 });
  });

  it('need a sky layer on the map', () => {
    expect(() => spawnEnemy(newBattle(), 'hawk')).toThrow('"sky"');
  });

  // Ducks sit just outside a hawk's scare radius here, so the scare doesn't get in the way.
  const nearHawk = { x: 2100, y: -500 };

  it('are hit by ducks that can hit flyers', () => {
    const battle = skyBattle();
    const hawk = spawnEnemy(battle, 'hawk');
    placeDuck(battle, 'sunny', nearHawk);
    step(battle, 0);
    expect(hawk.hp).toBe(ENEMIES.hawk.maxHp - sunny.damage);
  });

  it("can't be pecked by Curtis", () => {
    const battle = skyBattle();
    const hawk = spawnEnemy(battle, 'hawk');
    placeDuck(battle, 'curtis', nearHawk);
    const events = step(battle, 0);
    expect(hawk.hp).toBe(ENEMIES.hawk.maxHp);
    expect(events.some((e) => e.type === 'attack')).toBe(false);
  });

  it("are still stunned by Chester's Alarm Quack", () => {
    const battle = skyBattle();
    const hawk = spawnEnemy(battle, 'hawk');
    placeDuck(battle, 'chester', nearHawk);
    const events = step(battle, 0);
    expect(hawk.hp).toBe(ENEMIES.hawk.maxHp); // no peck
    expect(events).toContainEqual(expect.objectContaining({ type: 'alarmQuack', stunnedIds: [hawk.id] }));
  });

  it("fly over Curtis's slow zone", () => {
    const battle = skyBattle();
    const hawk = spawnEnemy(battle, 'hawk');
    placeDuck(battle, 'curtis', nearHawk);
    step(battle, 1);
    expect(hawk.slowed).toBe(false);
    expect(hawk.distance).toBe(ENEMIES.hawk.speed);
  });
});

describe('fountain', () => {
  // A raccoon standing still next to a Sunny; the fountain is at (0, 0).
  function fountainBattle(on: boolean, duckAt = { x: 100, y: 0 }) {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { fountainAt: { x: 0, y: 0 } });
    battle.fountain!.on = on;
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = duckAt.x;
    enemy.speed = 0;
    const duck = placeDuck(battle, 'sunny', duckAt);
    return { battle, enemy, duck };
  }

  it('makes ducks in its spray hit harder while it has power', () => {
    const { battle, enemy, duck } = fountainBattle(true);
    expect(isRefreshed(battle, duck)).toBe(true);
    step(battle, 0);
    expect(enemy.hp).toBeCloseTo(raccoon.maxHp - sunny.damage * (1 + FOUNTAIN.damageBoost));
  });

  it('does nothing without power', () => {
    const { battle, enemy } = fountainBattle(false);
    step(battle, 0);
    expect(enemy.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it("doesn't reach ducks outside its spray", () => {
    const { battle, enemy, duck } = fountainBattle(true, { x: FOUNTAIN.range + 50, y: 0 });
    expect(isRefreshed(battle, duck)).toBe(false);
    step(battle, 0);
    expect(enemy.hp).toBe(raccoon.maxHp - sunny.damage);
  });

  it("doesn't slow predators (that's Curtis's job)", () => {
    const { battle, enemy } = fountainBattle(true);
    enemy.speed = raccoon.speed;
    step(battle, 1);
    expect(enemy.slowed).toBe(false);
    expect(enemy.distance).toBe(100 + raccoon.speed);
  });
});

describe('night', () => {
  it('makes predators faster', () => {
    const battle = newBattle();
    battle.night = true;
    expect(spawnEnemy(battle, 'raccoon').speed).toBe(raccoon.speed * NIGHT.enemySpeed);
  });
});

describe('Pecking Loop', () => {
  const near = PECKING_LOOP.nearDistance - 10;
  const far = PECKING_LOOP.nearDistance + 10;
  const faster = (kind: 'sunny' | 'potato') => DUCKS[kind].attackInterval / (1 + PECKING_LOOP.attackSpeedBonus);

  it('makes Sunny faster next to Chester', () => {
    const battle = newBattle();
    const s = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    placeDuck(battle, 'chester', { x: near, y: 0 });
    expect(attackInterval(battle, s)).toBeCloseTo(faster('sunny'));
  });

  it('makes Potato faster next to Sunny', () => {
    const battle = newBattle();
    const p = placeDuck(battle, 'potato', { x: 0, y: 0 });
    placeDuck(battle, 'sunny', { x: near, y: 0 });
    expect(attackInterval(battle, p)).toBeCloseTo(faster('potato'));
  });

  it('only counts ducks that are near', () => {
    const battle = newBattle();
    const s = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    placeDuck(battle, 'chester', { x: far, y: 0 });
    expect(attackInterval(battle, s)).toBe(sunny.attackInterval);
  });

  it("doesn't go backwards: Chester and Sunny's chasers get nothing from being chased", () => {
    const battle = newBattle();
    const c = placeDuck(battle, 'chester', { x: 0, y: 0 });
    const s = placeDuck(battle, 'sunny', { x: near, y: 0 });
    expect(attackInterval(battle, c)).toBe(DUCKS.chester.attackInterval);
    placeDuck(battle, 'potato', { x: 0, y: near });
    expect(attackInterval(battle, s)).toBeCloseTo(faster('sunny')); // from Chester, not Potato
  });

  it('Curtis ignores everyone', () => {
    const battle = newBattle();
    const c = placeDuck(battle, 'curtis', { x: 0, y: 0 });
    for (const kind of ['sunny', 'potato', 'chester'] as const) placeDuck(battle, kind, { x: near, y: 0 });
    expect(attackInterval(battle, c)).toBe(DUCKS.curtis.attackInterval);
  });

  it('is used for the real cooldown after an attack', () => {
    const battle = newBattle();
    spawnEnemy(battle, 'raccoon');
    const s = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    placeDuck(battle, 'chester', { x: 0, y: near });
    step(battle, 0);
    expect(s.cooldown).toBeCloseTo(faster('sunny'));
  });
});

describe('the Night Bandit', () => {
  const bandit = ENEMIES.bandit;

  it('whistles up raccoon minions just behind it', () => {
    const battle = newBattle();
    const boss = spawnEnemy(battle, 'bandit');
    boss.distance = 500;
    boss.speed = 0;
    const events = step(battle, bandit.summons!.every);
    const summoned = events.find((e) => e.type === 'summoned');
    expect(summoned).toMatchObject({ type: 'summoned', enemyId: boss.id });
    const minions = summoned?.type === 'summoned' ? summoned.minions : [];
    expect(minions).toHaveLength(bandit.summons!.count);
    for (const minion of minions) {
      expect(minion.kind).toBe(bandit.summons!.enemy);
      expect(minion.distance).toBeLessThan(500);
    }
  });

  it("can't whistle while it's stunned", () => {
    const battle = newBattle();
    const boss = spawnEnemy(battle, 'bandit');
    boss.stopTime = bandit.summons!.every * 2;
    const events = step(battle, bandit.summons!.every);
    expect(events.some((e) => e.type === 'summoned')).toBe(false);
  });

  it("scares ducks near it when it whistles, but not Curtis", () => {
    const battle = newBattle();
    const boss = spawnEnemy(battle, 'bandit');
    boss.distance = 500;
    boss.speed = 0;
    const sunny = placeDuck(battle, 'sunny', { x: 500, y: 60 });
    const curtis = placeDuck(battle, 'curtis', { x: 500, y: -60 });
    const events = step(battle, bandit.summons!.every);
    expect(events).toContainEqual({ type: 'scared', enemyId: boss.id, duckIds: [sunny.id], fearlessIds: [curtis.id] });
    expect(sunny.scaredTime).toBeGreaterThan(0);
    expect(curtis.scaredTime).toBe(0);
  });
});

describe('scared ducks', () => {
  function skyBattle() {
    return createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { sky: [{ x: 2000, y: -500 }] });
  }

  it('get scared when a hawk swoops over them, once per hawk', () => {
    const battle = skyBattle();
    const hawk = spawnEnemy(battle, 'hawk');
    const duck = placeDuck(battle, 'chester', { x: 2000, y: -480 }); // right under the hawk's path
    const first = step(battle, 0);
    expect(first).toContainEqual({ type: 'scared', enemyId: hawk.id, duckIds: [duck.id], fearlessIds: [] });
    expect(duck.scaredTime).toBe(ENEMIES.hawk.scares!.time);
    duck.scaredTime = 0;
    expect(step(battle, 0).some((e) => e.type === 'scared')).toBe(false);
  });

  it("don't attack or use powers while scared, then recover", () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.speed = 0;
    const duck = placeDuck(battle, 'sunny', { x: 0, y: 0 });
    duck.scaredTime = 1;
    expect(step(battle, 0.5).some((e) => e.type === 'attack')).toBe(false);
    expect(enemy.hp).toBe(raccoon.maxHp);
    expect(step(battle, 0.6).some((e) => e.type === 'attack')).toBe(true);
  });

  it('Curtis shrugs off hawk swoops and keeps working', () => {
    const battle = skyBattle();
    const hawk = spawnEnemy(battle, 'hawk');
    const curtis = placeDuck(battle, 'curtis', { x: 2000, y: -480 });
    expect(step(battle, 0)).toContainEqual({ type: 'scared', enemyId: hawk.id, duckIds: [], fearlessIds: [curtis.id] });
    expect(curtis.scaredTime).toBe(0);
  });
});

describe('slows', () => {
  it("don't stack: when two Curtises overlap, the stronger slow wins", () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 100;
    placeDuck(battle, 'curtis', { x: 100, y: 50 });
    placeDuck(battle, 'curtis', { x: 100, y: -50 }).level = 1; // Stubborn Curtis: a stronger slow
    step(battle, 1);
    expect(enemy.distance).toBeCloseTo(100 + raccoon.speed * statsAt('curtis', 1).slowZone!.slow);
  });
});

describe('Wing Flap limits', () => {
  it('only nudges the Night Bandit (too heavy to push far)', () => {
    const battle = newBattle();
    const boss = spawnEnemy(battle, 'bandit');
    boss.distance = 500;
    boss.speed = 0;
    const potato = placeDuck(battle, 'potato', { x: 500, y: 0 });
    potato.attacks = DUCKS.potato.wingFlap!.everyNthAttack - 1; // the next peck is a flap
    const events = step(battle, 0);
    expect(events.some((e) => e.type === 'attack' && e.wingFlap)).toBe(true);
    const push = DUCKS.potato.wingFlap!.pushBack * (1 - ENEMIES.bandit.pushResistance!);
    expect(boss.distance).toBeCloseTo(500 - push);
  });

  it("can't knock the same predator back again until it recovers", () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 500;
    enemy.speed = 0;
    enemy.hp = 1_000_000; // keep it alive
    const a = placeDuck(battle, 'potato', { x: 500, y: 20 });
    const b = placeDuck(battle, 'potato', { x: 500, y: -20 });
    a.attacks = b.attacks = DUCKS.potato.wingFlap!.everyNthAttack - 1; // both flap on their next peck
    step(battle, 0);
    expect(enemy.distance).toBe(500 - DUCKS.potato.wingFlap!.pushBack); // pushed once, not twice
  });

  // The bug: Potato's flaps used to pin the Night Bandit in place forever.
  function banditProgress(setup: (battle: ReturnType<typeof newBattle>) => void): number {
    // Easy, at night: the Bandit's slowest realistic speed.
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 5000, y: 0 }]), { enemySpeed: 0.7 });
    battle.night = true;
    const boss = spawnEnemy(battle, 'bandit');
    boss.distance = 1000;
    boss.hp = boss.maxHp = 1_000_000_000; // never runs away, so we can watch it walk
    boss.summonTime = Infinity; // no minions (or scares) getting in the way
    setup(battle);
    for (let i = 0; i < 30 * 30; i++) step(battle, 1 / 30);
    return boss.distance - 1000;
  }

  it("can't be pinned by a fully upgraded Potato with his Pecking Loop bonus", () => {
    const moved = banditProgress((battle) => {
      placeDuck(battle, 'potato', { x: 1100, y: 60 }).level = 2;
      placeDuck(battle, 'sunny', { x: 1100, y: -60 }); // Potato chases Sunny: +20% attack speed
    });
    expect(moved).toBeGreaterThan(300); // keeps walking (at least ~10 px/s over 30 seconds)
  });

  it('keeps moving forward even against a row of maxed Potatoes next to Curtis', () => {
    // A huge investment (and Curtis's slow does most of the work), so slowing it to a
    // crawl is fair; it just must never be pinned in place or pushed backwards.
    const moved = banditProgress((battle) => {
      for (const x of [1050, 1200, 1350]) placeDuck(battle, 'potato', { x, y: 60 }).level = 2;
      placeDuck(battle, 'curtis', { x: 1200, y: -60 }).level = 1;
    });
    expect(moved).toBeGreaterThan(0);
  });
});

describe('foxes', () => {
  it('shake off an Alarm Quack sooner than other predators', () => {
    const { alarmQuack } = DUCKS.chester;
    const battle = newBattle();
    const fox = spawnEnemy(battle, 'fox');
    const raccoon = spawnEnemy(battle, 'raccoon');
    fox.distance = 100;
    raccoon.distance = 100;
    placeDuck(battle, 'chester', { x: 100, y: 0 });
    step(battle, 0);
    expect(raccoon.stopTime).toBe(alarmQuack!.stunTime);
    expect(fox.stopTime).toBeCloseTo(alarmQuack!.stunTime * (1 - ENEMIES.fox.stunResistance!));
  });
});

describe('minks', () => {
  const { sneaky } = ENEMIES.mink;

  it('hide from ducks until they come close', () => {
    const battle = newBattle();
    const mink = spawnEnemy(battle, 'mink');
    mink.distance = 1000;
    // In Sunny's reach, but farther than she can spot a hiding mink.
    placeDuck(battle, 'sunny', { x: 1000, y: sunny.range * sneaky!.spotRange + 10 });
    step(battle, 0);
    expect(mink.hp).toBe(ENEMIES.mink.maxHp);

    mink.distance = 1000;
    battle.ducks[0]!.position.y = sunny.range * sneaky!.spotRange - 10;
    step(battle, 0);
    expect(mink.hp).toBeLessThan(ENEMIES.mink.maxHp);
  });

  it("are flushed out by Chester's Alarm Quack, so every duck in reach can hit them for a while", () => {
    const battle = newBattle();
    const mink = spawnEnemy(battle, 'mink');
    mink.distance = 1000;
    placeDuck(battle, 'chester', { x: 1000, y: 100 });
    const events = step(battle, 0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'alarmQuack', stunnedIds: [mink.id] }));
    expect(isHidden(mink)).toBe(false);

    // Now Sunny can hit it from her full reach.
    placeDuck(battle, 'sunny', { x: 1000, y: sunny.range - 5 });
    step(battle, 0);
    expect(mink.hp).toBeLessThan(ENEMIES.mink.maxHp - sunny.damage + 1);

    step(battle, sneaky!.revealTime + 0.1);
    expect(isHidden(mink)).toBe(true);
  });

  it("still get splashed when they're next to something a duck can see", () => {
    const battle = newBattle();
    const raccoon = spawnEnemy(battle, 'raccoon');
    const mink = spawnEnemy(battle, 'mink');
    raccoon.distance = 1000;
    mink.distance = 1000 - DUCKS.sunny.splashRadius / 2;
    placeDuck(battle, 'sunny', { x: 1000, y: sunny.range - 5 });
    step(battle, 0);
    expect(mink.hp).toBe(ENEMIES.mink.maxHp - sunny.damage);
  });
});

describe('snapping turtles', () => {
  it('climb out of the pond and cut across to the nearest bit of path', () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { pondAt: { x: 1200, y: 300 } });
    const turtle = spawnEnemy(battle, 'turtle');
    expect(enemyPosition(turtle)).toEqual({ x: 1200, y: 300 });
    expect(turtle.path.length).toBe(300 + 800);
  });

  it('need a pond on the map', () => {
    expect(() => spawnEnemy(newBattle(), 'turtle')).toThrow('pond');
  });

  it("have a shell that blocks part of every hit (but never all of it)", () => {
    const armor = ENEMIES.turtle.armor!;
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { pondAt: { x: 500, y: 100 } });
    const turtle = spawnEnemy(battle, 'turtle');
    expect(damageTo(turtle, 12)).toBe(12 - armor);
    expect(damageTo(turtle, 2)).toBe(1);
    expect(damageTo(spawnEnemy(battle, 'raccoon'), 12)).toBe(12);

    placeDuck(battle, 'sunny', enemyPosition(turtle));
    step(battle, 0);
    expect(turtle.hp).toBe(ENEMIES.turtle.maxHp - (sunny.damage - armor));
  });
});

describe('targeting', () => {
  // Three raccoons in a row (too far apart to share a splash), all in Potato's reach.
  // Potato sits right next to the one at the back.
  function lineUp() {
    const battle = newBattle();
    const back = spawnEnemy(battle, 'raccoon');
    const middle = spawnEnemy(battle, 'raccoon');
    const front = spawnEnemy(battle, 'raccoon');
    back.distance = 1000;
    middle.distance = 1060;
    front.distance = 1120;
    middle.hp = raccoon.maxHp + 50; // the toughest
    const duck = placeDuck(battle, 'potato', { x: 1000, y: 20 });
    return { battle, back, middle, front, duck };
  }

  it('goes after the predator closest to the house by default', () => {
    const { battle, front, duck } = lineUp();
    expect(duck.targeting).toBe('first');
    step(battle, 0);
    expect(front.hp).toBeLessThan(raccoon.maxHp);
  });

  it('can go after the toughest predator', () => {
    const { battle, middle, duck } = lineUp();
    duck.targeting = 'strong';
    step(battle, 0);
    expect(middle.hp).toBe(raccoon.maxHp + 50 - DUCKS.potato.damage);
  });

  it('can go after the predator farthest back', () => {
    const { battle, back, duck } = lineUp();
    duck.targeting = 'last';
    duck.position = { x: 1120, y: 20 }; // nearest the front, so it isn't also the closest
    step(battle, 0);
    expect(back.hp).toBe(raccoon.maxHp - DUCKS.potato.damage);
  });

  it('can go after the predator closest to the duck', () => {
    const { battle, back, duck } = lineUp();
    duck.targeting = 'close';
    step(battle, 0);
    expect(back.hp).toBe(raccoon.maxHp - DUCKS.potato.damage);
  });

  it('still only aims at predators it can reach and see', () => {
    const battle = newBattle();
    const near = spawnEnemy(battle, 'raccoon');
    const far = spawnEnemy(battle, 'raccoon');
    near.distance = 1000;
    far.distance = 1500;
    far.hp = 999;
    const duck = placeDuck(battle, 'potato', { x: 1000, y: 20 });
    duck.targeting = 'strong';
    step(battle, 0);
    expect(near.hp).toBe(raccoon.maxHp - DUCKS.potato.damage);
    expect(far.hp).toBe(999);
  });
});

describe('damage report', () => {
  it('counts damage and who landed the last hit, without counting overkill', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1000;
    enemy.hp = 5;
    const duck = placeDuck(battle, 'potato', { x: 1000, y: 20 });
    step(battle, 0);
    expect(duck.report).toEqual({ damage: 5, chasedOff: 1, special: 0 });
    expect(battle.report.potato).toEqual({ placed: 1, damage: 5, chasedOff: 1, special: 0 });
  });

  it("counts Sunny's splash hits on predators other than her target", () => {
    const battle = newBattle();
    const target = spawnEnemy(battle, 'raccoon');
    const nextTo = spawnEnemy(battle, 'raccoon');
    target.distance = 1000;
    nextTo.distance = 1000 - sunny.splashRadius / 2;
    const duck = placeDuck(battle, 'sunny', { x: 1000, y: 20 });
    step(battle, 0);
    expect(duck.report).toEqual({ damage: 2 * sunny.damage, chasedOff: 0, special: 1 });
  });

  it("counts Chester's frozen predators and Potato's flaps", () => {
    const battle = newBattle();
    spawnEnemy(battle, 'raccoon').distance = 1000;
    spawnEnemy(battle, 'raccoon').distance = 1030;
    const chester = placeDuck(battle, 'chester', { x: 1000, y: 20 });
    step(battle, 0);
    expect(chester.report.special).toBe(2);

    const flapBattle = newBattle();
    const raccoon = spawnEnemy(flapBattle, 'raccoon');
    raccoon.distance = 1000;
    raccoon.hp = 10_000;
    const potato = placeDuck(flapBattle, 'potato', { x: 1000, y: 20 });
    for (let i = 0; i < DUCKS.potato.wingFlap!.everyNthAttack; i++) step(flapBattle, DUCKS.potato.attackInterval);
    expect(potato.report.special).toBe(1);
  });

  it('counts each predator Curtis slows once', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1000;
    const curtis = placeDuck(battle, 'curtis', { x: 1000, y: 20 });
    step(battle, 0.1);
    step(battle, 0.1);
    expect(curtis.report.special).toBe(1);
  });

  it("keeps a kind's totals after one is sold, and counts how many were placed", () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1000;
    placeDuck(battle, 'sunny', { x: 1000, y: 20 });
    step(battle, 0);
    battle.ducks = [];
    placeDuck(battle, 'sunny', { x: 0, y: 500 });
    expect(battle.report.sunny).toEqual({ placed: 2, damage: sunny.damage, chasedOff: 0, special: 0 });
  });
});

describe('top duck', () => {
  it('is the kind that did the most damage, with ties going to more chased off', () => {
    const row = (damage: number, chasedOff: number) => ({ placed: 1, damage, chasedOff, special: 0 });
    expect(topDuck({ sunny: row(100, 2), potato: row(300, 1), chester: row(20, 0) })).toBe('potato');
    expect(topDuck({ sunny: row(100, 2), potato: row(100, 5) })).toBe('potato');
    expect(topDuck({ curtis: row(0, 0) })).toBeUndefined();
    expect(topDuck({})).toBeUndefined();
  });
});

describe('training (Endless Pond)', () => {
  it('makes a trained duck hit harder', () => {
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1000;
    const duck = placeDuck(battle, 'potato', { x: 1000, y: 20 });
    duck.training = 2;
    step(battle, 0);
    expect(enemy.hp).toBeCloseTo(raccoon.maxHp - DUCKS.potato.damage * (1 + 2 * ENDLESS.training.damage));
  });
});

describe('Endless Pond bosses', () => {
  it('the Storm Hawk flies at the house and calls in more hawks from the sky', () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { sky: [{ x: 1000, y: -500 }] });
    const boss = spawnEnemy(battle, 'stormHawk');
    expect(isFlying(boss)).toBe(true);
    const events = step(battle, ENEMIES.stormHawk.summons!.every + 0.01);
    const summoned = events.find((e) => e.type === 'summoned');
    expect(summoned && summoned.type === 'summoned' && summoned.minions.every((m) => m.kind === 'hawk' && isFlying(m))).toBe(true);
  });

  it('the Silver Fox barely stays frozen', () => {
    const battle = newBattle();
    const fox = spawnEnemy(battle, 'silverFox');
    fox.distance = 100;
    placeDuck(battle, 'chester', { x: 100, y: 0 });
    step(battle, 0);
    expect(fox.stopTime).toBeCloseTo(DUCKS.chester.alarmQuack!.stunTime * (1 - ENEMIES.silverFox.stunResistance!));
  });

  it("Old Snapper can't be pushed back, and shrugs off little pecks", () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { pondAt: { x: 1000, y: 100 } });
    const snapper = spawnEnemy(battle, 'oldSnapper');
    expect(damageTo(snapper, DUCKS.potato.damage)).toBe(1);
    const potato = placeDuck(battle, 'potato', enemyPosition(snapper));
    potato.attacks = DUCKS.potato.wingFlap!.everyNthAttack - 1; // the next peck is a Wing Flap
    const before = snapper.distance;
    snapper.stopTime = 1; // hold still so only the flap could move it
    step(battle, 0);
    expect(snapper.distance).toBe(before);
  });
});

describe('freeze limits', () => {
  it("can't freeze a predator again until it's been on guard for a moment", () => {
    const { alarmQuack } = DUCKS.chester;
    const battle = newBattle();
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.distance = 1000;
    enemy.hp = 1e9;
    const chester = placeDuck(battle, 'chester', { x: 1000, y: 20 });
    step(battle, 0);
    expect(enemy.freezeRecovery).toBeCloseTo(alarmQuack!.stunTime * (1 + FREEZE_RECOVERY));

    // Another Chester right away can't freeze it (and saves his quack).
    const second = placeDuck(battle, 'chester', { x: 1000, y: -20 });
    const events = step(battle, 0.1);
    expect(events.some((e) => e.type === 'alarmQuack' && e.duckId === second.id)).toBe(false);
    expect(second.abilityCooldown).toBe(0);
    expect(chester.abilityCooldown).toBeGreaterThan(0);
  });

  /** How much of 60 seconds a tough raccoon spends frozen, with these Chesters and perks. */
  function frozenShare(chesters: number, level: number, extraLoud: number): number {
    const battle = newBattle();
    battle.mods = perkMods({ extraLoud });
    const enemy = spawnEnemy(battle, 'raccoon');
    enemy.hp = 1e9;
    enemy.distance = 1000;
    enemy.speed = 0; // stays in reach the whole time
    for (let i = 0; i < chesters; i++) placeDuck(battle, 'chester', { x: 1000, y: 20 + i }).level = level;
    let frozen = 0;
    const dt = 1 / 30;
    for (let t = 0; t < 60; t += dt) {
      step(battle, dt);
      if (enemy.stopTime > 0) frozen += dt;
    }
    return frozen / 60;
  }

  it("won't let loud Chesters taking turns keep a predator frozen", () => {
    expect(frozenShare(3, 2, 2)).toBeLessThan(0.7);
  });

  it('leaves a single fully upgraded Chester just as strong as before', () => {
    const { alarmQuack } = statsAt('chester', 2);
    expect(frozenShare(1, 2, 0)).toBeCloseTo(alarmQuack!.stunTime / alarmQuack!.cooldown, 1);
  });
});

describe('final upgrade paths', () => {
  it('Eagle-Eye Sunny does double damage to hawks', () => {
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 2000, y: 0 }]), { sky: [{ x: 1000, y: -300 }] });
    const hawk = spawnEnemy(battle, 'hawk');
    // Close enough to hit it, but outside its scare range.
    const at = enemyPosition(hawk);
    const duck = placeDuck(battle, 'sunny', { x: at.x, y: at.y - ENEMIES.hawk.scares!.radius - 20 });
    duck.level = 3;
    duck.path = 1;
    step(battle, 0);
    expect(hawk.hp).toBeCloseTo(ENEMIES.hawk.maxHp - statsAt('sunny', 3, 1).damage * 2);
  });

  it("Tornado Potato's gust blows back every predator near the target", () => {
    const battle = newBattle();
    const front = spawnEnemy(battle, 'raccoon');
    const nearby = spawnEnemy(battle, 'raccoon');
    front.distance = 1000;
    nearby.distance = 950;
    front.hp = nearby.hp = 1e6;
    const duck = placeDuck(battle, 'potato', { x: 1000, y: 20 });
    duck.level = 3;
    duck.path = 0;
    duck.attacks = statsAt('potato', 3, 0).wingFlap!.everyNthAttack - 1;
    step(battle, 0);
    const push = statsAt('potato', 3, 0).wingFlap!.pushBack;
    expect(front.distance).toBeCloseTo(1000 - push, 0);
    expect(nearby.distance).toBeCloseTo(950 - push, 0);
  });

  it('Wise Old Chester makes frozen predators take more damage from everyone', () => {
    const battle = newBattle();
    const raccoon = spawnEnemy(battle, 'raccoon');
    raccoon.distance = 1000;
    const chester = placeDuck(battle, 'chester', { x: 1000, y: 150 });
    chester.level = 3;
    chester.path = 1;
    step(battle, 0); // quack: frozen and weakened
    expect(raccoon.weakness).toBe(0.5);
    const hpAfterQuack = raccoon.hp;
    placeDuck(battle, 'potato', { x: 1000, y: 20 });
    step(battle, 0);
    expect(hpAfterQuack - raccoon.hp).toBeCloseTo(DUCKS.potato.damage * 1.5);
    battle.ducks = battle.ducks.filter((d) => d !== chester); // no more quacks
    step(battle, 10); // the freeze wears off, and so does the weakness
    expect(raccoon.weakness).toBe(0);
  });

  it('Guardian Curtis keeps the ducks near him from getting scared', () => {
    // Hawks fly straight down from (500, -500) to the duck house at (500, 500).
    const battle = createBattle(makePath([{ x: 0, y: 0 }, { x: 500, y: 500 }]), { sky: [{ x: 500, y: -500 }] });
    const sunny = placeDuck(battle, 'sunny', { x: 500, y: -100 });
    const curtis = placeDuck(battle, 'curtis', { x: 660, y: -100 });
    curtis.level = 3;
    curtis.path = 1;
    const hawk = spawnEnemy(battle, 'hawk');
    hawk.distance = 400; // right over Sunny (and too far from Curtis to scare him)
    const events = step(battle, 0);
    expect(sunny.scaredTime).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'scared', fearlessIds: expect.arrayContaining([sunny.id]) }));
  });
});
