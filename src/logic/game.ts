import { CRAIG } from '../data/craig';
import { BATTERY, FOUNTAIN } from '../data/dayNight';
import type { Challenge } from '../data/challenges';
import type { Difficulty } from '../data/difficulty';
import { DUCKS, MOVE_SETTLE_TIME, SELL_REFUND, type DuckKind } from '../data/ducks';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import type { Targeting } from '../data/targeting';
import { EARLY_CALL, type Wave } from '../data/waves';
import { createBattle, findDuck, placeDuck, spawnEnemy, step, type Battle, type BattleEvent, type Duck, type Enemy } from './battle';
import type { NestKind } from '../data/tiles';
import { distance, type Ellipse, type Point } from './geometry';
import { ENDLESS } from '../data/endless';
import { PERKS, type PerkId } from '../data/perks';
import { offerPerks, perkMods, type PerksTaken } from './perks';
import { bossCount } from './endless';
import { challengeSettings, challengeWaves } from './daily';
import { isFinalChoice, nextUpgrade, totalSpent, upgradeOptions } from './upgrades';
import type { Level } from './level';
import { makePath, type Path } from './path';

/**
 * building: between waves, placing ducks
 * wave:     predators are coming
 * won/lost: the level is over
 */
export type GamePhase = 'building' | 'wave' | 'won' | 'lost';

export interface ScheduledSpawn {
  time: number; // seconds after the wave starts
  enemy: EnemyKind;
}

export interface Game {
  battle: Battle;
  waves: readonly Wave[];
  /** The difficulty's health multiplier for every predator (on top of a wave's own). */
  enemyHealth: number;
  peas: number;
  hearts: number;
  /** The wave being fought, or the next one while building (0-based). */
  waveIndex: number;
  phase: GamePhase;
  /** Seconds since the current wave started. */
  waveTime: number;
  /** This wave's predators that haven't appeared yet, soonest first. */
  pending: ScheduledSpawn[];
  /** Solar battery charge, 0 to BATTERY.capacity. Powers the fountain. */
  battery: number;
  /** Craig's Guardian Blessing can be used once per level (in the Endless Pond, it comes back every few waves). */
  blessingUsed: boolean;
  /** Seconds of Craig's shield left (only counts down during waves). */
  shieldTime: number;
  /** The Daily Challenge twist being played, if any. */
  challenge?: Challenge;
  /** The hearts the duck house started with (fixing it can't go past this). */
  maxHearts: number;
  /** Whether this is the Endless Pond (which adds training and fixing the duck house). */
  endless: boolean;
  /** Hearts bought back by fixing the duck house (each one costs more). */
  repairs: number;
  /** Endless Pond: Pond Perks picked so far, and how many times each. */
  perks: PerksTaken;
  /** Endless Pond: perks on offer right now (pick one before the next wave). */
  perkChoice?: PerkId[];
}

/** What the game needs from a level. */
export interface GameMap {
  path: Path;
  sky?: Point[];
  /** Where the solar fountain is (leave out for no fountain). */
  fountainAt?: Point;
  /** Where predators from the pond climb out (leave out for no pond). */
  pondAt?: Point;
  /** Special map tiles (see src/data/tiles.ts). */
  mud?: Ellipse[];
  brambles?: Ellipse[];
  specialNests?: { at: Point; kind: NestKind }[];
}

/** The fountain sits in the middle of the level's first pond, and turtles climb out of it. */
export function mapFromLevel(level: Level): GameMap {
  const pond = level.ponds[0]?.center;
  return {
    path: makePath(level.path),
    sky: level.sky,
    fountainAt: pond,
    pondAt: pond,
    mud: level.mud,
    brambles: level.brambles,
    specialNests: level.specialNests,
  };
}

export type GameEvent =
  | BattleEvent
  | { type: 'perkOffered'; perks: PerkId[] }
  | { type: 'spawned'; enemy: Enemy }
  | { type: 'shooed'; enemy: Enemy }
  | { type: 'waveCleared'; waveIndex: number; bonus: number }
  | { type: 'won' }
  | { type: 'lost' };

/**
 * A new game. A Daily Challenge twist, if given, changes the peas, hearts, waves, and rules.
 * `endless` turns on the Endless Pond's extras: training ducks and fixing the duck house.
 */
export function createGame(map: GameMap, waves: readonly Wave[], difficulty: Difficulty, challenge?: Challenge, endless = false): Game {
  if (waves.length === 0) {
    throw new Error('A level needs at least one wave');
  }
  const settings = challengeSettings(difficulty, challenge);
  return {
    battle: createBattle(map.path, {
      sky: map.sky,
      fountainAt: map.fountainAt,
      pondAt: map.pondAt,
      enemySpeed: settings.enemySpeed,
      mud: map.mud,
      brambles: map.brambles,
      specialNests: map.specialNests,
    }),
    waves: challengeWaves(waves, challenge),
    enemyHealth: settings.enemyHealth,
    peas: settings.startingPeas,
    hearts: settings.hearts,
    waveIndex: 0,
    phase: 'building',
    waveTime: 0,
    pending: [],
    battery: BATTERY.startCharge,
    blessingUsed: false,
    shieldTime: 0,
    challenge,
    maxHearts: settings.hearts,
    endless,
    repairs: 0,
    perks: {},
  };
}

/** Day or night for the wave being fought, or the next one while building. */
export function isNight(game: Game): boolean {
  const wave = game.waves[Math.min(game.waveIndex, game.waves.length - 1)]!;
  return wave.time === 'night';
}

export function canUseBlessing(game: Game): boolean {
  return !game.blessingUsed && !isOver(game) && !game.challenge?.noCraig;
}

/** Craig's Guardian Blessing: shield the duck house. Once per level. */
export function useBlessing(game: Game): boolean {
  if (!canUseBlessing(game)) return false;
  game.blessingUsed = true;
  game.shieldTime = CRAIG.shieldTime;
  return true;
}

export function isOver(game: Game): boolean {
  return game.phase === 'won' || game.phase === 'lost';
}

/** Whether this duck can play today (a Daily Challenge can leave some out). */
export function isDuckAllowed(game: Game, kind: DuckKind): boolean {
  return game.challenge?.ducks?.includes(kind) ?? true;
}

/** Whether no more ducks can be placed right now (a trial can cap how many are out at once). */
export function isFlockFull(game: Game): boolean {
  const max = game.challenge?.maxDucks;
  return max !== undefined && game.battle.ducks.length >= max;
}

export function canBuy(game: Game, kind: DuckKind): boolean {
  return !isOver(game) && isDuckAllowed(game, kind) && !isFlockFull(game) && game.peas >= DUCKS[kind].cost;
}

/** Whether ducks can be sold (a Daily Challenge can turn it off). */
export function canSell(game: Game): boolean {
  return !isOver(game) && !game.challenge?.noSelling;
}

/** Spends peas to place a duck. Returns undefined if you can't afford it. */
export function buyDuck(game: Game, kind: DuckKind, at: Point): Duck | undefined {
  if (!canBuy(game, kind)) return undefined;
  game.peas -= DUCKS[kind].cost;
  const duck = placeDuck(game.battle, kind, at);
  // Changed your mind? A duck placed between waves gives every pea back until the next wave starts.
  duck.fresh = game.phase === 'building';
  return duck;
}

/** Every pea spent on a duck: its price, upgrades, and training. */
function spentOn(kind: DuckKind, level = 0, training = 0, path = 0): number {
  let spent = totalSpent(kind, level, path);
  for (let t = 0; t < training; t++) spent += trainingCostAt(t);
  return spent;
}

/** Peas you'd usually get back for selling a duck: part of everything spent on it, upgrades and training included. */
export function sellValue(kind: DuckKind, level = 0, training = 0, path = 0): number {
  return Math.floor(spentOn(kind, level, training, path) * SELL_REFUND);
}

/** Peas you'd get back for selling this duck right now: everything if it was only just placed, otherwise part. */
export function refundFor(duck: Duck): number {
  return duck.fresh ? spentOn(duck.kind, duck.level, duck.training, duck.path) : sellValue(duck.kind, duck.level, duck.training, duck.path);
}

/**
 * The peas that count toward the score: the ones left over plus everything spent on the
 * ducks still out. (So spending peas never costs score, and selling ducks never adds any.)
 */
export function scorePeas(game: Game): number {
  return game.battle.ducks.reduce((sum, d) => sum + spentOn(d.kind, d.level, d.training, d.path), game.peas);
}

/** Peas for training level `done + 1`. */
function trainingCostAt(done: number): number {
  return Math.round(ENDLESS.training.firstCost * ENDLESS.training.costGrowth ** done);
}

/** What the next level of training costs for a duck, or undefined if it can't train (yet). */
export function trainingCost(game: Game, duckId: number): number | undefined {
  const duck = findDuck(game.battle, duckId);
  if (!game.endless || !duck || upgradeOptions(duck.kind, duck.level).length > 0) return undefined;
  return trainingCostAt(duck.training);
}

/** Endless Pond only: once a duck has both upgrades, train it to hit harder. */
export function trainDuck(game: Game, duckId: number): boolean {
  const cost = trainingCost(game, duckId);
  const duck = findDuck(game.battle, duckId);
  if (isOver(game) || !duck || cost === undefined || game.peas < cost) return false;
  game.peas -= cost;
  duck.training++;
  return true;
}

/** What fixing the duck house (one heart back) costs, or undefined if it can't be fixed right now. */
export function repairCost(game: Game): number | undefined {
  if (!game.endless || isOver(game) || game.hearts >= game.maxHearts) return undefined;
  return Math.round(ENDLESS.repair.firstCost * ENDLESS.repair.costGrowth ** game.repairs);
}

/** Endless Pond only: spend peas to get a heart back (up to the hearts you started with). */
export function repairHouse(game: Game): boolean {
  const cost = repairCost(game);
  if (cost === undefined || game.peas < cost) return false;
  game.peas -= cost;
  game.hearts++;
  game.repairs++;
  return true;
}

/**
 * Whether a duck can be upgraded right now (not maxed out, and you have the peas). For the
 * final upgrade, `path` picks which of the two (0 or 1).
 */
export function canUpgrade(game: Game, duckId: number, path = 0): boolean {
  const duck = findDuck(game.battle, duckId);
  const upgrade = duck && nextUpgrade(duck.kind, duck.level, path);
  return !isOver(game) && !!upgrade && game.peas >= upgrade.cost;
}

/** Buys a duck's next upgrade (for the final one, the path picked). Returns false if it's maxed out or you can't afford it. */
export function upgradeDuck(game: Game, duckId: number, path = 0): boolean {
  if (!canUpgrade(game, duckId, path)) return false;
  const duck = findDuck(game.battle, duckId)!;
  game.peas -= nextUpgrade(duck.kind, duck.level, path)!.cost;
  if (isFinalChoice(duck.kind, duck.level)) duck.path = path;
  duck.level++;
  return true;
}

/** Sells a duck for part of its cost. Returns the peas refunded, or undefined if it can't be sold. */
export function sellDuck(game: Game, duckId: number): number | undefined {
  if (!canSell(game)) return undefined;
  const duck = findDuck(game.battle, duckId);
  if (!duck) return undefined;
  game.battle.ducks = game.battle.ducks.filter((d) => d !== duck);
  const refund = refundFor(duck);
  game.peas += refund;
  return refund;
}

export function isSpotTaken(game: Game, at: Point): boolean {
  return game.battle.ducks.some((d) => distance(d.position, at) < 1);
}

/** Moves a duck to an empty spot. It needs a moment to settle before it attacks again. */
export function moveDuck(game: Game, duckId: number, to: Point): boolean {
  if (isOver(game) || isSpotTaken(game, to)) return false;
  const duck = findDuck(game.battle, duckId);
  if (!duck) return false;
  duck.position = { ...to };
  duck.cooldown = Math.max(duck.cooldown, MOVE_SETTLE_TIME);
  duck.abilityCooldown = Math.max(duck.abilityCooldown, MOVE_SETTLE_TIME);
  return true;
}

/** Changes which predator a duck goes after. Works during waves too. */
export function setTargeting(game: Game, duckId: number, targeting: Targeting): boolean {
  const duck = findDuck(game.battle, duckId);
  if (isOver(game) || !duck) return false;
  duck.targeting = targeting;
  return true;
}

export interface PreviewEntry {
  enemy: EnemyKind;
  count: number;
  /** True the first time this kind of predator shows up in the level. */
  isNew: boolean;
}

/** What's coming in a wave: each kind of predator and how many, in the order they first appear. */
export function wavePreview(waves: readonly Wave[], waveIndex: number): PreviewEntry[] {
  const wave = waves[waveIndex];
  if (!wave) return [];
  const seenBefore = new Set(waves.slice(0, waveIndex).flatMap((w) => w.groups.map((g) => g.enemy)));
  const entries: PreviewEntry[] = [];
  for (const spawn of scheduleWave(wave)) {
    const entry = entries.find((e) => e.enemy === spawn.enemy);
    if (entry) entry.count++;
    else entries.push({ enemy: spawn.enemy, count: 1, isNew: !seenBefore.has(spawn.enemy) });
  }
  return entries;
}

/** Lists every predator in a wave with the time it appears, soonest first. */
export function scheduleWave(wave: Wave): ScheduledSpawn[] {
  const spawns: ScheduledSpawn[] = [];
  for (const group of wave.groups) {
    for (let i = 0; i < group.count; i++) {
      spawns.push({ time: (group.after ?? 0) + i * group.every, enemy: group.enemy });
    }
  }
  return spawns.sort((a, b) => a.time - b.time);
}

/** Sends the next wave. Only works between waves, once any Pond Perk on offer has been picked. */
export function startWave(game: Game): boolean {
  if (game.phase !== 'building' || game.perkChoice) return false;
  game.phase = 'wave';
  for (const duck of game.battle.ducks) duck.fresh = false;
  beginWave(game);
  return true;
}

/** Lines up the predators for the wave at `waveIndex` and sets how it plays (night, tougher predators). */
function beginWave(game: Game): void {
  const wave = game.waves[game.waveIndex]!;
  game.waveTime = 0;
  game.pending = scheduleWave(wave);
  game.battle.night = wave.time === 'night';
  game.battle.enemyHealth = (wave.health ?? 1) * game.enemyHealth;
}

/** Whether you can send the next wave now: every predator in this wave is out, and there's another wave. */
export function canCallEarly(game: Game): boolean {
  return game.phase === 'wave' && game.pending.length === 0 && game.waveIndex + 1 < game.waves.length;
}

/** Extra peas for calling the next wave now: some for every predator still out there. */
export function earlyBonus(game: Game): number {
  return EARLY_CALL.peasPerPredator * game.battle.enemies.length;
}

/** Everything you'd earn for calling the next wave now: this wave's bonus plus the early bonus. */
export function earlyCallPeas(game: Game): number {
  return waveBonus(game) + earlyBonus(game);
}

/**
 * Sends the next wave while this one is still going. Pays this wave's bonus now, plus the
 * early bonus. Returns the peas earned, or undefined if you can't call early right now.
 */
export function callNextWave(game: Game): number | undefined {
  if (!canCallEarly(game)) return undefined;
  const earned = earlyCallPeas(game);
  game.peas += earned;
  game.waveIndex++;
  restCraigIfDue(game);
  offerPerksIfDue(game);
  beginWave(game);
  return earned;
}

/** The peas for clearing the current wave (Early Riser makes day waves pay more). */
function waveBonus(game: Game): number {
  const wave = game.waves[game.waveIndex]!;
  return Math.round(wave.bonusPeas * (wave.time === 'day' ? game.battle.mods.dayBonus : 1));
}

/** The peas for chasing off a predator (Pea Picker and the like make them pay more). */
export function killPeas(game: Game, kind: EnemyKind): number {
  return Math.round(ENEMIES[kind].peas * game.battle.mods.killPeas);
}

/** Endless Pond: after every few waves, Craig has rested and her blessing is ready again. */
function restCraigIfDue(game: Game): void {
  const every = game.battle.mods.craigEvery || ENDLESS.craigEvery;
  if (game.endless && game.waveIndex % every === 0) game.blessingUsed = false;
}

/** Endless Pond: after every few waves, offer Pond Perks. Returns true if it just did. */
function offerPerksIfDue(game: Game): boolean {
  if (!game.endless || game.perkChoice || game.waveIndex === 0 || game.waveIndex % ENDLESS.perkEvery !== 0) return false;
  // (waveIndex is now the number of the wave just finished.)
  const offer = offerPerks(game.perks, game.waveIndex, bossCount(game.waveIndex) > 0);
  if (offer.length === 0) return false;
  game.perkChoice = offer;
  return true;
}

/** Picks one of the Pond Perks on offer. Returns false if it isn't one of them. */
export function choosePerk(game: Game, id: PerkId): boolean {
  if (!game.perkChoice?.includes(id) || isOver(game)) return false;
  game.perkChoice = undefined;
  game.perks = { ...game.perks, [id]: (game.perks[id] ?? 0) + 1 };
  game.battle.mods = perkMods(game.perks);
  const { hearts, peas } = PERKS[id].effect;
  if (hearts) {
    game.hearts += hearts;
    game.maxHearts += hearts;
  }
  if (peas) game.peas += peas;
  return true;
}

/** Advances the game by `dt` seconds. Nothing moves between waves. */
export function update(game: Game, dt: number): GameEvent[] {
  if (game.phase !== 'wave') return [];
  const events: GameEvent[] = [];

  game.waveTime += dt;
  updateBattery(game, dt);
  game.shieldTime = Math.max(0, game.shieldTime - dt);
  while (game.pending.length > 0 && game.pending[0]!.time <= game.waveTime) {
    const spawn = game.pending.shift()!;
    events.push({ type: 'spawned', enemy: spawnEnemy(game.battle, spawn.enemy) });
  }

  const shielded = game.shieldTime > 0;
  for (const event of step(game.battle, dt)) {
    if (event.type === 'reachedHouse' && shielded) {
      // Craig shoos it away: no heart lost (and no peas either).
      events.push({ type: 'shooed', enemy: event.enemy });
      continue;
    }
    events.push(event);
    if (event.type === 'defeated') game.peas += killPeas(game, event.enemy.kind);
    if (event.type === 'reachedHouse') game.hearts = Math.max(0, game.hearts - ENEMIES[event.enemy.kind].hearts);
  }

  if (game.hearts === 0) {
    game.phase = 'lost';
    events.push({ type: 'lost' });
    return events;
  }

  if (game.pending.length === 0 && game.battle.enemies.length === 0) {
    const bonus = waveBonus(game);
    game.peas += bonus;
    events.push({ type: 'waveCleared', waveIndex: game.waveIndex, bonus });
    game.waveIndex++;
    restCraigIfDue(game);
    if (game.waveIndex >= game.waves.length) {
      game.phase = 'won';
      events.push({ type: 'won' });
    } else {
      game.phase = 'building';
      if (offerPerksIfDue(game)) events.push({ type: 'perkOffered', perks: game.perkChoice! });
    }
  }

  return events;
}

/** The sun charges the battery in day waves; the fountain runs off it whenever it has charge. */
function updateBattery(game: Game, dt: number): void {
  if (!isNight(game)) game.battery += BATTERY.solarPerSecond * dt;
  const fountain = game.battle.fountain;
  if (fountain) {
    fountain.on = game.battery > 0;
    if (fountain.on) game.battery -= FOUNTAIN.drawPerSecond * dt;
  }
  game.battery = Math.min(BATTERY.capacity, Math.max(0, game.battery));
}
