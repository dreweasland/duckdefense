import Phaser from 'phaser';
import { drawGrass, drawOutskirts, drawPond, scatterDecor } from '../art/terrain';
import type { Difficulty } from '../data/difficulty';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { HATS, type HatKind } from '../data/hats';
import { hatFor } from '../logic/hats';
import { loadProgress } from '../save';
import { duckWithHat } from '../ui/hats';
import { LEVELS } from '../data/levels';
import { findTrial } from '../data/trials';
import { postScore } from '../api';
import { topDuck, type KindReport } from '../logic/battle';
import { shortNumber } from '../logic/display';
import { playSound } from '../audio/sfx';
import { askForName } from '../ui/nameForm';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBigButton, drawCard, fadeToScene } from '../ui/widgets';
import type { GameSceneData } from './GameScene';
import type { LeaderboardSceneData } from './LeaderboardScene';
import type { LevelSelectSceneData } from './LevelSelectScene';

export interface ResultSceneData {
  won: boolean;
  difficulty: Difficulty;
  level: number;
  stars?: number; // only for a win
  score?: number;
  newBest?: boolean;
  hearts?: number; // hearts left and peas that count (see scorePeas), for posting to the leaderboard
  peas?: number;
  daily?: string; // the Daily Challenge date, if that's what was played
  trial?: string; // the Level Trial's id, if that's what was played
  sandbox?: boolean; // the Sandbox: nothing was saved
  newRibbon?: boolean; // a trial won for the first time on this difficulty
  streak?: number; // Daily Challenges won on days in a row, counting this one
  report?: Partial<Record<DuckKind, KindReport>>; // what each kind of duck did (the damage report)
  newHats?: HatKind[]; // hats this win unlocked
  endlessWaves?: number; // for an Endless Pond run: waves survived
  endlessBest?: number; // and the most ever survived on this difficulty
}

// The ducks' damage reports sit 190 apart; each one's text is kept this narrow so neighbours never touch.
const REPORT_COLUMN = 178;

const POND = { center: { x: WORLD.width / 2, y: 610 }, radiusX: 420, radiusY: 95 };

export class ResultScene extends Phaser.Scene {
  private result: ResultSceneData = { won: true, difficulty: 'easy', level: 0 };

  constructor() {
    super('ResultScene');
  }

  init(data: Partial<ResultSceneData>): void {
    this.result = { ...data, won: data.won ?? true, difficulty: data.difficulty ?? 'easy', level: data.level ?? 0 };
  }

  create(): void {
    setupCamera(this);
    const cx = WORLD.width / 2;
    const { won, difficulty, level, daily, trial, sandbox } = this.result;
    const endless = this.result.endlessWaves !== undefined;
    const hasNext = won && !daily && !trial && !sandbox && !endless && level + 1 < LEVELS.length;
    const beatEverything = won && !daily && !trial && !sandbox && !hasNext;
    const trialName = trial && findTrial(trial)?.trial.name;

    drawGrass(this, 41);
    drawOutskirts(this, 44);
    drawPond(this, POND, 42);
    scatterDecor(this, { ponds: [POND], blocked: [{ x: 200, y: 40, width: 880, height: 480 }] }, 43);

    // Panel.
    const panel = drawCard(this.add.graphics(), 820, 460, { radius: 28, borderWidth: 5 });
    this.add.container(cx, 262, [panel]).setDepth(50);

    // Losing should never feel harsh: silly message, same big "again" button.
    this.add
      .text(cx, 108, endless ? this.endlessHeadline() : won ? (trial ? 'Trial complete!' : 'You saved the duck house!') : 'The raccoons had a snack party!', {
        ...textStyle(52, { weight: '700', strokeThickness: 10 }),
        color: won || endless ? '#ffd23f' : '#ffb3c1',
        align: 'center',
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5)
      .setDepth(51);
    this.add
      .text(
        cx,
        172,
        endless
          ? `Your best: ${this.result.endlessBest ?? 0} ${this.result.endlessBest === 1 ? 'wave' : 'waves'}`
          : sandbox
            ? won
              ? 'Sandbox: nothing saved, but the flock had fun.'
              : 'Sandbox: nothing saved. Try something else!'
          : trial && won
            ? `${trialName}: done! ${this.result.newRibbon ? 'A ribbon for the flock!' : 'The flock is so proud.'}`
            : trial
              ? `${trialName} is a tough one. The ducks want a rematch!`
          : daily && won
          ? (this.result.streak ?? 0) >= 2
            ? `You beat today's Daily Challenge! ${this.result.streak} days in a row!`
            : "You beat today's Daily Challenge!"
          : beatEverything
            ? 'You beat every level! The flock is so proud.'
            : won
              ? 'The flock is safe and proud.'
              : 'The ducks want a rematch!',
        textStyle(30, { color: COLORS.inkCss, strokeThickness: 0 }),
      )
      .setOrigin(0.5)
      .setDepth(51);

    // An Endless Pond run: a Post button for the leaderboard, and a cheer for a new best.
    if (endless) {
      const waves = this.result.endlessWaves ?? 0;
      const big = this.add
        .text(cx, 250, String(waves), textStyle(76, { color: '#3d8fe0', stroke: COLORS.inkCss, strokeThickness: 10, weight: '700' }))
        .setOrigin(0.5)
        .setDepth(51);
      this.add
        .text(cx, 304, waves === 1 ? 'wave survived' : 'waves survived', textStyle(22, { color: COLORS.inkCss, strokeThickness: 0 }))
        .setOrigin(0.5)
        .setDepth(51);
      big.setScale(0);
      this.tweens.add({ targets: big, scale: 1, delay: 300, duration: 350, ease: 'Back.Out' });
      if (this.result.newBest) {
        this.add
          .text(cx + big.width / 2 + 20, 230, 'New best!', textStyle(28, { color: '#e0447a', stroke: '#ffffff', strokeThickness: 6, weight: '700' }))
          .setOrigin(0, 0.5)
          .setDepth(51)
          .setAngle(-8);
      }
      if ((this.result.endlessWaves ?? 0) > 0) this.drawPostButton(cx + 300, 296);
    }

    // A trial win: a big ribbon where the stars would go, and the score for the trial's own board.
    if (won && trial) {
      const ribbon = this.add.image(cx, 232, 'ribbon').setDisplaySize(88, 88).setTint(COLORS.pink).setDepth(52);
      const full = ribbon.scaleX;
      ribbon.setScale(0);
      this.tweens.add({ targets: ribbon, scale: full, delay: 300, duration: 400, ease: 'Back.Out' });
      if (this.result.newRibbon) {
        this.add
          .text(cx + 56, 206, 'New ribbon!', textStyle(26, { color: '#e0447a', stroke: '#ffffff', strokeThickness: 6, weight: '700' }))
          .setOrigin(0, 0.5)
          .setDepth(51)
          .setAngle(-8);
      }
      this.add
        .text(cx, 296, `Score  ${this.result.score ?? 0}`, textStyle(30, { color: COLORS.inkCss, strokeThickness: 0, weight: '700' }))
        .setOrigin(0.5)
        .setDepth(51);
      this.drawPostButton(cx + 300, 296);
    }

    // Stars and score for a win.
    const stars = this.result.stars ?? 0;
    if (won && !endless && !trial && !sandbox) {
      for (let s = 0; s < 3; s++) {
        const earned = s < stars;
        const star = this.add
          .image(cx + (s - 1) * 80, 236, 'star')
          .setDisplaySize(66, 66)
          .setTint(earned ? 0xffd23f : 0xd8d2cc)
          .setDepth(52);
        // Pop in one after another; stars you didn't earn are smaller and grey.
        const full = star.scaleX;
        star.setScale(0);
        this.tweens.add({ targets: star, scale: earned ? full : full * 0.8, delay: 300 + s * 250, duration: 300, ease: 'Back.Out' });
      }
      const score = this.add
        .text(cx, 296, `Score  ${this.result.score ?? 0}`, textStyle(30, { color: COLORS.inkCss, strokeThickness: 0, weight: '700' }))
        .setOrigin(0.5)
        .setDepth(51);
      this.drawPostButton(cx + 300, 296);
      if (this.result.newBest) {
        this.add
          .text(score.x + score.width / 2 + 12, 296, 'New best!', textStyle(22, { color: '#e0447a', stroke: '#ffffff', strokeThickness: 5 }))
          .setOrigin(0, 0.5)
          .setDepth(51)
          .setAngle(-6);
      }
    }

    // Happy ducks hop when you win; on a loss they shake their heads. Under each one, the
    // damage report: what it did this level. The duck that did the most damage wears a crown.
    const report = this.result.report;
    const top = report && topDuck(report);
    const progress = loadProgress();
    DUCK_ORDER.forEach((kind, i) => {
      const x = report ? cx - 285 + i * 190 : cx - 240 + i * 160;
      const roomy = won || endless; // the win layout, with the ducks lower down
      const size = report ? (roomy ? 72 : 96) : won ? 90 : 110;
      const y = report ? (roomy ? 380 : 320) : won ? 400 : 320;
      const stats = report?.[kind];
      const stayedHome = !!report && !stats?.placed;
      const parts: Phaser.GameObjects.GameObject[] = [];
      // The top duck glows gold (its crown goes by its name, clear of any hat).
      if (kind === top) parts.push(this.add.image(0, 0, 'glow').setDisplaySize(size * 1.7, size * 1.7).setTint(COLORS.gold).setAlpha(0.7));
      parts.push(duckWithHat(this, kind, 0, 0, size, hatFor(progress, kind)));
      const duck = this.add.container(x, y, parts).setDepth(51).setAlpha(stayedHome ? 0.4 : 1);
      if (!stayedHome) {
        this.tweens.add(
          won
            ? { targets: duck, y: y - (report ? 12 : 30), duration: 320, yoyo: true, repeat: -1, delay: i * 120, ease: 'Quad.Out' }
            : { targets: duck, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: -1, delay: i * 80 },
        );
      }
      if (report) this.drawDuckReport(x, y + size / 2 + 8, kind, stats, kind === top);
    });

    if (won) {
      // Confetti.
      this.add
        .particles(0, -20, 'feather', {
          x: { min: 0, max: WORLD.width },
          speedY: { min: 80, max: 180 },
          speedX: { min: -40, max: 40 },
          rotate: { min: 0, max: 360 },
          lifespan: 5000,
          frequency: 60,
          scale: { min: 0.4, max: 0.8 },
          tint: [0xffd23f, 0xff7aa2, 0x3fbf5f, 0x3d8fe0, 0xffffff],
        })
        .setDepth(60);
    }

    const go = (scene: string, data?: object) => fadeToScene(this, scene, data, 250);
    const again: GameSceneData = { difficulty, level, daily, endless, trial, sandbox };
    const levels: LevelSelectSceneData = { difficulty };
    const y = 560;
    if (hasNext) {
      // Next level is the big, obvious choice.
      const next: GameSceneData = { difficulty, level: level + 1 };
      const small = { width: 230, height: 84 };
      drawBigButton(this, cx - 290, y + 5, '↻  Again', COLORS.blue, COLORS.blueDark, () => go('GameScene', again), small).setDepth(70);
      drawBigButton(this, cx, y, 'Next  ▶', COLORS.green, COLORS.greenDark, () => go('GameScene', next)).setDepth(70);
      drawBigButton(this, cx + 290, y + 5, 'Levels', COLORS.blue, COLORS.blueDark, () => go('LevelSelectScene', levels), small).setDepth(70);
    } else {
      drawBigButton(this, cx - 170, y, '↻  Again', COLORS.green, COLORS.greenDark, () => go('GameScene', again)).setDepth(70);
      drawBigButton(this, cx + 170, y, 'Levels', COLORS.blue, COLORS.blueDark, () => go('LevelSelectScene', levels)).setDepth(70);
    }

    const newHats = this.result.newHats ?? [];
    if (newHats.length > 0) this.time.delayedCall(1400, () => this.showNewHats(newHats));

    this.cameras.main.fadeIn(300, 0, 0, 0);
    playSound(this, won || (endless && this.result.newBest) ? 'win' : 'lose');
  }

  /** A duck's damage report under its picture. Ducks that weren't placed "stayed home". */
  private drawDuckReport(x: number, y: number, kind: DuckKind, stats: KindReport | undefined, top: boolean): void {
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    if (!stats?.placed) {
      this.add.text(x, y + 8, 'Stayed home', textStyle(16, { ...ink, color: COLORS.textGrey })).setOrigin(0.5).setDepth(51);
      return;
    }
    const name = stats.placed > 1 ? `${DUCKS[kind].name} ×${stats.placed}` : DUCKS[kind].name;
    const lines = [
      this.add.text(x, y, name, textStyle(17, { ...ink, color: COLORS.textGrey })),
      this.add.text(x, y + 21, `Chased off ${shortNumber(stats.chasedOff)}`, textStyle(18, { ...ink, weight: '700' })),
      this.add.text(x, y + 43, `${shortNumber(stats.damage)} damage · ${DUCKS[kind].power.stat} ${shortNumber(stats.special)}`, textStyle(16, ink)),
    ];
    lines.forEach((line) => {
      line.setOrigin(0.5, 0).setDepth(51);
      // Whatever the numbers, a duck's lines stay inside its own column.
      if (line.width > REPORT_COLUMN) line.setScale(REPORT_COLUMN / line.width);
    });
    if (top) this.drawCrown(x - lines[0]!.displayWidth / 2 - 26, y + 7).setDepth(51);
  }

  /** The big line for an Endless Pond run. */
  private endlessHeadline(): string {
    const waves = this.result.endlessWaves ?? 0;
    if (waves === 0) return 'The raccoons were extra hungry!';
    return `You survived ${waves} ${waves === 1 ? 'wave' : 'waves'}!`;
  }

  /** "New hat!" card beside the panel, for hats this win unlocked. */
  private showNewHats(hats: HatKind[]): void {
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const W = 200;
    const H = 190;
    const shown = hats.slice(0, 3);
    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(this.add.graphics(), W, H, { radius: 20, border: COLORS.pink, borderWidth: 5 }),
      this.add.text(0, -H / 2 + 26, shown.length > 1 ? 'New hats!' : 'New hat!', textStyle(26, { ...ink, color: '#e0447a', weight: '700' })).setOrigin(0.5),
    ];
    shown.forEach((hat, i) => {
      const x = (i - (shown.length - 1) / 2) * 60;
      parts.push(this.add.image(x, -8, `hat-${hat}`).setDisplaySize(56, 50));
    });
    parts.push(
      this.add
        .text(0, 40, shown.length === 1 ? HATS[shown[0]!].name : `${hats.length} new hats`, textStyle(18, { ...ink, weight: '700' }))
        .setOrigin(0.5),
      this.add.text(0, 67, 'Try it on in the Wardrobe!', textStyle(16, { ...ink, color: COLORS.textGrey })).setOrigin(0.5),
    );
    const card = this.add.container(WORLD.width - 110, 300, parts).setDepth(80).setScale(0).setAngle(4);
    this.tweens.add({ targets: card, scale: 1, duration: 350, ease: 'Back.Out' });
    playSound(this, 'upgrade');
  }

  /** A little gold crown for the duck that did the most damage. */
  private drawCrown(x: number, y: number): Phaser.GameObjects.Graphics {
    const points = [-18, 8, -18, -8, -9, 0, 0, -12, 9, 0, 18, -8, 18, 8].map((n, i) => n + (i % 2 ? y : x));
    const shape = Array.from({ length: points.length / 2 }, (_, i) => new Phaser.Math.Vector2(points[i * 2]!, points[i * 2 + 1]!));
    return this.add
      .graphics()
      .fillStyle(COLORS.gold)
      .fillPoints(shape, true)
      .lineStyle(3, COLORS.ink)
      .strokePoints(shape, true)
      .fillStyle(0xff7aa2)
      .fillCircle(x, y + 2, 3);
  }

  /** "Post" puts this win on the public leaderboard (asks for a name first). */
  private drawPostButton(x: number, y: number): void {
    const { level, difficulty, hearts, peas, daily, trial, endlessWaves } = this.result;
    const endless = endlessWaves !== undefined;
    if (!endless && (hearts === undefined || peas === undefined)) return;
    const button = drawBigButton(
      this,
      x,
      y,
      'Post',
      COLORS.gold,
      0xc99a1a,
      async () => {
        let posted: { id: number } | undefined;
        const ok = await askForName(async (name) => {
          const result = await postScore(
            endless ? { name, difficulty, endless: true, level, waves: endlessWaves } : { name, level, difficulty, hearts: hearts!, peas: peas!, daily, trial },
          );
          if (!result.ok) return result.error;
          posted = result.data;
          return undefined;
        });
        if (!ok || !posted) {
          // Cancelled: put a fresh button back (big buttons only fire once).
          button.destroy();
          this.drawPostButton(x, y);
          return;
        }
        const data: LeaderboardSceneData = {
          level,
          difficulty,
          daily,
          trial,
          endless,
          highlightId: posted.id,
          back: { scene: 'LevelSelectScene', data: { difficulty } },
        };
        fadeToScene(this, 'LeaderboardScene', data, 250);
      },
      { width: 150, height: 56, fontSize: 24, icon: 'icon-trophy' },
    );
    button.setDepth(70);
  }
}
