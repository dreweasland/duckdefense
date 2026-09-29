# Sounds

Drop recordings in this folder, named after the sound they replace, and the game uses them
automatically. Any sound without a recording plays a built-in placeholder.

| File name | When it plays |
|---|---|
| `splash` | Sunny's water ball hits |
| `peck` | Potato, Chester, or Curtis pecks |
| `flap` | Potato's Wing Flap |
| `quack` | Chester's Alarm Quack |
| `nope` | Curtis holds a predator ("Nope.") |
| `chasedOff` | A predator runs away |
| `pea` | A pea lands in the pea counter |
| `heartLost` | A predator gets into the duck house (make it funny!) |
| `shoo` | Craig shoos a predator away |
| `place` | A duck is placed in a nest |
| `sell` | A duck is sold |
| `move` | A duck hops to a new nest |
| `noPeas` | Tapping a nest without enough peas |
| `waveStart` | The play button starts a wave |
| `waveCleared` | A wave is cleared |
| `craig` | Craig's Guardian Blessing |
| `bossArrives` | The Night Bandit shows up |
| `whistle` | The Night Bandit whistles for minions |
| `bossDefeated` | The Night Bandit runs away |
| `win` | You win a level (a victory cheer!) |
| `lose` | You lose a level (silly, not sad) |
| `tap` | Tapping a button or a duck card |

For example, a real quack goes in `quack.mp3`. `.mp3`, `.m4a`, `.ogg`, and `.wav` all work.

## Recording tips

- Record on a phone's voice memo app in a quiet room, close to the mic.
- Keep sounds short: under a second for most, a few seconds for `win` and `lose`.
- Trim the silence at the start so the sound plays right when it should.
- Volumes are set in `src/data/sounds.ts` if something is too loud or too quiet.
