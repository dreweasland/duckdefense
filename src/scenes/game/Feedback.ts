import type Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import type { Point } from '../../logic/geometry';
import { COLORS, DEPTH, WORLD, textStyle } from '../../ui/theme';
import { popSpeechBubble } from '../../ui/widgets';
import type { GameHost } from './host';
import { PEA_ICON } from './layout';

// Said by the raccoon when it gets into the duck house. Losing a heart should be funny.
const RACCOON_QUIPS = ['Nom nom!', 'Yoink!', 'Snack time!', 'Crunch!', 'Mine now!'];

/**
 * Feedback the whole screen shares: expanding rings, floating words, a pea flying to the
 * counter, the duck house being raided, and the big gold banners (which queue up, so two
 * things happening at once take turns).
 */
export class Feedback {
  private bannerQueue: { message: string; bonus: number }[] = [];
  private bannerShowing = false;

  constructor(
    private readonly host: GameHost,
    /** The pea counter's number, which bounces when a pea lands on it. */
    private readonly peasText: Phaser.GameObjects.Text,
  ) {}

  ring(x: number, y: number, radius: number, color: number, duration: number): void {
    const host = this.host;
    const ring = host.add.circle(x, y, 6).setStrokeStyle(4, color).setDepth(DEPTH.effects);
    host.tweens.add({ targets: ring, radius, alpha: 0, duration, onComplete: () => ring.destroy() });
  }

  floatText(at: Point, message: string, color: string): void {
    const host = this.host;
    const text = host.add.text(at.x, at.y, message, textStyle(26, { color, weight: '700' })).setOrigin(0.5);
    text.setDepth(DEPTH.floatText);
    host.tweens.add({ targets: text, y: at.y - 40, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }

  /** A pea pops out of a chased-off predator and flies to the pea counter. */
  flyPea(from: Point, amount: number): void {
    const host = this.host;
    this.floatText({ x: from.x, y: from.y - 40 }, `+${amount}`, COLORS.peaCss);
    const pea = host.add.image(from.x, from.y - 20, 'icon-pea').setDisplaySize(22, 22).setDepth(DEPTH.hud + 1);
    host.tweens.add({
      targets: pea,
      x: PEA_ICON.x,
      y: PEA_ICON.y,
      duration: 650,
      ease: 'Cubic.In',
      onComplete: () => {
        pea.destroy();
        playSound(host, 'pea');
        host.tweens.add({ targets: this.peasText, scale: 1.2, duration: 80, yoyo: true });
      },
    });
  }

  showHouseRaid(): void {
    const host = this.host;
    host.tweens.add({
      targets: host.house,
      angle: { from: -5, to: 5 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      onComplete: () => host.house.setAngle(0),
    });
    const quip = RACCOON_QUIPS[Math.floor(Math.random() * RACCOON_QUIPS.length)]!;
    popSpeechBubble(host, host.house.x, host.house.y - 150, quip, DEPTH.floatText);
    host.tweens.add({ targets: host.heartsPill, scale: 1.25, duration: 110, yoyo: true });
  }

  /** Shows a big banner in the middle of the screen. If one is already up, this one waits its turn. */
  showBanner(message: string, bonus = 0): void {
    this.bannerQueue.push({ message, bonus });
    if (!this.bannerShowing) this.showNextBanner();
  }

  private showNextBanner(): void {
    const host = this.host;
    const next = this.bannerQueue.shift();
    this.bannerShowing = !!next;
    if (!next) return;
    const { message, bonus } = next;
    const text = host.add.text(0, 0, message, textStyle(44, { weight: '700' })).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [];
    let width = text.width + 70;
    if (bonus > 0) {
      const chip = host.add.container(text.width / 2 + 60, 0, [
        host.add.image(-22, 0, 'icon-pea').setDisplaySize(30, 30),
        host.add.text(-4, 0, `+${bonus}`, textStyle(32, { weight: '700', color: COLORS.peaCss })).setOrigin(0, 0.5),
      ]);
      text.x -= 50;
      chip.x -= 50;
      parts.push(chip);
      width += 100;
    }
    const ribbon = host.add
      .graphics()
      .fillStyle(0x000000, 0.25)
      .fillRoundedRect(-width / 2, -34, width, 76, 38)
      .fillStyle(COLORS.gold)
      .fillRoundedRect(-width / 2, -40, width, 76, 38)
      .lineStyle(5, COLORS.ink)
      .strokeRoundedRect(-width / 2, -40, width, 76, 38);
    const banner = host.add
      .container(WORLD.width / 2, WORLD.height / 2, [ribbon, text, ...parts])
      .setDepth(DEPTH.banner)
      .setScale(0);
    host.tweens.chain({
      targets: banner,
      tweens: [
        { scale: 1, duration: 320, ease: 'Back.Out' },
        { alpha: 0, y: banner.y - 30, delay: 1300, duration: 400 },
      ],
      onComplete: () => banner.destroy(),
    });
    // The next banner (if any) pops in as this one starts to fade away.
    host.time.delayedCall(1620, () => this.showNextBanner());
  }
}
