import { DUCKS, type DuckKind } from '../data/ducks';
import type { EnemyKind } from '../data/enemies';
import type { HintId } from '../data/hints';
import { CHASES } from '../data/synergy';
import { chasePartner } from './battle';
import { canBuy, canUpgrade, canUseBlessing, type Game } from './game';
import { challengeSettings } from './daily';
import type { Difficulty } from '../data/difficulty';

// Which of Craig's hints fits what just happened. The words are in src/data/hints.ts.

/** Why Craig might speak: a predator got into the duck house, or nobody has placed a duck yet. */
export type HintMoment = { type: 'heartLost'; enemy: EnemyKind } | { type: 'noDucksYet' };

// When a predator gets in and no duck on the map is its best answer, say which duck is.
const COUNTER_HINTS: Partial<Record<EnemyKind, { hint: HintId; answered: (kinds: DuckKind[]) => boolean }>> = {
  hawk: { hint: 'hawks', answered: (kinds) => kinds.some((k) => DUCKS[k].canHitFlying) },
  mink: { hint: 'minks', answered: (kinds) => kinds.includes('chester') },
  turtle: { hint: 'turtles', answered: (kinds) => kinds.includes('sunny') },
  fox: { hint: 'foxes', answered: (kinds) => kinds.includes('curtis') },
  bandit: { hint: 'bandit', answered: (kinds) => kinds.includes('curtis') },
};

// Hearts at or below this share of the start, with Craig's blessing unused: suggest calling her.
const LOW_HEARTS = 0.5;

/**
 * The hint for this moment, if one fits and hasn't been shown yet. `emptyNests` is how many
 * nests are free. Hints are checked in order: Craig's blessing when hearts are low, the duck
 * that beats the predator that got in, then general tips.
 */
export function pickHint(
  game: Game,
  difficulty: Difficulty,
  moment: HintMoment,
  emptyNests: number,
  shown: ReadonlySet<HintId>,
): HintId | undefined {
  const fits = (hint: HintId, when: boolean) => when && !shown.has(hint);
  const ducks = game.battle.ducks;
  const kinds = [...new Set(ducks.map((d) => d.kind))];

  if (moment.type === 'noDucksYet') return fits('placeFirstDuck', ducks.length === 0) ? 'placeFirstDuck' : undefined;

  const startingHearts = challengeSettings(difficulty, game.challenge).hearts;
  const candidates: [HintId, boolean][] = [
    ['callCraig', canUseBlessing(game) && game.hearts <= startingHearts * LOW_HEARTS],
  ];
  const counter = COUNTER_HINTS[moment.enemy];
  if (counter) candidates.push([counter.hint, !counter.answered(kinds)]);
  candidates.push(
    ['spendPeas', emptyNests > 0 && Object.keys(DUCKS).some((k) => canBuy(game, k as DuckKind))],
    ['upgrade', ducks.some((d) => canUpgrade(game, d.id))],
    // A chaser and the duck it chases are both out, but not next to each other.
    ['peckingLoop', ducks.some((d) => CHASES[d.kind] && kinds.includes(CHASES[d.kind]!) && !chasePartner(game.battle, d))],
    ['bends', true],
  );
  return candidates.find(([hint, when]) => fits(hint, when))?.[0];
}
