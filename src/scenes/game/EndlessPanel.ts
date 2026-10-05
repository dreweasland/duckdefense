import type Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { ENDLESS } from '../../data/endless';
import { ENDLESS_PERKS_AREA } from '../../data/layout';
import { PERKS, type PerkId } from '../../data/perks';
import { duckStats } from '../../logic/battle';
import { choosePerk, isOver, repairCost, repairHouse } from '../../logic/game';
import { BACKDROP, COLORS, DEPTH, INK, WORLD, textStyle } from '../../ui/theme';
import { drawCard, drawPill, popSpeechBubble } from '../../ui/widgets';
import type { GameHost } from './host';
import { REPAIR_BUTTON } from './layout';

/**
 * The Endless Pond's extras, under the peas and hearts: a counter of the Pond Perks picked
 * (tap it for the list), the "fix the duck house" button, and the big "Pick a Pond Perk!"
 * choice that stops the game after every few waves until you pick.
 */
export class EndlessPanel {
  private readonly perksButton: { container: Phaser.GameObjects.Container; count: Phaser.GameObjects.Text };
  private readonly repairButton: { container: Phaser.GameObjects.Container; cost: Phaser.GameObjects.Text; pea: Phaser.GameObjects.Image };
  private perkCard?: Phaser.GameObjects.Container;

  constructor(private readonly host: GameHost) {
    this.perksButton = this.drawPerksButton();
    this.repairButton = this.drawRepairButton();
  }

  /** Whether the perk choice is up (the game waits while it is). */
  get choosing(): boolean {
    return this.perkCard !== undefined;
  }

  refresh(): void {
    const game = this.host.state;
    const picked = Object.values(game.perks).reduce((sum, n) => sum + n, 0);
    this.perksButton.count.setText(String(picked));
    this.perksButton.container.setAlpha(picked > 0 ? 1 : 0.5);
    // Pond Perks on offer: show the card to pick one.
    if (game.perkChoice && !this.perkCard && !isOver(game)) this.showPerkChoice(game.perkChoice);
    // The repair button shows its price when the house needs fixing, dimmed if you can't afford it yet.
    const cost = repairCost(game);
    this.repairButton.cost.setText(cost === undefined ? 'Full' : String(cost)).setX(cost === undefined ? -6 : 22);
    this.repairButton.pea.setVisible(cost !== undefined);
    this.repairButton.container.setAlpha(cost !== undefined && game.peas >= cost ? 1 : 0.5);
  }

  /** "Pick a Pond Perk!" with three big cards. The game waits until you pick. */
  private showPerkChoice(offer: PerkId[]): void {
    const host = this.host;
    host.cancelMove();
    host.closePopup();
    const dim = host.add
      .rectangle(BACKDROP.x + BACKDROP.width / 2, BACKDROP.y + BACKDROP.height / 2, BACKDROP.width, BACKDROP.height, 0x000000, 0.45)
      .setInteractive(); // blocks taps on the map underneath
    // After a boss wave the offer is boss rewards: big perks that change a rule.
    const reward = offer.some((id) => PERKS[id].boss);
    const title = host.add
      .text(WORLD.width / 2, 200, reward ? 'Boss reward! Pick one!' : 'Pick a Pond Perk!', textStyle(52, { weight: '700', strokeThickness: 10, color: reward ? COLORS.goldCss : '#ffffff' }))
      .setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [dim, title];
    const W = 250;
    const H = 250;
    offer.forEach((id, i) => {
      const perk = PERKS[id];
      const have = host.state.perks[id] ?? 0;
      const icon = host.add.image(0, -60, perk.icon);
      icon.setScale(Math.min(70 / icon.width, 70 / icon.height));
      if (perk.tint !== undefined) icon.setTint(perk.tint);
      const cardParts: Phaser.GameObjects.GameObject[] = [
        drawCard(host.add.graphics(), W, H, { radius: 22, border: reward ? COLORS.pink : COLORS.gold, borderWidth: reward ? 7 : 5 }),
        icon,
        host.add.text(0, 6, perk.name, textStyle(26, { ...INK, weight: '700' })).setOrigin(0.5),
        host.add.text(0, 60, perk.description, { ...textStyle(18, INK), align: 'center', wordWrap: { width: W - 30 } }).setOrigin(0.5),
      ];
      if (have > 0) {
        // Already picked before: this one makes it stronger.
        cardParts.push(host.add.text(W / 2 - 16, -H / 2 + 22, `×${have + 1}`, textStyle(22, { weight: '700', color: COLORS.goldCss })).setOrigin(1, 0.5));
      }
      const hit = host.add.zone(0, 0, W, H).setInteractive({ useHandCursor: true });
      cardParts.push(hit);
      const card = host.add.container(WORLD.width / 2 + (i - (offer.length - 1) / 2) * (W + 24), 400, cardParts);
      card.setScale(0);
      host.tweens.add({ targets: card, scale: 1, delay: 120 + i * 90, duration: 280, ease: 'Back.Out' });
      hit.on('pointerover', () => card.setScale(1.04));
      hit.on('pointerout', () => card.setScale(1));
      hit.on('pointerdown', () => this.pickPerk(id));
      parts.push(card);
    });
    this.perkCard = host.add.container(0, 0, parts).setDepth(DEPTH.hud + 6);
    playSound(host, 'waveCleared');
  }

  private pickPerk(id: PerkId): void {
    const host = this.host;
    if (!choosePerk(host.state, id)) return;
    this.perkCard?.destroy();
    this.perkCard = undefined;
    playSound(host, 'upgrade');
    // Reach may have changed: redraw every duck's range circle.
    for (const duck of host.state.battle.ducks) host.duckSprite(duck.id)?.sprite.range.setRadius(duckStats(host.state.battle, duck).range);
    if (PERKS[id].effect.hearts) host.tweens.add({ targets: host.heartsPill, scale: 1.25, duration: 120, yoyo: true });
    // New Nests: the extra nests pop up, ready for ducks.
    if (PERKS[id].effect.nests) {
      for (const slot of host.bonusNests) {
        host.drawNest(slot);
        host.fx.puff.explode(10, slot.x, slot.y);
        host.fx.stars.explode(8, slot.x, slot.y - 10);
      }
    }
    host.showBanner(`${PERKS[id].name}!`);
    host.refreshHud();
  }

  /** Under the peas: how many Pond Perks you've picked. Tap it to see them. */
  private drawPerksButton(): { container: Phaser.GameObjects.Container; count: Phaser.GameObjects.Text } {
    const host = this.host;
    const area = ENDLESS_PERKS_AREA;
    const count = host.add.text(4, 0, '0', textStyle(22, { weight: '700' })).setOrigin(0, 0.5);
    const hit = host.add.zone(0, 0, area.width, area.height + 8).setInteractive({ useHandCursor: true });
    const container = host.add
      .container(area.x + area.width / 2, area.y + area.height / 2, [
        drawPill(host, 0, 0, area.width, 40),
        host.add.image(-22, 0, 'star').setDisplaySize(26, 26).setTint(0x8fe07a),
        count,
        hit,
      ])
      .setDepth(DEPTH.hud);
    hit.on('pointerdown', () => this.showPerksTaken());
    return { container, count };
  }

  /** A card listing the Pond Perks picked so far. */
  private showPerksTaken(): void {
    const host = this.host;
    const taken = (Object.keys(host.state.perks) as PerkId[]).filter((id) => (host.state.perks[id] ?? 0) > 0);
    host.cancelMove();
    host.closePopup();
    playSound(host, 'tap');
    const W = 340;
    const rowH = Math.min(34, 520 / Math.max(1, taken.length)); // squeeze up when there are lots, to stay on screen
    const H = 70 + Math.max(1, taken.length) * rowH;
    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(host.add.graphics(), W, H, { radius: 18 }),
      host.add.text(0, -H / 2 + 28, 'Pond Perks', textStyle(24, { ...INK, weight: '700' })).setOrigin(0.5),
    ];
    if (taken.length === 0) {
      parts.push(host.add.text(0, -H / 2 + 70, `Pick one every ${ENDLESS.perkEvery} waves!`, textStyle(17, INK)).setOrigin(0.5));
    }
    taken.forEach((id, i) => {
      const y = -H / 2 + 70 + i * rowH;
      const icon = host.add.image(-W / 2 + 30, y, PERKS[id].icon);
      icon.setScale(Math.min(24 / icon.width, 24 / icon.height));
      if (PERKS[id].tint !== undefined) icon.setTint(PERKS[id].tint);
      const times = host.state.perks[id] ?? 0;
      parts.push(
        icon,
        host.add.text(-W / 2 + 52, y, `${PERKS[id].name}${times > 1 ? ` ×${times}` : ''}`, textStyle(18, { ...INK, weight: '700' })).setOrigin(0, 0.5),
      );
    });
    const area = ENDLESS_PERKS_AREA;
    const popup = host.add.container(area.x + W / 2, area.y + area.height + 16 + H / 2, parts).setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 5000);
  }

  /** Under the hearts: spend peas to fix the duck house (one heart back). */
  private drawRepairButton(): { container: Phaser.GameObjects.Container; cost: Phaser.GameObjects.Text; pea: Phaser.GameObjects.Image } {
    const host = this.host;
    const { x, y, width, height } = REPAIR_BUTTON;
    const cost = host.add.text(22, 0, '', textStyle(20, { weight: '700', color: COLORS.peaCss })).setOrigin(0, 0.5);
    const pea = host.add.image(8, 0, 'icon-pea').setDisplaySize(20, 20);
    const hit = host.add.zone(0, 0, width, height + 8).setInteractive({ useHandCursor: true });
    const container = host.add
      .container(x, y, [
        drawPill(host, 0, 0, width, height),
        host.add.text(-46, 0, '+', textStyle(24, { weight: '700' })).setOrigin(0.5),
        host.add.image(-26, 0, 'icon-heart').setDisplaySize(24, 24),
        pea,
        cost,
        hit,
      ])
      .setDepth(DEPTH.hud);
    hit.on('pointerdown', () => {
      if (!repairHouse(host.state)) {
        playSound(host, 'noPeas');
        host.tweens.add({ targets: container, x: x + 6, duration: 50, yoyo: true, repeat: 3 });
        return;
      }
      playSound(host, 'upgrade');
      host.fx.sparkles.explode(16, host.house.x, host.house.y - 60);
      host.tweens.add({ targets: host.heartsPill, scale: 1.25, duration: 120, yoyo: true });
      popSpeechBubble(host, host.house.x, host.house.y - 150, 'Good as new!', DEPTH.floatText);
      host.refreshHud();
    });
    return { container, cost, pea };
  }
}
