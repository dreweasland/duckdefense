import type Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { callNextWave, canCallEarly, earlyCallPeas, wavePreview } from '../../logic/game';
import { COLORS, DEPTH, INK, WORLD, textStyle } from '../../ui/theme';
import { drawBigButton, drawCard, drawPill, drawRoundButton } from '../../ui/widgets';
import type { GameHost } from './host';
import { CALL_EARLY, PREVIEW } from './layout';

/**
 * Calling the next wave early. Once every predator in a wave is out, an orange button appears
 * (with a pill showing the peas for sending the next wave now). First tap shows a card with
 * what's coming and a "Send now!" button; tapping the button again closes the card.
 */
export class CallEarly {
  private readonly container: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private card?: { popup: Phaser.GameObjects.Container; bonus: Phaser.GameObjects.Text };

  constructor(private readonly host: GameHost) {
    const arrows = host.add.graphics().fillStyle(0xffffff).lineStyle(3, COLORS.ink);
    for (const x of [-14, 2]) arrows.fillTriangle(x, -13, x, 13, x + 16, 0).strokeTriangle(x, -13, x, 13, x + 16, 0);
    const { container: button, hit } = drawRoundButton(host, 0, 0, 32, COLORS.orange, COLORS.orangeDark, [arrows]);
    this.label = host.add.text(-84, 0, '', textStyle(20, { weight: '700', color: COLORS.peaCss })).setOrigin(0, 0.5);
    const pill = host.add.container(0, 0, [drawPill(host, -72, 0, 84, 36), host.add.image(-98, 0, 'icon-pea').setDisplaySize(20, 20), this.label]);
    this.container = host.add.container(CALL_EARLY.x, CALL_EARLY.y, [pill, button]).setDepth(DEPTH.hud).setVisible(false);
    host.tweens.add({ targets: arrows, x: 3, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    hit.on('pointerdown', () => {
      if (this.card && host.popup === this.card.popup) {
        playSound(host, 'tap');
        host.closePopup();
        return;
      }
      this.showCard();
    });
  }

  /** Shows or hides the button with the game, and keeps the open card's peas up to date. */
  refresh(): void {
    const { host, container } = this;
    const game = host.state;
    const early = canCallEarly(game);
    if (early && !container.visible) {
      container.setScale(0);
      host.tweens.add({ targets: container, scale: 1, duration: 250, ease: 'Back.Out' });
    }
    container.setVisible(early);
    const peas = early ? `+${earlyCallPeas(game)}` : '';
    if (early) this.label.setText(peas);
    // The card keeps its peas up to date, and closes if the chance has passed.
    if (this.card && host.popup === this.card.popup) {
      if (early) this.card.bonus.setText(`${peas} peas`);
      else host.closePopup();
    }
  }

  /** The next wave's predators, the peas for calling it now, and a "Send now" button. */
  private showCard(): void {
    const host = this.host;
    const game = host.state;
    if (!canCallEarly(game)) return;
    host.cancelMove();
    host.closePopup();
    playSound(host, 'tap');
    const nextIndex = game.waveIndex + 1;
    const night = game.waves[nextIndex]!.time === 'night';
    const W = 320;
    const H = 250;

    // Taps anywhere outside the card close it.
    const scrim = host.tapCatcher(DEPTH.hud + 4, () => host.closePopup());

    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(host.add.graphics(), W, H, { radius: 18 }),
      host.add.zone(0, 0, W, H).setInteractive(), // taps on the card itself don't close it
      host.add.image(-W / 2 + 34, -H / 2 + 30, night ? 'icon-moon' : 'icon-sun').setDisplaySize(30, 30),
      host.add.text(-W / 2 + 56, -H / 2 + 30, `Wave ${nextIndex + 1} is next`, textStyle(24, { ...INK, weight: '700' })).setOrigin(0, 0.5),
    ];
    const entries = wavePreview(game.waves, nextIndex);
    const chip = Math.min(PREVIEW.chip, (W - 30 + PREVIEW.gap) / entries.length - PREVIEW.gap);
    entries.forEach((entry, i) => {
      const x = (i - (entries.length - 1) / 2) * (chip + PREVIEW.gap);
      parts.push(host.preview.chip(entry, x, -22, chip / PREVIEW.chip));
    });
    const bonus = host.add.text(-2, 32, '', textStyle(22, { ...INK, color: COLORS.textGreen, weight: '700' })).setOrigin(0, 0.5);
    parts.push(host.add.image(-20, 32, 'icon-pea').setDisplaySize(24, 24), bonus);
    parts.push(
      drawBigButton(host, 0, 82, 'Send now!', COLORS.orange, COLORS.orangeDark, () => this.send(), { width: 260, height: 54, fontSize: 26 }),
    );

    // Just below the button, kept on screen.
    const x = Math.min(WORLD.width - W / 2 - 10, CALL_EARLY.x - 20);
    const panel = host.add.container(x, CALL_EARLY.y + 50 + H / 2, parts).setDepth(DEPTH.hud + 5);
    host.popIn(panel);
    const popup = host.add.container(0, 0, [scrim, panel]).setDepth(DEPTH.hud + 4);
    host.popup = popup;
    this.card = { popup, bonus };
    host.refreshHud();
  }

  /** Sends the next wave now (from the card). */
  private send(): void {
    const host = this.host;
    host.closePopup();
    const earned = callNextWave(host.state);
    if (earned === undefined) return;
    playSound(host, 'waveStart');
    host.flyPea({ x: CALL_EARLY.x, y: CALL_EARLY.y + 30 }, earned);
    host.showBanner(`Wave ${host.state.waveIndex + 1} is coming early!`);
    host.refreshHud();
  }
}
