import Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { DUCKS, type DuckKind } from '../../data/ducks';
import { ENDLESS } from '../../data/endless';
import { TARGETING, TARGETING_ORDER, type Targeting } from '../../data/targeting';
import { chasePartner, findDuck } from '../../logic/battle';
import { shortNumber } from '../../logic/display';
import { canSell, canUpgrade, refundFor, setTargeting, trainingCost } from '../../logic/game';
import { isFinalChoice, nextUpgrade, upgradeOptions } from '../../logic/upgrades';
import { COLORS, DEPTH, INK, INK_GREY, WORLD, textStyle } from '../../ui/theme';
import { drawBigButton, drawCard } from '../../ui/widgets';
import { duckInfoLines } from './duckCard';
import type { GameHost } from './host';

/**
 * The panel that opens when you tap a placed duck: its card, its damage report (kept up to
 * date while open), the "aim at" buttons, the next upgrade (or the final choice of two, or
 * training in the Endless Pond), and Move and Sell. Selling a duck that's been through a wave
 * loses peas, so that asks first; a duck placed since the last wave is a free undo.
 */
export class DuckPanel {
  /** The open panel's report numbers, refreshed as the battle goes on. */
  private report?: { row: Phaser.GameObjects.Container; refresh: () => void };

  constructor(private readonly host: GameHost) {}

  /** Keeps the open panel's numbers current (called every frame). */
  refreshReport(): void {
    if (this.report?.row.active) this.report.refresh();
  }

  /** The panel for a placed duck: its power, Pecking Loop status, and Move / Sell buttons. */
  open(duckId: number): void {
    const host = this.host;
    const found = host.duckSprite(duckId);
    if (!found) return;
    const { duck, sprite } = found;
    host.cancelMove();
    host.closePopup();
    playSound(host, 'tap');
    host.focusDuck(duckId);
    host.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.12, duration: 90, yoyo: true });

    // Taps anywhere outside the panel close it.
    const scrim = host.tapCatcher(DEPTH.hud + 4, () => host.closePopup());

    const partner = chasePartner(host.state.battle, duck)?.kind;
    const final = isFinalChoice(duck.kind, duck.level);
    const H = final ? 620 : 530; // panel height; content is laid out from its center (the final choice needs two cards)
    const lift = final ? 40 : 0; // the taller panel's top half moves up so the two cards get the room
    const card = drawCard(host.add.graphics(), 310, H, { radius: 18 });
    const block = host.add.zone(0, 0, 310, H).setInteractive(); // taps on the panel itself don't close it
    const info = host.add.container(0, -150 - lift, duckInfoLines(host, host.hats, duck.kind, partner, duck.level, duck.path));
    const stats = this.drawReport(duckId, duck.kind, 0, -50 - lift);
    const aim = this.drawTargetingButtons(duckId, duck.kind, 0, 2 - lift);
    const divider = host.add.rectangle(0, 44 - lift, 270, 3, COLORS.ink, 0.12);
    const parts: Phaser.GameObjects.GameObject[] = [card, block, info, stats, aim, divider];

    // Upgrade section.
    const next = nextUpgrade(duck.kind, duck.level);
    if (final) {
      // The final upgrade: pick one of two paths (and keep it).
      parts.push(host.add.text(0, 64 - lift, 'Final upgrade: pick one!', textStyle(20, { ...INK, color: COLORS.textGold, weight: '700' })).setOrigin(0.5));
      upgradeOptions(duck.kind, duck.level).forEach((option, path) => {
        const x = path === 0 ? -71 : 71;
        const affordable = canUpgrade(host.state, duckId, path);
        parts.push(
          drawCard(host.add.graphics(), 140, 170, { radius: 12, fill: COLORS.creamSelected, border: COLORS.gold, borderWidth: 3 }).setPosition(x, 165 - lift),
          host.add.text(x, 86 - lift, option.name, { ...textStyle(18, { ...INK, weight: '700' }), align: 'center', wordWrap: { width: 132 } }).setOrigin(0.5, 0),
          // Names can take two lines, so the words hang below the name's longest case.
          host.add
            .text(x, 134 - lift, option.description, { ...textStyle(15, INK), align: 'center', wordWrap: { width: 130 } })
            .setOrigin(0.5, 0),
          this.priceButton(x, 222 - lift, option.cost, affordable, () => host.upgrade(duckId, path), { width: 124, height: 38, fontSize: 20 }),
        );
      });
    } else if (next) {
      const affordable = canUpgrade(host.state, duckId);
      parts.push(
        host.add.text(-138, 68, `Upgrade: ${next.name}`, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        host.add.text(-138, 94, next.description, { ...textStyle(16, INK), wordWrap: { width: 276 } }).setOrigin(0, 0.5),
        this.priceButton(0, 146, next.cost, affordable, () => host.upgrade(duckId)),
      );
    } else if (trainingCost(host.state, duckId) !== undefined) {
      // Endless Pond: keep training a fully upgraded duck.
      const cost = trainingCost(host.state, duckId)!;
      const affordable = host.state.peas >= cost;
      const boost = Math.round(ENDLESS.training.damage * 100);
      parts.push(
        host.add.text(-138, 68, `Train: level ${duck.training + 1}`, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        host.add.text(-138, 94, `Hits ${boost}% harder every time you train.`, { ...textStyle(16, INK), wordWrap: { width: 276 } }).setOrigin(0, 0.5),
        this.priceButton(0, 146, cost, affordable, () => host.train(duckId)),
      );
    } else {
      parts.push(host.add.text(0, 110, 'Fully upgraded!', textStyle(26, { color: COLORS.goldCss, weight: '700' })).setOrigin(0.5));
    }

    const sellable = canSell(host.state);
    parts.push(
      drawBigButton(host, sellable ? -92 : 0, H / 2 - 43, 'Move', COLORS.blue, COLORS.blueDark, () => host.startMove(duckId), {
        width: 104,
        height: 54,
        fontSize: 24,
      }),
    );
    // Sell says so, and shows how many peas you get back (upgrades included; everything, for a
    // duck placed since the last wave). A Daily Challenge can turn it off.
    if (sellable) {
      parts.push(
        drawBigButton(host, 40, H / 2 - 43, `Sell +${shortNumber(refundFor(duck))}`, COLORS.orange, COLORS.orangeDark, () => this.sell(duckId), {
          width: 150,
          height: 54,
          fontSize: 22,
          icon: 'icon-pea',
        }),
      );
    }

    // Above the duck if it fits, else below, else beside it.
    const at = duck.position;
    const margin = 6;
    let x = Math.max(160, Math.min(WORLD.width - 160, at.x));
    let y: number;
    if (at.y - 70 - H >= margin) y = at.y - 70 - H / 2;
    else if (at.y + 40 + H <= WORLD.height - margin) y = at.y + 40 + H / 2;
    else {
      x = at.x > WORLD.width / 2 ? at.x - 70 - 155 : at.x + 70 + 155;
      y = Math.max(H / 2 + margin, Math.min(WORLD.height - H / 2 - margin, at.y));
    }
    const panel = host.add.container(x, y, parts).setDepth(DEPTH.hud + 5);
    host.popIn(panel);
    const container = host.add.container(0, 0, [scrim, panel]).setDepth(DEPTH.hud + 4);
    host.popup = container;
  }

  /** Three numbers for a placed duck: predators chased off, its power's count, and damage. Kept up to date while open. */
  private drawReport(duckId: number, kind: DuckKind, x: number, y: number): Phaser.GameObjects.Container {
    const host = this.host;
    const labels = ['Chased off', DUCKS[kind].power.stat, 'Damage'];
    const values = labels.map((label, i) => {
      const cx = (i - 1) * 96;
      return {
        value: host.add.text(cx, -9, '0', textStyle(21, { ...INK, weight: '700' })).setOrigin(0.5),
        label: host.add.text(cx, 12, label, textStyle(16, INK_GREY)).setOrigin(0.5),
      };
    });
    const back = host.add.graphics().fillStyle(COLORS.ink, 0.06).fillRoundedRect(-140, -24, 280, 48, 12);
    const row = host.add.container(x, y, [back, ...values.flatMap((v) => [v.value, v.label])]);
    const refresh = () => {
      const report = findDuck(host.state.battle, duckId)?.report;
      if (!report) return;
      [report.chasedOff, report.special, report.damage].forEach((n, i) => values[i]!.value.setText(shortNumber(n)));
    };
    refresh();
    this.report = { row, refresh };
    return row;
  }

  /** "Aim at" buttons: which predator this duck goes after. The chosen one is gold. */
  private drawTargetingButtons(duckId: number, kind: DuckKind, x: number, y: number): Phaser.GameObjects.Container {
    const host = this.host;
    const W = 70;
    const H = 60;
    const row = host.add.container(x, y);
    const cards: { targeting: Targeting; card: Phaser.GameObjects.Graphics }[] = [];
    const refresh = () => {
      const duck = findDuck(host.state.battle, duckId);
      for (const { targeting, card } of cards) {
        const on = duck?.targeting === targeting;
        drawCard(card, W, H, { radius: 12, fill: on ? COLORS.creamSelected : COLORS.cream, border: on ? COLORS.gold : COLORS.ink, borderWidth: on ? 5 : 2 });
      }
    };
    TARGETING_ORDER.forEach((targeting, i) => {
      const bx = (i - (TARGETING_ORDER.length - 1) / 2) * (W + 6);
      const card = host.add.graphics();
      const label = host.add
        .text(0, 17, TARGETING[targeting].name, textStyle(17, { color: COLORS.inkCss, strokeThickness: 0, weight: '700' }))
        .setOrigin(0.5);
      const hit = host.add.zone(0, 0, W, H).setInteractive({ useHandCursor: true });
      const button = host.add.container(bx, 0, [card, this.targetingIcon(targeting, kind), label, hit]);
      hit.on('pointerdown', () => {
        if (!setTargeting(host.state, duckId, targeting)) return;
        playSound(host, 'tap');
        host.tweens.add({ targets: button, scale: 0.9, duration: 70, yoyo: true });
        refresh();
      });
      cards.push({ targeting, card });
      row.add(button);
    });
    refresh();
    return row;
  }

  /** Little pictures for the aim buttons: the duck house, a big heart, the back of the line, the duck itself. */
  private targetingIcon(targeting: Targeting, kind: DuckKind): Phaser.GameObjects.GameObject {
    const host = this.host;
    switch (targeting) {
      case 'first':
        return host.add.image(0, -8, 'house').setDisplaySize(36, 34);
      case 'strong':
        return host.add.image(0, -8, 'icon-heart').setDisplaySize(34, 34);
      case 'last': {
        // A line of three predators walking right; the one at the back has a gold ring.
        const g = host.add.graphics();
        [-16, 0, 16].forEach((dx, i) => {
          g.fillStyle(0x8a8d94).fillCircle(dx, -8, 6).lineStyle(2, COLORS.ink).strokeCircle(dx, -8, 6);
          if (i === 0) g.lineStyle(3, COLORS.gold).strokeCircle(dx, -8, 10);
        });
        return g;
      }
      case 'close':
        return host.add.image(0, -8, `duck-${kind}`).setDisplaySize(36, 36);
    }
  }

  /** A button showing a price in peas: green if you can afford it, grey if not. */
  private priceButton(
    x: number,
    y: number,
    cost: number,
    affordable: boolean,
    onTap: () => void,
    size: { width: number; height: number; fontSize: number } = { width: 276, height: 54, fontSize: 26 },
  ): Phaser.GameObjects.Container {
    return drawBigButton(this.host, x, y, `${cost}`, affordable ? COLORS.green : 0xb8b0a8, affordable ? COLORS.greenDark : 0x8a8079, onTap, {
      ...size,
      icon: 'icon-pea',
    });
  }

  /** Selling a duck that's been through a wave loses peas, so ask first. A duck placed since the last wave is a free undo. */
  private sell(duckId: number): void {
    const host = this.host;
    const duck = findDuck(host.state.battle, duckId);
    if (duck && !duck.fresh) {
      this.confirmSell(duckId);
      return;
    }
    host.sellNow(duckId);
  }

  private confirmSell(duckId: number): void {
    const host = this.host;
    const duck = findDuck(host.state.battle, duckId);
    host.closePopup();
    if (!duck) return;
    const scrim = host.tapCatcher(DEPTH.hud + 4, () => host.closePopup());
    const card = host.add.container(WORLD.width / 2, WORLD.height / 2, [
      drawCard(host.add.graphics(), 460, 300, { radius: 24, borderWidth: 5 }),
      host.add.zone(0, 0, 460, 300).setInteractive(),
      host.add.text(0, -104, `Sell ${DUCKS[duck.kind].name}?`, textStyle(40, { weight: '700', color: COLORS.goldCss, strokeThickness: 8 })).setOrigin(0.5),
      host.add.text(0, -54, `You'll get ${shortNumber(refundFor(duck))} peas back.`, textStyle(24, INK)).setOrigin(0.5),
      // "No" is the big green one: keeping the duck is the safe choice.
      drawBigButton(host, 0, 20, 'No, keep it', COLORS.green, COLORS.greenDark, () => host.closePopup(), { width: 360, height: 80, fontSize: 34 }),
      drawBigButton(host, 0, 110, 'Sell', COLORS.orange, COLORS.orangeDark, () => host.sellNow(duckId), { width: 200, height: 64, fontSize: 28 }),
    ]).setDepth(DEPTH.hud + 5);
    host.popIn(card);
    host.popup = host.add.container(0, 0, [scrim, card]).setDepth(DEPTH.hud + 4);
  }
}
