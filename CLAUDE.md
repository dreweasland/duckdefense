# Duck Defense

A tower-defense game starring a real backyard flock, built by Drew and his two sons.
Live at **www.duckdefense.com** (duckdefense.com redirects there).

## The pitch

Predators are coming for the Nestera duck house. Place ducks around the pond to stop
them before they reach it. Every duck is a real bird with a real personality, and the
game mechanics come from how they actually behave.

## Tech stack

- **Engine:** Phaser 3 + TypeScript
- **Build:** Vite (fast hot reload, so kids see changes instantly)
- **Maps:** Tiled (`.tmj` JSON). The kids can design levels visually, no code needed. A map can
  have several trails (polylines in the `path` layer) that all end at the duck house; spawn
  groups pick one with `path`, or take turns. See `maps/README.md`.
- **Tests:** Vitest, for game logic only (damage, waves, synergy). Keep rendering out of tests.
- **Hosting:** Cloudflare Workers with static assets, configured in `wrangler.jsonc`, with
  www.duckdefense.com as the main custom domain. A Cloudflare redirect rule sends the bare
  domain to www. Cloudflare Workers Builds (connected to the GitHub repo) builds and
  deploys on push to `main`. A GitHub Actions CI workflow runs tests and the build on
  pushes and PRs, but does not deploy.
  `public/_headers` sets response headers for the static files (long caching for the
  fingerprinted files in `/assets/`).
- **Backend:** The same Worker (`worker/index.ts`) serves a small leaderboard API backed by
  D1 (`migrations/`). Name and score rules shared with the game live in
  `src/logic/leaderboard.ts`. Run it locally with `npm run dev:api` alongside `npm run dev`.
- **Art:** Original vector-cartoon art: bold outlines, soft shading. Every sprite is an SVG
  built in `src/art/sprites.ts` (the ducks share one silhouette in their real breed colors)
  and loaded as textures by `BootScene`. Terrain and scenery are drawn in `src/art/terrain.ts`;
  shared colors, fonts (Fredoka), and draw layers live in `src/ui/theme.ts`. The canvas
  renders at 2x for sharp art on phones, so scenes lay out in 1280 x 720 world units.

Keep game logic, meaning stats, wave definitions, and synergy rules, in plain TypeScript
under `src/logic/`, separate from Phaser scenes. That keeps it testable and makes it easy
for the kids to tweak numbers in one data file.

## The flock (towers)

| Duck | Breed | Role | Ability |
|---|---|---|---|
| **Sunny** | Blue Swedish | The veteran | Steady all-rounder with a small splash-damage radius |
| **Potato** | Black Swedish | The chaser | Fast attack, and double damage to anything that flies (he's the hawk specialist). "Wing Flap" knockback, a nod to his signature untucked wing |
| **Chester** | Magpie | The elder | "Alarm Quack" briefly stuns every enemy in range, on a cooldown |
| **Curtis** | Magpie | The unbothered one | Never scared (the others get scared by hawks and the Night Bandit). Predators near him slow to a trudge |

### Pecking Loop synergy
In the real flock, Sunny chases Chester, Potato chases Sunny, and Curtis ignores everyone.
In the game, when a duck is placed next to the duck it "goes after," it gets **+20% attack
speed**. Curtis grants no synergy and receives none, but he's never affected by enemy
debuffs. Chasing the best loop layout is the strategy.

### Craig
Craig was the family's first duck: a female mallard, named before anyone knew she was a
hen. She appears as a spirit guide in the tutorial, and once per level you can call on her
for a one-time **Guardian Blessing** that shields the duck house (in the Endless Pond
it comes back after every 10th wave: `craigEvery` in `src/data/endless.ts`). Use she/her for Craig
everywhere: dialogue, tooltips, code comments.

## Predators (enemies)

| Enemy | Movement | Notes |
|---|---|---|
| Raccoon | Ground path | Baseline enemy |
| Fox | Ground path | Fast, low health. Shakes off most of an Alarm Quack, so Curtis's slow is the answer |
| Mink | Ground path | Small and slippery. Hides in the grass: ducks only spot it up close until Chester's Alarm Quack flushes it out |
| Skunk | Ground path | A tough waddler. Splash it and it sprays: the duck that splashed it and every duck nearby run off scared (not Curtis), and it keeps spraying as long as it keeps getting splashed. Peck it one-on-one instead: Potato's the answer. First seen in Night Woods; the Skunk Patch trial is where a splash-only flock finally loses |
| Hawk | Flying | Ignores the path and dives straight at the house. Only some ducks can hit it. Scares ducks it swoops over |
| Snapping Turtle | From the pond | Slow, huge health. Climbs out of the pond and cuts across to the path. Its shell (armor) blocks part of every hit, so big splashes beat little pecks |
| **Boss: The Night Bandit** | Ground path | A masked mega-raccoon at the end of level 3 (he drops by Snapper Swamp too). Whistles up raccoon minions, scaring nearby ducks |
| **Boss: The Storm Hawk** | Flying | Hawk Hill and the Endless Pond. A giant hawk that calls in hawks and scares ducks it swoops near. Only Sunny and Potato can hit it. Always flies in from the sky point farthest from the house |
| **Boss: The Silver Fox** | Ground path | Fox Run and the Endless Pond. Fast, barely freezes, calls in foxes. Curtis's slow is the answer |
| **Boss: Old Snapper** | From the pond | Snapper Swamp and the Endless Pond. A huge mossy turtle with a thick shell (little pecks do 1 damage) that can't be pushed back |

**Boss phases:** every boss gets a second wind at half health (`phase` in `src/data/enemies.ts`):
it shouts, the screen shakes, its bar turns orange, and some stats change from then on. The
Night Bandit whistles up three raccoons at a time; the Storm Hawk's scare grows and she calls
hawks faster; the Silver Fox panics (faster, but Chester's quack finally sticks); Old Snapper's
shell cracks (thinner armor, but it comes on quicker). `enemyStats(enemy)` already folds the
phase in.

**Variants:** any spawn group can carry a `variant` (`src/data/variants.ts`) that twists the
predator on arrival: **Armored** (+3 armor), **Rabid** (1.7x speed, 0.7x health), **Sneaky**
(hides like a mink), **Regrowing** (heals when nothing has hit it for 1.5 s). They drop 1.5x
peas, wear a tint, show as their own chip in the wave preview ("Armored Raccoon"), and never
apply to bosses. Levels 4 to 6 introduce them; the Endless Pond adds one twisted group a wave
from wave 12 and one more every 10 (`ENDLESS.variants`), skipping bosses, skunks, and sneaky
flyers. `enemyStats(enemy)` in `src/logic/battle.ts` is the stats-with-twist lookup.

## Economy and systems

- **Currency: peas.** Earned per kill and per wave cleared. Spent to place and upgrade ducks.
- **Selling and moving:** Tap a placed duck to see its power and sell it (75% of its cost
  back) or move it to another empty nest (free, but it needs a second to settle). Both
  numbers are in `src/data/ducks.ts`. A duck placed between waves can be sold for every
  pea it cost until the next wave starts, so a misplaced duck costs nothing.
- **Score:** 100 per heart kept, plus peas left over and peas spent on the ducks still out
  (`scorePeas` in `src/logic/game.ts`), doubled on Normal and tripled on Hard. Spending never costs score and
  selling never adds any.
- **Pause:** The pause button above the sound button (or Esc) freezes the game and opens
  `PauseScene`: Play, Again, or Levels (the last two ask "are you sure?" first). Leaving an Endless Pond run this way still saves
  the waves survived.
- **Lives:** The duck house has hearts. Each predator that reaches it costs one (the Night Bandit costs five).
- **Difficulties:** Easy, Normal, and Hard (`src/data/difficulty.ts`: peas, hearts, predator speed
  and health, score multiplier). Hard has 5 hearts and predators 10% faster, so a boss getting in
  is the end. `npm test` checks every level can be won on Hard by a sensible team. Progress,
  stars, and leaderboards are kept per difficulty.
- **Day/night cycle:** Night waves are harder. The **solar battery meter** powers the
  pond fountain, whose refreshing spray makes nearby ducks hit harder. It charges during
  day waves and drains at night, just like the real Victron setup.
- **Special map tiles:** Level designers can add `mud` (predators slow to half speed) and
  `brambles` (predators take damage) patches over the path, and mark nests as `hill`
  (+20% reach) or `water` (+15% damage) with their Tiled class. See `maps/README.md`;
  the numbers are in `src/data/tiles.ts`.
- **Aiming:** Tap a duck to pick who it goes after: First, Strong, Last, or Near
  (`src/data/targeting.ts`).
- **Sandbox:** On a level's sheet, under Play. The level with 9999 peas and 99 hearts and
  arrows under the counters to jump to any wave (`src/data/sandbox.ts`), for trying things
  out and for tuning a new wave. Nothing is saved or posted.
- **Flock powers:** One big move per kind of duck, on a column of round buttons down the
  right edge (`src/data/powers.ts`, logic in `src/logic/powers.ts`, moves in
  `src/logic/battle.ts`). A power is ready once a duck of that kind is out and a wave is on,
  then rests for its cooldown (shown as a shrinking shade and a countdown). Every duck of the
  kind joins in: **Tidal Wave** (Sunny: a giant soaking splash in each Sunny's reach), **Flap
  Storm** (Potato: everything in reach blown back and dizzy), **Mega Quack** (Chester: every
  predator on the map frozen, hiders flushed), **Hold the Line** (Curtis: for 6 s nothing
  scares the flock and ground predators trudge). The balance simulator doesn't use them
  (`powers: true` makes it), so they're pure help for a real player.
- **Wave preview:** Between waves, chips beside the start button show what's coming. Tap one
  for what that predator does and which duck beats it (`description` and `beatenBy` in
  `src/data/enemies.ts`).
- **Call early:** Once a wave's predators are all out, you can send the next wave right away
  for its bonus plus peas per predator still out (`EARLY_CALL` in `src/data/waves.ts`).
- **Damage report:** Each duck counts its damage, the predators it chased off (last hit),
  and its power (`power.stat` in `src/data/ducks.ts`: splashed, flapped, froze, slowed).
  Tap a duck to see its numbers; the result screen totals them per kind, and the top
  damage-dealer wears a crown.
- **Hats:** Stars from winning levels (and ribbons from Level Trials) unlock hats
  (`src/data/hats.ts`, drawn in `src/art/sprites.ts`). Pick one for each duck in the Wardrobe (hat button on the title
  screen); the ducks wear them everywhere. A great job for the art director.
- **Craig's hints:** When a predator gets into the duck house (or nobody has placed a duck
  yet), Craig pops up beside her button with a tip that fits: call her when hearts are low,
  the duck that beats the predator that got in, then general tips. Each hint shows once per
  visit. Words in `src/data/hints.ts`, rules in `src/logic/hints.ts`.
- **The balance simulator** (`src/logic/simulate.ts`) is the floor every level must clear: it
  fills the best-coverage nests with one kind of duck (or a team taking turns), upgrades with
  spare peas, and calls Craig when the boss (or anything, if there's no boss) is nearly at the
  door. It never uses flock powers unless asked. `npm test` runs it on every level, trial, and
  difficulty, so a change to a map or a number that makes something unwinnable fails loudly.
- **Endless Pond:** Waves on any map you've opened (pick one from the Endless sheet on the level
  select screen) until the hearts run out; the score is waves survived, with a leaderboard per map
  (the Endless tab has a pill for each). Waves are built by a formula (no randomness,
  so it's fair) from the numbers in `src/data/endless.ts`: when each predator joins, how
  fast they grow, and how much tougher they get (`health` on a wave, growing 4.5% a wave on
  top of the last). A boss comes every 10th wave, then every 5th from wave 20, taking
  turns (Night Bandit, Storm Hawk, Silver Fox, Old Snapper), with one more boss at once
  every 25 waves. Endless scores are stored on the leaderboard with a negative level: -1 for the
  first map, -2 for the second (`endlessLevel` in `src/data/endless.ts`). Best waves are saved
  per map and difficulty.
  Endless only, so peas never pile up: fully upgraded ducks can keep **training** (+15%
  damage per level, each costing more), and a button under the hearts **fixes the duck
  house** (one heart back, up to the starting hearts, each costing more). Both in
  `ENDLESS.training` and `ENDLESS.repair`.
  **Pond Perks** (Endless only): after every 5th wave the game waits while you pick 1 of 3
  perks, like Sharp Beaks (+10% damage) or Early Riser (day waves pay more). Perks stack
  up to a limit. Offers come from the wave number (no randomness). Perks are listed in
  `src/data/perks.ts`; `src/logic/perks.ts` turns them into multipliers the battle reads
  through `duckStats()`.
  **Boss rewards** (Endless only): after a boss wave the pick is from bigger perks that
  change a rule, each taken once: Craig's Watch (her blessing returns every 5 waves), Soggy
  Splash (Sunny's splashes slow predators), Sky Quack (Chester's quack blows hawks back),
  Prickly Curtis (predators near him lose health), Dizzy Flap (Potato's flap stuns), and New
  Nests (two more nests; `bonusNestsFor` in `src/logic/endless.ts` finds spots for them on
  whichever map is being played). They're the perks marked `boss: true` in
  `src/data/perks.ts`; once all are taken, boss waves offer the usual perks again.
- **Level Trials:** Once a level is beaten on a difficulty, its sheet (tap the level card)
  lists two trials: the same level with the rules bent, like only some ducks playing, half
  the peas, every wave at night, or only four ducks out at once (`maxDucks`). The first trial
  on each level leaves Sunny out or picks a small team, so players learn the other ducks.
  Winning one earns a **ribbon** on the level card (saved per difficulty in `trials` in
  `src/logic/progress.ts`), and ribbons unlock hats too (`ribbons` in `src/data/hats.ts`: the
  Laurel Wreath). Each trial has its own leaderboard (the `trial` column; pick a level tab on
  the Top Scores screen, then the trial's pill). Trials reuse the Daily Challenge `Challenge`
  rules and live in `src/data/trials.ts`; `npm test` checks every trial can be won on Easy by
  the simulator and on Normal by at least one sensible team (`src/logic/balance.test.ts`). The
  level sheet also shows the best score.
- **Daily Challenge:** One level and one twist per UTC day, the same for everyone, with its
  own leaderboard. About one day in three gets two twists at once ("Hawk Day + Thin Wallet":
  `combineChallenges` in `src/logic/daily.ts` applies both rules; `DOUBLE_TWIST_EVERY`), and
  `npm test` checks a couple of months of those days are winnable on Easy. Winning on days in a row builds a streak, shown on the Daily Challenge
  button and the win screen from the second day (`dailyStreak` in `src/logic/progress.ts`). Twists live in `src/data/challenges.ts`; the rules shared with the server
  are in `src/logic/daily.ts`.
- **Upgrades:** Two tiers per duck (e.g. Sunny → "Seasoned Sunny" → "Legendary Sunny"),
  then a **final upgrade where you pick one of two paths** and keep it (e.g. "Tidal Sunny",
  a giant splash, or "Eagle-Eye Sunny", long reach and double damage to hawks). Bought
  from the duck's panel. Names, prices, and what changes are in `src/data/ducks.ts`
  (`upgrades` and `finals`).

## Kid-friendly contribution points

Two builders, ages 6 and 14, with different jobs.

**The 14-year-old: level designer and junior dev**
1. **Level design** in Tiled: paths, pond shape, and where ducks can be placed.
2. **Balance tuning**: all numbers live in `src/data/*.ts` with plain comments.
3. **Owns a feature end to end**, such as one enemy type or one upgrade tier. He writes
   the TypeScript with Claude Code's help. Explain changes to him clearly, and let him
   drive rather than doing it all for him.
4. **Playtest lead**: runs test sessions and files the bugs.

**The 6-year-old: art director and chief quack officer**
1. **Art feedback**: looks over the game's art and calls out what should change (colors,
   faces, which duck looks like which).
2. **Sounds**: recorded quacks, raccoon noises, and a victory cheer.
3. **Naming**: the boss, the levels, the upgrades.
4. **Official playtester** of Easy Mode (see below).

**Easy Mode:** The game must be playable by a 6-year-old. That means big tap targets,
icons over text, generous starting peas, slower enemies, and no fail state that feels
harsh. Losing a heart should be funny, not sad.

When adding a feature, prefer a design where the tunable part lives in a data file.

## Milestones

- **M0: Scaffold and ship.** Vite + Phaser + TS project, a blank scene, and a Cloudflare
  Worker serving it at www.duckdefense.com. Get it live on day one.
- **M1: One duck, one raccoon.** A map loaded from Tiled, one path, one enemy walking it,
  click to place Sunny, Sunny attacks, the enemy dies or reaches the house.
- **M2: Full flock and waves.** All four ducks, a wave system, peas, lives, win/lose
  screens, and an Easy/Normal difficulty toggle (Hard came later).
- **M3: Depth.** Pecking Loop synergy, flying hawks, day/night cycle with the solar
  battery, the fountain tower, Craig's blessing.
- **M4: Make it ours.** Sound system (the kids' recordings drop into `src/sounds/`; anything
  missing uses a built-in placeholder), six levels in two worlds (`src/data/levels.ts`), and
  the Night Bandit boss fight at the end of level 3. World 2 (Hawk Hill, Fox Run, Snapper
  Swamp) ends each level with one of the other bosses: the Storm Hawk, the Silver Fox, and
  Old Snapper. Level 7, Two Trails, is the first map with two ways in (a serpentine from the
  west and a short zigzag from the north); the Night Bandit takes the long way. Levels 2 to 7
  were designed by Claude; the kids can redesign them or add their own in Tiled. The level
  select screen shows two rows of four cards, so there's room for one more level; a ninth
  needs pages (`CARD` in `LevelSelectScene.ts`). (Art was overhauled into polished vector art
  instead of the kids' drawings.)
- **M5: Polish.** Title screen, level select, save progress in localStorage, mobile touch
  support, and a public leaderboard on Workers + D1 (typed names, profanity-filtered,
  scores computed by the server, rate limited).

## Commands

- `npm run dev`: local dev server with hot reload
- `npm test`: run the Vitest logic tests (`src/logic/**/*.test.ts`)
- `npm run build`: typecheck and build to `dist/`
- `npm run deploy`: build and `wrangler deploy` by hand (Workers Builds does this on push to `main`)
- `npm run dev:api`: run the Worker and a local D1 database on port 8787 (Vite proxies `/api` to it)
- `npm run db:migrate`: apply database migrations to the real D1 database

## Conventions

- TypeScript strict mode. No `any`.
- One Phaser scene per file in `src/scenes/`.
- Entity stats and wave definitions live in `src/data/`, not hard-coded in scenes.
- Commit at the end of each working step with a clear message.
- No copyrighted or trademarked characters or assets. Everything is original or CC0.
