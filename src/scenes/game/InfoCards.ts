import type Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import type { Challenge } from '../../data/challenges';
import { FOUNTAIN } from '../../data/dayNight';
import { DUCKS, type DuckKind } from '../../data/ducks';
import { ENEMIES, type EnemyKind } from '../../data/enemies';
import { POWERS } from '../../data/powers';
import { TILES, type NestKind } from '../../data/tiles';
import { VARIANTS, type VariantKind } from '../../data/variants';
import { enemyName } from '../../logic/battle';
import { isOver } from '../../logic/game';
import type { Point } from '../../logic/geometry';
import type { Level } from '../../logic/level';
import { COLORS, DEPTH, INK, INK_GREY, WORLD, textStyle } from '../../ui/theme';
import { drawCard, fitWidth } from '../../ui/widgets';
import { duckInfoLines } from './duckCard';
import { enemyIcon } from './enemyIcon';
import type { GameHost } from './host';

export type TileKind = 'mud' | 'brambles' | NestKind;

/**
 * The cards that explain things: the level's twist, a predator (tap it in the wave preview),
 * the duck you just picked, a special tile, the map key when a level starts, and the solar
 * fountain. Each is shown as the open popup and fades away on its own.
 */
export class InfoCards {
  constructor(
    private readonly host: GameHost,
    private readonly level: Level,
  ) {}

  /** The Daily Challenge's (or Level Trial's) twist, shown when the level starts. */
  showChallenge(challenge: Challenge, ribbon: boolean): void {
    const host = this.host;
    if (host.popup) return;
    // Two twists at once have a longer name and twice the words, so the card grows to fit.
    const words = host.add.text(-186, -6, challenge.description, { ...textStyle(19, INK), wordWrap: { width: 372 } }).setOrigin(0, 0);
    const height = Math.max(150, words.height + 94);
    const card = drawCard(host.add.graphics(), 420, height, { radius: 18, border: COLORS.gold, borderWidth: 5 });
    const top = -height / 2;
    words.setY(top + 58);
    const popup = host.add
      .container(WORLD.width / 2, 250 + (height - 150) / 2, [
        card,
        ribbon
          ? host.add.image(-172, top + 37, 'ribbon').setDisplaySize(44, 44).setTint(COLORS.pink)
          : host.add.image(-172, top + 37, 'star').setDisplaySize(40, 40).setTint(COLORS.gold),
        host.add.text(-142, top + 37, challenge.name, textStyle(challenge.name.length > 18 ? 22 : 28, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        words,
      ])
      .setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 6000);
  }

  /** What a predator does and which duck is best against it, shown when you tap it in the preview. */
  showEnemy(kind: EnemyKind, tapped = true, variant?: VariantKind): void {
    const host = this.host;
    host.cancelMove();
    host.closePopup();
    if (tapped) playSound(host, 'tap');
    const stats = ENEMIES[kind];
    const twist = variant && VARIANTS[variant];
    const name = enemyName({ kind, variant });
    const best = DUCKS[stats.beatenBy];
    // A variant's words go under the predator's own, so the card grows a little.
    const extra = twist ? 70 : 0;
    const card = drawCard(host.add.graphics(), 330, 204 + extra, { radius: 18 });
    const popup = host.add
      .container(WORLD.width - 190, 270 + extra / 2, [
        card,
        enemyIcon(host, kind, -118, -56 - extra / 2, 70, 56, variant),
        // Long names ("Regrowing Snapping Turtle") shrink to stay on the card.
        fitWidth(host.add.text(-74, -62 - extra / 2, name, textStyle(name.length > 12 ? 22 : 26, { ...INK, weight: '700' })).setOrigin(0, 0.5), 222),
        host.add.image(-66, -32 - extra / 2, 'icon-heart').setDisplaySize(18, 18),
        host.add.text(-52, -32 - extra / 2, `${stats.hearts}`, textStyle(16, { ...INK, color: '#c0392b', weight: '700' })).setOrigin(0, 0.5),
        host.add
          .text(-148, -12 - extra / 2, twist ? `${stats.description}\n${twist.name}: ${twist.description}` : stats.description, {
            ...textStyle(18, INK),
            wordWrap: { width: 296 },
          })
          .setOrigin(0, 0),
        host.add.text(-148, 74 + extra / 2, 'Best duck:', textStyle(18, { ...INK, color: COLORS.textGreen, weight: '700' })).setOrigin(0, 0.5),
        host.add.image(-40, 70 + extra / 2, `duck-${stats.beatenBy}`).setDisplaySize(40, 40),
        host.add.text(-16, 74 + extra / 2, best.name, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
      ])
      .setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 6000);
  }

  /** A card under the picker explaining the duck you just picked. Fades on its own. */
  showPicked(kind: DuckKind): void {
    const host = this.host;
    host.closePopup();
    // The duck's card, plus its Big Move (the tap-to-use one, on the buttons down the right).
    const card = drawCard(host.add.graphics(), 310, 232, { radius: 18 });
    const lines = host.add.container(0, -22, duckInfoLines(host, host.hats, kind)); // the usual card's lines, shifted up to make room
    const bigMove = [
      host.add.image(-126, 86, 'glow').setDisplaySize(30, 30).setTint(COLORS.gold),
      host.add.image(-126, 86, `duck-${kind}`).setDisplaySize(22, 22),
      host.add.text(-108, 84, `Big Move: ${POWERS[kind].name}`, textStyle(18, { ...INK, color: COLORS.textGold, weight: '700' })).setOrigin(0, 0.5),
      host.add.text(-108, 105, 'tap the gold button on the right', textStyle(16, INK_GREY)).setOrigin(0, 0.5),
    ];
    const popup = host.add.container(196, 232, [card, lines, ...bigMove]).setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 4000);
  }

  /** The kinds of special tiles on this map, in a fixed order. */
  tilesOnMap(): TileKind[] {
    const kinds: TileKind[] = [];
    if (this.level.mud.length) kinds.push('mud');
    if (this.level.brambles.length) kinds.push('brambles');
    for (const nest of ['hill', 'water'] as const) if (this.level.specialNests.some((n) => n.kind === nest)) kinds.push(nest);
    return kinds;
  }

  /** A tile's name and what it does, in words a kid can read. */
  private tileWords(kind: TileKind): { name: string; text: string } {
    if (kind === 'mud' || kind === 'brambles') return { name: TILES[kind].name, text: TILES[kind].description };
    return { name: TILES.nests[kind].name, text: `A duck in this nest ${TILES.nests[kind].description}.` };
  }

  /** A little picture of a tile, for the map key and info cards. */
  private tileIcon(kind: TileKind, x: number, y: number): Phaser.GameObjects.GameObject {
    const host = this.host;
    const g = host.add.graphics().setPosition(x, y);
    switch (kind) {
      case 'mud':
        g.fillStyle(0x4a3322).fillEllipse(0, 2, 34, 18).fillStyle(0x5e4230).fillEllipse(0, 0, 26, 12);
        g.fillStyle(0xffffff, 0.3).fillEllipse(-5, -2, 10, 3);
        return g;
      case 'brambles':
        g.fillStyle(0x4f7a2e).fillCircle(0, 0, 13).lineStyle(3, COLORS.ink).strokeCircle(0, 0, 13);
        for (const a of [0, 1.2, 2.4, 3.6, 4.8]) {
          const cx = Math.cos(a) * 13;
          const cy = Math.sin(a) * 13;
          g.fillStyle(0xf2e6c8).fillTriangle(cx - 3, cy, cx + 3, cy, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
        }
        g.fillStyle(0x6a2a5a).fillCircle(4, -3, 3.5);
        return g;
      case 'hill':
        g.fillStyle(0x5f9e3c).fillEllipse(0, 6, 34, 14).fillStyle(0x5f9e3c).fillTriangle(-11, 6, 0, -10, 11, 6);
        g.fillStyle(0xffffff).fillTriangle(-4, -4, 0, -10, 4, -4);
        return g;
      case 'water':
        g.destroy();
        return host.add.image(x, y, 'power-splash').setDisplaySize(28, 28);
    }
  }

  /** What a tile does, shown when you tap it. */
  showTile(kind: TileKind, at: Point): void {
    const host = this.host;
    host.cancelMove();
    host.closePopup();
    playSound(host, 'tap');
    const { name, text } = this.tileWords(kind);
    const card = drawCard(host.add.graphics(), 320, 130, { radius: 18 });
    const popup = host.add
      .container(Math.max(170, Math.min(WORLD.width - 170, at.x)), at.y + (at.y < 300 ? 120 : -120), [
        card,
        this.tileIcon(kind, -126, -34),
        host.add.text(-100, -34, name, textStyle(24, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        host.add.text(-142, -6, text, { ...textStyle(17, INK), wordWrap: { width: 284 } }).setOrigin(0, 0),
      ])
      .setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 5000);
  }

  /** "On this map": a key to the special tiles, shown when a level starts. Fades on its own. */
  showMapKey(): void {
    const host = this.host;
    if (host.popup || isOver(host.state)) return;
    const kinds = this.tilesOnMap();
    const W = 460;
    const rowH = 56;
    const H = 64 + kinds.length * rowH;
    const parts: Phaser.GameObjects.GameObject[] = [
      drawCard(host.add.graphics(), W, H, { radius: 20, border: COLORS.gold, borderWidth: 5 }),
      host.add.text(0, -H / 2 + 30, 'On this map', textStyle(26, { ...INK, weight: '700' })).setOrigin(0.5),
    ];
    kinds.forEach((kind, i) => {
      const y = -H / 2 + 76 + i * rowH;
      const { name, text } = this.tileWords(kind);
      parts.push(
        this.tileIcon(kind, -W / 2 + 36, y),
        host.add.text(-W / 2 + 64, y - 12, name, textStyle(20, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        fitWidth(host.add.text(-W / 2 + 64, y + 12, text, textStyle(17, INK)).setOrigin(0, 0.5), W - 84),
      );
    });
    const popup = host.add.container(WORLD.width / 2, 250 + H / 2 - 60, parts).setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 9000);
  }

  /** What the solar fountain does, shown when you tap it. */
  showFountain(): void {
    const host = this.host;
    const at = host.state.battle.fountain?.position;
    if (!at) return;
    host.cancelMove();
    host.closePopup();
    playSound(host, 'tap');
    const boost = Math.round(FOUNTAIN.damageBoost * 100);
    const card = drawCard(host.add.graphics(), 320, 170, { radius: 18 });
    const popup = host.add
      .container(Math.max(170, Math.min(WORLD.width - 170, at.x)), at.y + (at.y < 300 ? 150 : -150), [
        card,
        host.add.image(-118, -46, 'fountain').setDisplaySize(52, 52),
        host.add.text(-84, -58, 'Solar Fountain', textStyle(26, { ...INK, weight: '700' })).setOrigin(0, 0.5),
        host.add.image(-76, -30, 'icon-bolt').setDisplaySize(20, 20),
        host.add.text(-62, -30, 'Runs on the battery', textStyle(17, { ...INK, color: COLORS.blueDarkCss, weight: '700' })).setOrigin(0, 0.5),
        host.add
          .text(-142, 4, `Ducks in its spray hit ${boost}% harder while the battery has charge. The sun charges it by day; it runs down at night.`, {
            ...textStyle(16, INK),
            wordWrap: { width: 284 },
          })
          .setOrigin(0, 0),
      ])
      .setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 5000);
  }
}
