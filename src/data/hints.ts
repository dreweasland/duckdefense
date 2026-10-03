// Craig's hints: when something goes wrong, Craig pops up beside her button with a tip.
// Change the words here. Which hint shows when is decided in src/logic/hints.ts
// (the first one that fits wins, in the order listed there). Each hint shows once per
// visit, so Craig never nags.

export type HintId =
  | 'placeFirstDuck'
  | 'callCraig'
  | 'hawks'
  | 'minks'
  | 'skunks'
  | 'turtles'
  | 'foxes'
  | 'bandit'
  | 'spendPeas'
  | 'powers'
  | 'upgrade'
  | 'peckingLoop'
  | 'bends';

export const HINTS: Record<HintId, string> = {
  placeFirstDuck: 'Tap a nest to put a duck there. Then tap the green button!',
  callCraig: "Uh oh! Tap my picture and I'll protect the duck house for a while.",
  hawks: "Hawks fly! Potato hits them hardest, and Sunny can too. The others can't.",
  minks: "Minks hide in the grass. Chester's quack helps everyone find them!",
  skunks: "Don't splash a skunk, it sprays! Potato's pecks chase it off safely.",
  turtles: "That turtle's shell is tough! Sunny's big splash works best.",
  foxes: 'Foxes are super fast! Curtis slows them down.',
  bandit: "The Night Bandit scares the flock. Curtis isn't scared of anybody!",
  spendPeas: "You've got peas to spend! Tap an empty nest to add a duck.",
  powers: 'See the glowing buttons under the ducks? Tap one for a big move during a wave!',
  upgrade: 'Tap a duck to make it stronger with an upgrade!',
  peckingLoop: 'Put Sunny next to Chester, or Potato next to Sunny. They go faster!',
  bends: 'Ducks inside a bend in the path can reach more predators.',
};

// Seconds between Craig's hints, so she doesn't talk too much.
export const HINT_GAP = 20;
