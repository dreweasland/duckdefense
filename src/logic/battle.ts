import { FOUNTAIN, NIGHT } from '../data/dayNight';
import { ENDLESS } from '../data/endless';
import { FREEZE_RECOVERY, WING_FLAP_RECOVERY, type DuckKind, type DuckStats } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { DEFAULT_TARGETING, type Targeting } from '../data/targeting';
import { CHASES, PECKING_LOOP } from '../data/synergy';
import { TILES, type NestKind } from '../data/tiles';
import { distance, inEllipse, type Ellipse, type Point } from './geometry';
import { joinPath, makePath, pointAt, type Path } from './path';
import { NO_MODS, type Mods } from './perks';
import { statsAt } from './upgrades';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  /** Pixels per second, after difficulty and night multipliers. */
  speed: number;
  /** The route it follows: the ground path, or a straight line from the sky for flyers. */
  path: Path;
  /** How far along its path it has walked (or flown), in pixels. */
  distance: number;
  /** Seconds it stays frozen (stunned) before moving again. */
  stopTime: number;
  /** Seconds before a Wing Flap can knock it back again. */
  pushRecovery: number;
  /** Seconds before an Alarm Quack can freeze it again (counts the freeze, then a short guard). */
  freezeRecovery: number;
  /** True while Curtis is slowing it (for drawing). */
  slowed: boolean;
  /** Ducks this predator has already scared (swooping hawks scare each duck once). */
  scared: number[];
  /** Seconds until it next calls for minions (only for predators that summon). */
  summonTime: number;
  /** Seconds a sneaky predator stays spotted after an Alarm Quack flushes it out. */
  revealedTime: number;
  /** Ducks that have slowed this predator (so each Curtis counts it once in the damage report). */
  slowedBy: number[];
  /** While frozen by Wise Old Chester, it takes this much more damage (0.5 = +50%). */
  weakness: number;
}

/**
 * The damage report: what a duck (or every duck of a kind) has done this level.
 * `special` counts its power: predators splashed (Sunny), flaps (Potato),
 * predators frozen (Chester), or predators slowed (Curtis).
 */
export interface DuckReport {
  damage: number; // health taken off predators (not counting overkill)
  chasedOff: number; // predators it landed the last hit on
  special: number;
}

/** A duck kind's report for the whole level: every one placed, including any that were sold. */
export interface KindReport extends DuckReport {
  placed: number;
}

export interface Duck {
  id: number;
  kind: DuckKind;
  position: Point;
  /** Seconds until this duck can attack again. */
  cooldown: number;
  /** Seconds until this duck's special ability is ready again. */
  abilityCooldown: number;
  /** Attacks made so far, for "every Nth attack" abilities. */
  attacks: number;
  /** Upgrades bought: 0, 1, 2, or 3 (the final upgrade). */
  level: number;
  /** Which final upgrade path it picked (0 or 1), once it's at level 3. */
  path: number;
  /** Endless Pond training levels bought after both upgrades (each one hits harder). */
  training: number;
  /** Seconds this duck stays scared (no attacks or powers). */
  scaredTime: number;
  /** Which predator it goes after when more than one is in reach. */
  targeting: Targeting;
  /** What this duck has done so far. */
  report: DuckReport;
}

export interface Fountain {
  position: Point;
  /** Whether the fountain has power right now (the game sets this from the battery). */
  on: boolean;
}

export interface Battle {
  /** The ground path, ending at the duck house. */
  path: Path;
  /** Where flyers enter; they take turns. */
  sky: Point[];
  /** Where predators that come from the pond climb out (the middle of the pond). */
  pond?: Point;
  enemies: Enemy[];
  ducks: Duck[];
  fountain?: Fountain;
  nextId: number;
  flyersSpawned: number;
  /** Multiplies every predator's speed (from the difficulty). */
  enemySpeed: number;
  /** Predators that arrive while this is true move faster. */
  night: boolean;
  /** Multiplies the health of predators that arrive (tougher Endless Pond waves). */
  enemyHealth: number;
  /** The damage report for each kind of duck placed this level. */
  report: Partial<Record<DuckKind, KindReport>>;
  /** Multipliers from Endless Pond perks (all 1 otherwise). */
  mods: Mods;
  /** Special map tiles: mud and bramble patches on the path, and special nests. */
  mud: Ellipse[];
  brambles: Ellipse[];
  specialNests: { at: Point; kind: NestKind }[];
}

/** Things that happened during a step, so the scene can animate them. */
export type BattleEvent =
  | { type: 'attack'; duckId: number; target: Point; hitIds: number[]; wingFlap: boolean }
  | { type: 'alarmQuack'; duckId: number; stunnedIds: number[] }
  /** A predator scared some ducks. Fearless ducks (Curtis) in range shrug it off. */
  | { type: 'scared'; enemyId: number; duckIds: number[]; fearlessIds: number[] }
  | { type: 'summoned'; enemyId: number; minions: Enemy[] }
  | { type: 'defeated'; enemy: Enemy; position: Point }
  | { type: 'reachedHouse'; enemy: Enemy };

export interface BattleOptions {
  sky?: Point[];
  mud?: Ellipse[];
  brambles?: Ellipse[];
  specialNests?: { at: Point; kind: NestKind }[];
  pondAt?: Point;
  fountainAt?: Point;
  enemySpeed?: number;
}

export function createBattle(path: Path, options: BattleOptions = {}): Battle {
  return {
    path,
    sky: options.sky ?? [],
    pond: options.pondAt,
    enemies: [],
    ducks: [],
    fountain: options.fountainAt ? { position: options.fountainAt, on: false } : undefined,
    nextId: 1,
    flyersSpawned: 0,
    enemySpeed: options.enemySpeed ?? 1,
    night: false,
    enemyHealth: 1,
    report: {},
    mods: { ...NO_MODS },
    mud: options.mud ?? [],
    brambles: options.brambles ?? [],
    specialNests: options.specialNests ?? [],
  };
}

export function housePosition(battle: Battle): Point {
  return battle.path.points[battle.path.points.length - 1]!;
}

export function spawnEnemy(battle: Battle, kind: EnemyKind): Enemy {
  const stats = ENEMIES[kind];
  let path = battle.path;
  if (stats.flying) {
    const from = battle.sky[battle.flyersSpawned % Math.max(1, battle.sky.length)];
    if (!from) {
      throw new Error(`A ${stats.name} needs somewhere to fly in from: add a "sky" layer with points to the map`);
    }
    battle.flyersSpawned++;
    path = makePath([from, housePosition(battle)]);
  } else if (stats.fromPond) {
    if (!battle.pond) throw new Error(`A ${stats.name} needs a pond to climb out of: add a "pond" layer to the map`);
    path = joinPath(battle.pond, battle.path);
  }
  const maxHp = stats.maxHp * battle.enemyHealth;
  const enemy: Enemy = {
    id: battle.nextId++,
    kind,
    hp: maxHp,
    maxHp,
    speed: stats.speed * battle.enemySpeed * (battle.night ? NIGHT.enemySpeed : 1),
    path,
    distance: 0,
    stopTime: 0,
    pushRecovery: 0,
    freezeRecovery: 0,
    slowed: false,
    scared: [],
    summonTime: stats.summons?.every ?? 0,
    revealedTime: 0,
    slowedBy: [],
    weakness: 0,
  };
  battle.enemies.push(enemy);
  return enemy;
}

export function placeDuck(battle: Battle, kind: DuckKind, position: Point): Duck {
  const duck: Duck = {
    id: battle.nextId++,
    kind,
    position: { ...position },
    cooldown: 0,
    abilityCooldown: 0,
    attacks: 0,
    level: 0,
    path: 0,
    training: 0,
    scaredTime: 0,
    targeting: DEFAULT_TARGETING,
    report: { damage: 0, chasedOff: 0, special: 0 },
  };
  battle.ducks.push(duck);
  kindReport(battle, kind).placed++;
  return duck;
}

function kindReport(battle: Battle, kind: DuckKind): KindReport {
  return (battle.report[kind] ??= { placed: 0, damage: 0, chasedOff: 0, special: 0 });
}

/** Adds to a duck's report, and to its kind's report for the level. */
function credit(battle: Battle, duck: Duck, stat: keyof DuckReport, amount: number): void {
  duck.report[stat] += amount;
  kindReport(battle, duck.kind)[stat] += amount;
}

export function enemyPosition(enemy: Enemy): Point {
  return pointAt(enemy.path, enemy.distance);
}

export function isFlying(enemy: Enemy): boolean {
  return ENEMIES[enemy.kind].flying;
}

function enemiesInRange(battle: Battle, from: Point, range: number): Enemy[] {
  return battle.enemies.filter((e) => e.hp > 0 && distance(enemyPosition(e), from) <= range);
}

/**
 * A duck's stats right now: its upgrades, plus any Endless Pond perks (reach, damage,
 * attack speed, Chester's freeze, Curtis's slow).
 */
export function duckStats(battle: Battle, duck: Duck): DuckStats {
  const base = statsAt(duck.kind, duck.level, duck.path);
  const m = battle.mods;
  const nest = nestAt(battle, duck.position);
  const nestBonus = nest ? TILES.nests[nest] : { range: 0, damage: 0 };
  return {
    ...base,
    range: base.range * m.range * (1 + nestBonus.range),
    damage: base.damage * m.damage * (1 + nestBonus.damage),
    attackInterval: base.attackInterval / m.attackSpeed,
    alarmQuack: base.alarmQuack && { ...base.alarmQuack, stunTime: base.alarmQuack.stunTime * m.stun },
    slowZone: base.slowZone && { slow: base.slowZone.slow * m.slow },
  };
}

/** The kind of special nest at a spot (a hill or waterside nest), if there is one. */
export function nestAt(battle: Battle, at: Point): NestKind | undefined {
  return battle.specialNests.find((n) => distance(n.at, at) < 1)?.kind;
}

/** Whether a ground predator is standing in mud (flyers skip it). */
function inMud(battle: Battle, enemy: Enemy): boolean {
  if (isFlying(enemy)) return false;
  const at = enemyPosition(enemy);
  return battle.mud.some((patch) => inEllipse(at, patch));
}

/** Whether a ground predator is in brambles (flyers skip them). */
export function inBrambles(battle: Battle, enemy: Enemy): boolean {
  if (isFlying(enemy)) return false;
  const at = enemyPosition(enemy);
  return battle.brambles.some((patch) => inEllipse(at, patch));
}

/** Whether a sneaky predator is hiding right now (an Alarm Quack flushes it out for a while). */
export function isHidden(enemy: Enemy): boolean {
  return !!ENEMIES[enemy.kind].sneaky && enemy.revealedTime <= 0;
}

/** Whether a duck at `from` with this reach can see a predator to aim at it. Hiding predators must be close. */
function canSpot(enemy: Enemy, from: Point, range: number): boolean {
  const sneaky = ENEMIES[enemy.kind].sneaky;
  return !sneaky || !isHidden(enemy) || distance(enemyPosition(enemy), from) <= range * sneaky.spotRange;
}

/**
 * The predator in range a duck goes after, if any: closest to the house ('first'), most
 * health ('strong'), farthest back ('last'), or closest to the duck ('close').
 * Ties go to the one closest to the house.
 */
export function pickTarget(
  battle: Battle,
  from: Point,
  range: number,
  canHitFlying = true,
  targeting: Targeting = DEFAULT_TARGETING,
): Enemy | undefined {
  // Smaller is better.
  const score = (enemy: Enemy): number => {
    switch (targeting) {
      case 'first':
        return remaining(enemy);
      case 'strong':
        return -enemy.hp;
      case 'last':
        return -remaining(enemy);
      case 'close':
        return distance(enemyPosition(enemy), from);
    }
  };
  let best: Enemy | undefined;
  for (const enemy of enemiesInRange(battle, from, range)) {
    if (!canHitFlying && isFlying(enemy)) continue;
    if (!canSpot(enemy, from, range)) continue;
    if (!best) {
      best = enemy;
      continue;
    }
    const diff = score(enemy) - score(best);
    if (diff < 0 || (diff === 0 && remaining(enemy) < remaining(best))) best = enemy;
  }
  return best;
}

/** How much a hit takes off a predator: armor (the turtle's shell) blocks some, but every hit does at least 1. */
export function damageTo(enemy: Enemy, damage: number): number {
  const armor = ENEMIES[enemy.kind].armor ?? 0;
  return armor > 0 ? Math.max(1, damage - armor) : damage;
}

/** Pixels left before a predator reaches the house. */
function remaining(enemy: Enemy): number {
  return enemy.path.length - enemy.distance;
}

/**
 * The Pecking Loop: the nearby duck this duck chases, if there is one.
 * A duck with a chase partner attacks faster.
 */
export function chasePartner(battle: Battle, duck: Duck): Duck | undefined {
  const chases = CHASES[duck.kind];
  if (!chases) return undefined;
  return battle.ducks.find(
    (other) =>
      other !== duck &&
      other.kind === chases &&
      distance(other.position, duck.position) <= PECKING_LOOP.nearDistance,
  );
}

export function attackInterval(battle: Battle, duck: Duck): number {
  const base = duckStats(battle, duck).attackInterval;
  return chasePartner(battle, duck) ? base / (1 + PECKING_LOOP.attackSpeedBonus) : base;
}

export function isScared(duck: Duck): boolean {
  return duck.scaredTime > 0;
}

/**
 * How much a ground predator is slowed right now (1 = not at all). Only Curtis slows
 * predators; if two Curtises overlap, the stronger slow wins. Hawks fly over it.
 */
function slowFor(battle: Battle, enemy: Enemy): number {
  if (isFlying(enemy)) return 1;
  const at = enemyPosition(enemy);
  let factor = 1;
  let slower: Duck | undefined;
  for (const duck of battle.ducks) {
    const stats = duckStats(battle, duck);
    if (stats.slowZone && distance(at, duck.position) <= stats.range && stats.slowZone.slow < factor) {
      factor = stats.slowZone.slow;
      slower = duck;
    }
  }
  // The damage report counts each predator once for the Curtis doing the slowing.
  if (slower && !enemy.slowedBy.includes(slower.id)) {
    enemy.slowedBy.push(slower.id);
    credit(battle, slower, 'special', 1);
  }
  return factor;
}

/** Whether a duck is in the powered fountain's refreshing spray (it hits harder). */
export function isRefreshed(battle: Battle, duck: Duck): boolean {
  const { fountain } = battle;
  return !!fountain?.on && distance(duck.position, fountain.position) <= FOUNTAIN.range;
}

/** Whether a Guardian Curtis (or any duck with a brave aura) is close enough to keep this duck calm. */
export function isGuarded(battle: Battle, duck: Duck): boolean {
  return battle.ducks.some((other) => {
    const aura = other !== duck && statsAt(other.kind, other.level, other.path).braveAura;
    return !!aura && distance(other.position, duck.position) <= aura.radius;
  });
}

/** Scares the ducks within `radius` of a point (fearless ducks, and ducks a Guardian keeps calm, just shrug). */
function scareDucks(
  battle: Battle,
  enemy: Enemy,
  at: Point,
  radius: number,
  time: number,
  onlyOnce: boolean,
): BattleEvent | undefined {
  const duckIds: number[] = [];
  const fearlessIds: number[] = [];
  for (const duck of battle.ducks) {
    if (distance(duck.position, at) > radius) continue;
    if (onlyOnce && enemy.scared.includes(duck.id)) continue;
    enemy.scared.push(duck.id);
    if (statsAt(duck.kind, duck.level, duck.path).fearless || isGuarded(battle, duck)) {
      fearlessIds.push(duck.id);
    } else {
      duck.scaredTime = Math.max(duck.scaredTime, time * battle.mods.scare);
      duckIds.push(duck.id);
    }
  }
  return duckIds.length || fearlessIds.length ? { type: 'scared', enemyId: enemy.id, duckIds, fearlessIds } : undefined;
}

/** Advances the battle by `dt` seconds. */
export function step(battle: Battle, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];

  for (const duck of battle.ducks) duck.scaredTime = Math.max(0, duck.scaredTime - dt);

  // 1. Predators head for the house, unless something has frozen them.
  for (const enemy of battle.enemies) {
    enemy.pushRecovery = Math.max(0, enemy.pushRecovery - dt);
    enemy.freezeRecovery = Math.max(0, enemy.freezeRecovery - dt);
    enemy.revealedTime = Math.max(0, enemy.revealedTime - dt);
    const curtisSlow = slowFor(battle, enemy);
    enemy.slowed = curtisSlow < 1; // (the dusty ring is for Curtis; mud shows for itself)
    const slow = curtisSlow * (inMud(battle, enemy) ? TILES.mud.speed : 1);
    // Brambles prickle ground predators the whole time they're in them.
    if (inBrambles(battle, enemy)) enemy.hp -= TILES.brambles.damagePerSecond * dt;
    if (enemy.stopTime > 0) {
      enemy.stopTime = Math.max(0, enemy.stopTime - dt);
      if (enemy.stopTime === 0) enemy.weakness = 0; // only weakened while frozen
    } else {
      enemy.distance += enemy.speed * slow * dt;
    }
    if (enemy.distance >= enemy.path.length) {
      events.push({ type: 'reachedHouse', enemy });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.distance < e.path.length);

  // 2. Swooping hawks scare the ducks they fly low over (each duck once per hawk).
  for (const enemy of battle.enemies) {
    const scares = ENEMIES[enemy.kind].scares;
    if (scares?.when !== 'swooping') continue;
    const event = scareDucks(battle, enemy, enemyPosition(enemy), scares.radius, scares.time, true);
    if (event) events.push(event);
  }

  // 3. Bosses call for minions, which appear just behind them (not while stunned).
  for (const enemy of [...battle.enemies]) {
    const summons = ENEMIES[enemy.kind].summons;
    if (!summons || enemy.stopTime > 0) continue;
    enemy.summonTime -= dt;
    if (enemy.summonTime > 0) continue;
    enemy.summonTime = summons.every;
    const minions: Enemy[] = [];
    for (let i = 0; i < summons.count; i++) {
      const minion = spawnEnemy(battle, summons.enemy);
      if (!isFlying(minion)) minion.distance = Math.max(0, enemy.distance - 50 - i * 40);
      minions.push(minion);
    }
    events.push({ type: 'summoned', enemyId: enemy.id, minions });
    // The whistle scares nearby ducks too.
    const scares = ENEMIES[enemy.kind].scares;
    if (scares?.when === 'whistling') {
      const event = scareDucks(battle, enemy, enemyPosition(enemy), scares.radius, scares.time, false);
      if (event) events.push(event);
    }
  }

  // 4. Special abilities (scared ducks can't use them).
  for (const duck of battle.ducks) {
    duck.abilityCooldown = Math.max(0, duck.abilityCooldown - dt);
    if (duck.abilityCooldown > 0 || isScared(duck)) continue;
    const stats = duckStats(battle, duck);

    // Chester's Alarm Quack: freeze every predator in range, hawks included, and flush
    // hiding predators out of the grass. Quick ones (foxes) shake it off sooner. A predator
    // that was just frozen is on guard for a moment, so Chester saves his quack for
    // predators he can freeze.
    if (stats.alarmQuack) {
      const inRange = enemiesInRange(battle, duck.position, stats.range);
      const freezable = inRange.filter((e) => e.freezeRecovery === 0);
      if (freezable.length > 0) {
        for (const enemy of freezable) {
          const enemyStats = ENEMIES[enemy.kind];
          const stun = stats.alarmQuack.stunTime * (1 - (enemyStats.stunResistance ?? 0));
          enemy.stopTime = Math.max(enemy.stopTime, stun);
          enemy.freezeRecovery = stun * (1 + FREEZE_RECOVERY);
          if (stats.alarmQuack.weaken) enemy.weakness = Math.max(enemy.weakness, stats.alarmQuack.weaken);
        }
        // The quack flushes every sneaky predator in range out of the grass, on guard or not.
        for (const enemy of inRange) {
          const sneaky = ENEMIES[enemy.kind].sneaky;
          if (sneaky) enemy.revealedTime = Math.max(enemy.revealedTime, sneaky.revealTime);
        }
        duck.abilityCooldown = stats.alarmQuack.cooldown;
        credit(battle, duck, 'special', freezable.length);
        events.push({ type: 'alarmQuack', duckId: duck.id, stunnedIds: freezable.map((e) => e.id) });
      }
    }
  }

  // 5. Ducks that are ready attack the predator they're aiming for (not while scared).
  for (const duck of battle.ducks) {
    duck.cooldown = Math.max(0, duck.cooldown - dt);
    if (duck.cooldown > 0 || isScared(duck)) continue;

    const stats = duckStats(battle, duck);
    const target = pickTarget(battle, duck.position, stats.range, stats.canHitFlying, duck.targeting);
    if (!target) continue;

    const targetPos = enemyPosition(target);
    const hit = battle.enemies.filter(
      (e) =>
        e.hp > 0 &&
        (e === target ||
          ((stats.canHitFlying || !isFlying(e)) && distance(enemyPosition(e), targetPos) <= stats.splashRadius)),
    );
    const damage =
      stats.damage *
      (isRefreshed(battle, duck) ? 1 + FOUNTAIN.damageBoost : 1) *
      (1 + ENDLESS.training.damage * duck.training) *
      (battle.night ? battle.mods.nightDamage : 1);
    for (const enemy of hit) {
      const before = enemy.hp;
      const flyer = isFlying(enemy) ? (stats.flyerDamage ?? 1) : 1;
      const weakened = enemy.stopTime > 0 ? 1 + enemy.weakness : 1;
      enemy.hp -= damageTo(enemy, damage * flyer * weakened);
      credit(battle, duck, 'damage', before - Math.max(0, enemy.hp));
      if (enemy.hp <= 0) credit(battle, duck, 'chasedOff', 1);
    }
    if (stats.splashRadius > 0) credit(battle, duck, 'special', hit.length - 1);
    duck.cooldown = attackInterval(battle, duck);
    duck.attacks++;

    // Potato's Wing Flap: every Nth hit knocks the target back, unless it was just knocked
    // back (it needs a moment to recover). Heavy predators shrug off most of the push.
    // Tornado Potato's gust blows back every predator near the target too.
    const wingFlap = !!stats.wingFlap && duck.attacks % stats.wingFlap.everyNthAttack === 0 && target.pushRecovery === 0;
    if (wingFlap && stats.wingFlap) {
      const { radius = 0, pushBack } = stats.wingFlap;
      const blown = battle.enemies.filter(
        (e) => e === target || (radius > 0 && e.hp > 0 && e.pushRecovery === 0 && distance(enemyPosition(e), targetPos) <= radius),
      );
      for (const enemy of blown) {
        const push = pushBack * (1 - (ENEMIES[enemy.kind].pushResistance ?? 0));
        enemy.distance = Math.max(0, enemy.distance - push);
        enemy.pushRecovery = WING_FLAP_RECOVERY;
      }
      credit(battle, duck, 'special', blown.length);
    }

    events.push({ type: 'attack', duckId: duck.id, target: targetPos, hitIds: hit.map((e) => e.id), wingFlap });
  }

  // 6. Predators out of health run away.
  for (const enemy of battle.enemies) {
    if (enemy.hp <= 0) {
      events.push({ type: 'defeated', enemy, position: enemyPosition(enemy) });
    }
  }
  battle.enemies = battle.enemies.filter((e) => e.hp > 0);

  return events;
}

/** The duck kind that did the most damage this level (ties go to more predators chased off). */
export function topDuck(report: Battle['report']): DuckKind | undefined {
  let best: { kind: DuckKind; stats: KindReport } | undefined;
  for (const [kind, stats] of Object.entries(report) as [DuckKind, KindReport][]) {
    if (stats.damage <= 0) continue;
    const better = !best || stats.damage > best.stats.damage || (stats.damage === best.stats.damage && stats.chasedOff > best.stats.chasedOff);
    if (better) best = { kind, stats };
  }
  return best?.kind;
}
