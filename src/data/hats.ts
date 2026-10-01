// Hats the ducks can wear. Win levels to earn stars, and stars unlock hats. Pick a hat
// for each duck in the Wardrobe (the hat button on the title screen).
// To add a hat: draw it in src/art/sprites.ts (see hatSvg), then add it here.

export type HatKind =
  | 'party'
  | 'flower'
  | 'bow'
  | 'beanie'
  | 'cowboy'
  | 'chef'
  | 'pirate'
  | 'propeller'
  | 'tophat'
  | 'wizard'
  | 'crown';

export interface HatInfo {
  name: string;
  stars: number; // total stars needed to unlock it (0 = unlocked from the start)
}

// In the order they show in the Wardrobe. There are 36 stars to earn
// (6 levels x 3 stars x Easy and Normal), so the last hat needs every one.
export const HATS: Record<HatKind, HatInfo> = {
  party: { name: 'Party Hat', stars: 0 },
  flower: { name: 'Daisy', stars: 1 },
  bow: { name: 'Big Bow', stars: 3 },
  beanie: { name: 'Beanie', stars: 5 },
  cowboy: { name: 'Cowboy Hat', stars: 7 },
  chef: { name: "Chef's Hat", stars: 9 },
  pirate: { name: 'Pirate Hat', stars: 11 },
  propeller: { name: 'Propeller Cap', stars: 13 },
  tophat: { name: 'Top Hat', stars: 15 },
  wizard: { name: 'Wizard Hat', stars: 18 },
  crown: { name: 'Golden Crown', stars: 36 },
};

export const HAT_ORDER = Object.keys(HATS) as HatKind[];
