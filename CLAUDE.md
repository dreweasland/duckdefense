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
- **Maps:** Tiled (`.tmj` JSON). The kids can design levels visually, no code needed.
- **Tests:** Vitest, for game logic only (damage, waves, synergy). Keep rendering out of tests.
- **Hosting:** Cloudflare Workers with static assets, configured in `wrangler.jsonc`, with
  www.duckdefense.com as the main custom domain. A Cloudflare redirect rule sends the bare
  domain to www. Cloudflare Workers Builds (connected to the GitHub repo) builds and
  deploys on push to `main`. A GitHub Actions CI workflow runs tests and the build on
  pushes and PRs, but does not deploy.
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
| **Potato** | Black Swedish | The chaser | Fast attack. "Wing Flap" knockback, a nod to his signature untucked wing |
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
for a one-time **Guardian Blessing** that shields the duck house. Use she/her for Craig
everywhere: dialogue, tooltips, code comments.

## Predators (enemies)

| Enemy | Movement | Notes |
|---|---|---|
| Raccoon | Ground path | Baseline enemy. Clever: occasionally dodges |
| Fox | Ground path | Fast, low health. Shakes off most of an Alarm Quack, so Curtis's slow is the answer |
| Mink | Ground path | Small and slippery. Hides in the grass: ducks only spot it up close until Chester's Alarm Quack flushes it out |
| Hawk | Flying | Ignores the path and dives straight at the house. Only some ducks can hit it. Scares ducks it swoops over |
| Snapping Turtle | From the pond | Slow, huge health. Climbs out of the pond and cuts across to the path. Its shell (armor) blocks part of every hit, so big splashes beat little pecks |
| **Boss: The Night Bandit** | Ground path | A masked mega-raccoon at the end of each world. Whistles up raccoon minions, scaring nearby ducks |

## Economy and systems

- **Currency: peas.** Earned per kill and per wave cleared. Spent to place and upgrade ducks.
- **Selling and moving:** Tap a placed duck to see its power and sell it (75% of its cost
  back) or move it to another empty nest (free, but it needs a second to settle). Both
  numbers are in `src/data/ducks.ts`.
- **Lives:** The duck house has hearts. Each predator that reaches it costs one (the Night Bandit costs five).
- **Day/night cycle:** Night waves are harder. The **solar battery meter** powers the
  pond fountain, whose refreshing spray makes nearby ducks hit harder. It charges during
  day waves and drains at night, just like the real Victron setup.
- **Aiming:** Tap a duck to pick who it goes after: First, Strong, Last, or Near
  (`src/data/targeting.ts`).
- **Wave preview:** Between waves, chips beside the start button show what's coming. Tap one
  for what that predator does and which duck beats it (`description` and `beatenBy` in
  `src/data/enemies.ts`).
- **Call early:** Once a wave's predators are all out, you can send the next wave right away
  for its bonus plus peas per predator still out (`EARLY_CALL` in `src/data/waves.ts`).
- **Damage report:** Each duck counts its damage, the predators it chased off (last hit),
  and its power (`power.stat` in `src/data/ducks.ts`: splashed, flapped, froze, slowed).
  Tap a duck to see its numbers; the result screen totals them per kind, and the top
  damage-dealer wears a crown.
- **Daily Challenge:** One level and one twist per UTC day, the same for everyone, with its
  own leaderboard. Twists live in `src/data/challenges.ts`; the rules shared with the server
  are in `src/logic/daily.ts`.
- **Upgrades:** Two tiers per duck (e.g. Sunny → "Seasoned Sunny" → "Legendary Sunny"),
  bought from the duck's panel. Names, prices, and what changes are in `src/data/ducks.ts`.

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
  screens, and an Easy/Normal difficulty toggle.
- **M3: Depth.** Pecking Loop synergy, flying hawks, day/night cycle with the solar
  battery, the fountain tower, Craig's blessing.
- **M4: Make it ours.** Sound system (the kids' recordings drop into `src/sounds/`; anything
  missing uses a built-in placeholder), three levels (`src/data/levels.ts`), and the Night
  Bandit boss fight at the end of level 3. Levels 2 and 3 were designed by Claude; the kids
  can redesign them or add their own in Tiled. (Art was overhauled into polished vector art
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
