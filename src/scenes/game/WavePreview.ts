import type Phaser from 'phaser';
import { wavePreview, type PreviewEntry } from '../../logic/game';
import { COLORS, DEPTH, textStyle } from '../../ui/theme';
import { drawPill, killTweensDeep } from '../../ui/widgets';
import { enemyIcon } from './enemyIcon';
import type { GameHost } from './host';
import type { InfoCards } from './InfoCards';
import { PREVIEW } from './layout';

/**
 * Between waves, little chips beside the start button show what's coming next: the predator,
 * how many, and NEW the first time one shows up. Tap a chip to learn about that predator.
 */
export class WavePreview {
  private readonly row: Phaser.GameObjects.Container;
  /** Which wave the chips show (so they're only rebuilt when it changes). */
  private key = '';

  constructor(
    private readonly host: GameHost,
    private readonly cards: InfoCards,
  ) {
    this.row = host.add.container(0, 0).setDepth(DEPTH.hud);
  }

  /** Forgets what's shown, so the next refresh rebuilds the chips (the Sandbox's wave arrows use this). */
  reset(): void {
    this.key = '';
  }

  /** Between waves, little chips beside the start button show what's coming next. Tap one to learn about it. */
  refresh(): void {
    const host = this.host;
    const game = host.state;
    const key = game.phase === 'building' ? `${game.waveIndex}` : '';
    if (key === this.key) return;
    this.key = key;
    killTweensDeep(host, this.row);
    this.row.removeAll(true);
    if (!key) return;

    const entries = wavePreview(game.waves, game.waveIndex);
    const chip = Math.min(PREVIEW.chip, (PREVIEW.maxWidth + PREVIEW.gap) / entries.length - PREVIEW.gap);
    const scale = chip / PREVIEW.chip;
    entries.forEach((entry, i) => {
      const x = PREVIEW.right - (entries.length - i) * (chip + PREVIEW.gap) + PREVIEW.gap + chip / 2;
      const container = this.chip(entry, x, PREVIEW.y, scale);
      const hit = host.add.zone(0, 0, PREVIEW.chip, 52).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.cards.showEnemy(entry.enemy, true, entry.variant));
      container.add(hit);
      container.setAlpha(0);
      host.tweens.add({ targets: container, alpha: 1, duration: 250, delay: i * 70 });
      this.row.add(container);
    });

    // Meeting a predator for the first time (after the first wave): explain it right away.
    const firstNew = entries.find((e) => e.isNew);
    if (firstNew && game.waveIndex > 0) {
      host.time.delayedCall(1900, () => {
        if (!host.popup && host.state.phase === 'building' && this.key === key) this.cards.showEnemy(firstNew.enemy, false);
      });
    }
  }

  /** One "coming next" chip: the predator, how many, and a NEW badge the first time it shows up. */
  chip(entry: PreviewEntry, x: number, y: number, scale = 1): Phaser.GameObjects.Container {
    const host = this.host;
    const parts: Phaser.GameObjects.GameObject[] = [
      drawPill(host, 0, 0, PREVIEW.chip, 48),
      enemyIcon(host, entry.enemy, 0, -4, 40, 30, entry.variant),
      host.add.text(PREVIEW.chip / 2 - 5, 13, `×${entry.count}`, textStyle(17, { weight: '700' })).setOrigin(1, 0.5),
    ];
    if (entry.isNew) {
      const badge = host.add.container(PREVIEW.chip / 2 - 10, -26, [
        host.add.graphics().fillStyle(COLORS.pink).fillRoundedRect(-19, -9, 38, 18, 9).lineStyle(2, COLORS.ink).strokeRoundedRect(-19, -9, 38, 18, 9),
        host.add.text(0, 0, 'NEW', textStyle(12, { weight: '700', strokeThickness: 3 })).setOrigin(0.5),
      ]);
      host.tweens.add({ targets: badge, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      parts.push(badge);
    }
    return host.add.container(x, y, parts).setScale(scale);
  }
}
