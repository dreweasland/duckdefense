import type Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { HINT_GAP, HINTS, type HintId } from '../../data/hints';
import { isOver } from '../../logic/game';
import { pickHint, type HintMoment } from '../../logic/hints';
import { COLORS, DEPTH, textStyle } from '../../ui/theme';
import type { GameHost } from './host';
import { CRAIG_BUTTON } from './layout';

/** How long a hint stays up (real time, even on fast-forward). */
const HINT_SHOW_MS = 6500;

// Craig's hints already given this visit (each one only once, until the page reloads).
const shownHints = new Set<HintId>();

/**
 * Craig's hints: when a predator gets into the duck house (or nobody has placed a duck yet),
 * she pops up beside her button with a tip that fits. Words in src/data/hints.ts, rules in
 * src/logic/hints.ts; this is just the speech bubble.
 */
export class Hints {
  private bubble?: Phaser.GameObjects.Container;
  private lastHintAt = -Infinity;

  constructor(
    private readonly host: GameHost,
    /** Craig's button, which perks up when she speaks. */
    private readonly craigButton: Phaser.GameObjects.Container,
    /** How many nests are still empty (hints about placing ducks need to know). */
    private readonly emptyNests: () => number,
  ) {}

  /** Craig gives a tip if one fits what just happened (not too often, and each one only once). */
  maybe(moment: HintMoment): void {
    const { state, difficulty } = this.host;
    if (isOver(state) || state.challenge?.noCraig) return; // she's napping in No Take-Backs
    if (performance.now() - this.lastHintAt < HINT_GAP * 1000) return;
    const hint = pickHint(state, difficulty, moment, this.emptyNests(), shownHints);
    if (!hint) return;
    shownHints.add(hint);
    this.lastHintAt = performance.now();
    this.show(HINTS[hint]);
  }

  /** A speech bubble from Craig, beside her button. Tap it to close it. */
  private show(message: string): void {
    const host = this.host;
    this.bubble?.destroy();
    const W = 340;
    const text = host.add
      .text(-W / 2 + 18, 0, message, { ...textStyle(19, { color: COLORS.inkCss, strokeThickness: 0 }), wordWrap: { width: W - 36 } })
      .setOrigin(0, 0.5);
    const H = Math.max(64, text.height + 26);
    const bubble = host.add
      .graphics()
      .fillStyle(0x000000, 0.2)
      .fillRoundedRect(-W / 2, -H / 2 + 4, W, H, 18)
      .fillStyle(0xffffff)
      .fillRoundedRect(-W / 2, -H / 2, W, H, 18)
      .fillTriangle(-W / 2 + 2, -8, -W / 2 + 2, 12, -W / 2 - 16, 8)
      .lineStyle(4, COLORS.gold)
      .strokeRoundedRect(-W / 2, -H / 2, W, H, 18);
    const hit = host.add.zone(0, 0, W, H).setInteractive({ useHandCursor: true });
    const container = host.add
      .container(CRAIG_BUTTON.x + 70 + W / 2, CRAIG_BUTTON.y - 10, [bubble, text, hit])
      .setDepth(DEPTH.hud + 3)
      .setScale(0);
    this.bubble = container;
    const close = () => {
      if (!container.active || this.bubble !== container) return;
      this.bubble = undefined;
      host.tweens.add({ targets: container, alpha: 0, scale: 0.8, duration: 200, onComplete: () => container.destroy() });
    };
    hit.on('pointerdown', close);
    host.tweens.add({ targets: container, scale: 1, duration: 260, ease: 'Back.Out' });
    // Craig perks up to say it.
    host.tweens.add({ targets: this.craigButton, y: CRAIG_BUTTON.y - 12, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.Out' });
    playSound(host, 'hint');
    window.setTimeout(close, HINT_SHOW_MS);
  }
}
