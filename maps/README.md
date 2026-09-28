# Maps

Levels are made in [Tiled](https://www.mapeditor.org/). Open a `.tmj` file, edit it, and
save. If `npm run dev` is running, the game reloads with your changes.

The map is 32 × 18 tiles of 40 px, which is 1280 × 720, the same size as the game screen.

## Layers

Each level needs these **object layers** (the names must match exactly):

| Layer | What to put in it | Tiled tool |
|---|---|---|
| `path` | Exactly one polyline. Predators walk it from the first point to the last. The **duck house** sits at the last point. Start it just off the left edge so predators walk in. | Insert Polyline |
| `slots` | Points where ducks can be placed. Keep them at least ~60 px away from the path so ducks don't sit on it. | Insert Point |
| `pond` | *(optional)* An ellipse for the pond. The solar fountain sits in the middle of the first one and slows predators near it. | Insert Ellipse |
| `sky` | *(needed if a wave has hawks)* Points where hawks fly in. They dive in a straight line to the duck house. Put them just off the edge of the map. | Insert Point |

Rotating objects isn't supported, so leave rotation at 0.

If the map has a problem (like a missing layer), the game shows an error in the browser
console telling you what's wrong. `npm test` also checks that every level loads.
