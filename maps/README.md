# Maps

Levels are made in [Tiled](https://www.mapeditor.org/). Open a `.tmj` file, edit it, and
save. If `npm run dev` is running, the game reloads with your changes.

The map is 32 × 18 tiles of 40 px, which is 1280 × 720, the same size as the game screen.

## Layers

Each level needs these **object layers** (the names must match exactly):

| Layer | What to put in it | Tiled tool |
|---|---|---|
| `path` | One or more polylines: the trails predators walk, from the first point to the last. The **duck house** sits at the last point, so every trail has to end at the same spot (the first trail's end; ends within 12 px of it are snapped). Start each trail just off the edge so predators walk in. | Insert Polyline |
| `slots` | Points where ducks can be placed. Keep them at least ~60 px away from the path so ducks don't sit on it. | Insert Point |
| `pond` | *(optional)* An ellipse for the pond. The solar fountain sits in the middle of the first one, and ducks nesting near it hit harder while it has power. Turtles climb out of it. | Insert Ellipse |
| `sky` | *(needed if a wave has hawks)* Points where hawks fly in. They dive in a straight line to the duck house. Put them just off the edge of the map. | Insert Point |
| `mud` | *(optional)* Ellipses over the path. Ground predators slog through mud at half speed. | Insert Ellipse |
| `brambles` | *(optional)* Ellipses over the path. Ground predators lose health while they're in the thorns. | Insert Ellipse |

## More than one trail

A map can have several trails (polylines in the `path` layer), like Two Trails (`level7.tmj`).
They all end at the duck house. In `src/data/waves.ts`, a spawn group with `path: 1` walks the
second trail (counting from 0 in the order the polylines are listed); a group with no `path`
takes turns down every trail. Turtles climb out of the pond onto the nearest trail, and a
boss's minions follow the boss down its own trail.

Design tips for two trails: give every trail some bends with nests inside them, and put a few
nests where the trails meet so one duck can watch both. A short, straight trail is a shortcut
for predators, so send fewer of them down it.

## Special nests

Select a nest point in the `slots` layer and set its **Class** (called **Type** in older
Tiled versions) to make it special:

| Class | What the duck in it gets |
|---|---|
| `hill` | Reaches 20% farther (it can see more from up there) |
| `water` | Hits 15% harder (a waterside nest; put it by the pond) |

Leave the class empty for a normal nest. How strong mud, brambles, and special nests are
lives in `src/data/tiles.ts`.

Rotating objects isn't supported, so leave rotation at 0.

## Adding a new level

1. Copy an existing `.tmj` file (for example `level3.tmj` to `level4.tmj`) and open it in Tiled.
2. Write its waves in `src/data/waves.ts` (copy an existing list to start).
3. Add it to the end of the list in `src/data/levels.ts` with a name.

## Tips

- **Put nests inside the path's bends.** A duck there can reach two stretches of path at
  once. Nests beside a straight stretch are much weaker. (Two Trails' first draft had a long
  straight west trail, and even sixteen Sunnys couldn't stop the Night Bandit on it.)
- **Keep the top-left, top-middle, top-right, and bottom-left corners clear**: that's where
  the duck picker, counters, start button, and Craig live. `src/data/layout.ts` has the exact
  areas.
- **Start the path off the edge of the map**, so predators walk in from the woods.
- **Put hawk (`sky`) points far from the house**, so hawks fly past some nests on the way.
- **Mud and brambles work best where ducks can reach them**: a predator stuck in mud
  next to a Sunny nest is a happy Sunny.
- **Hill nests are strongest in the middle of a bend**, where the extra reach covers two
  stretches of path.

## Checks

If the map has a problem (like a missing layer), the game shows an error in the browser
console telling you what's wrong. `npm test` also checks every level: nests clear of the
path, the pond, each other, and the buttons; that every mud and bramble patch is on the path
(with no nests inside); that nest classes are spelled right; and that the level can be won on
Easy and Normal but is lost with no ducks at all.
