// Which predator a duck goes after when more than one is in reach.
// Tap a duck to change it. New ducks start with DEFAULT_TARGETING.

export type Targeting = 'first' | 'strong' | 'last' | 'close';

export interface TargetingInfo {
  name: string; // short, it goes on a small button
  description: string;
}

// The order the buttons appear in the duck's panel.
export const TARGETING_ORDER: readonly Targeting[] = ['first', 'strong', 'last', 'close'];

export const TARGETING: Record<Targeting, TargetingInfo> = {
  first: { name: 'First', description: 'Goes after the predator closest to the duck house.' },
  strong: { name: 'Strong', description: 'Goes after the predator with the most health.' },
  last: { name: 'Last', description: 'Goes after the predator farthest from the duck house.' },
  close: { name: 'Near', description: 'Goes after the predator closest to the duck.' },
};

export const DEFAULT_TARGETING: Targeting = 'first';
