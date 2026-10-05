import Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../../data/ducks';
import { POWERS } from '../../data/powers';
import { duckStats, type PowerResult } from '../../logic/battle';
import { powerCooldown, powerState, usePower, type PowerState } from '../../logic/powers';
import { COLORS, DEPTH, INK, INK_GREY, WORLD, textStyle } from '../../ui/theme';
import { drawCard, drawRoundButton } from '../../ui/widgets';
import type { GameHost } from './host';
import { POWER_BUTTON } from './layout';

// Big Moves that have been introduced (a card the first time each one is ready), once per visit.
const introducedPowers = new Set<DuckKind>();

interface Button {
  container: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Image;
  /** The dark "pie" that shrinks as the power recharges. */
  shade: Phaser.GameObjects.Graphics;
  seconds: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Image;
  /** What it last showed, so it only redraws on a change. */
  state: PowerState | undefined;
}

/**
 * Flock powers ("Big Moves"): one round gold button per kind of duck, down the right edge.
 * Tap one during a wave for the kind's power (src/data/powers.ts); every duck of the kind
 * joins in. A button glows when ready, shows a shrinking shade and a countdown while the
 * power rests, and is dim when no duck of that kind is out.
 */
export class PowerButtons {
  private readonly buttons = {} as Record<DuckKind, Button>;

  constructor(private readonly host: GameHost) {
    DUCK_ORDER.forEach((kind, i) => {
      const x = POWER_BUTTON.x;
      const y = POWER_BUTTON.y + i * POWER_BUTTON.spacing;
      const r = POWER_BUTTON.radius;
      const glow = host.add.image(0, 0, 'glow').setDisplaySize(r * 3.4, r * 3.4).setTint(COLORS.gold).setAlpha(0);
      const face = host.add.image(0, -2, `duck-${kind}`).setDisplaySize(r * 1.45, r * 1.45);
      const shade = host.add.graphics();
      const seconds = host.add.text(0, 2, '', textStyle(22, { weight: '700', strokeThickness: 5 })).setOrigin(0.5);
      const badge = host.add.container(r * 0.62, -r * 0.62, [
        host.add.circle(0, 0, 11, 0xffffff).setStrokeStyle(2.5, COLORS.ink),
        host.add.image(0, 0, `power-${DUCKS[kind].power.icon}`).setDisplaySize(15, 15),
      ]);
      const button = drawRoundButton(host, x, y, r, COLORS.gold, COLORS.goldDark, [face, shade, seconds, badge]);
      button.container.addAt(glow, 0).setDepth(DEPTH.hud);
      host.tweens.add({ targets: glow, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      button.hit.on('pointerdown', () => this.onTap(kind));
      this.buttons[kind] = { container: button.container, face, shade, seconds, glow, state: undefined };
    });
    this.sync();
  }

  /** Shows each button as ready (glowing), resting (a shrinking shade and a countdown), or not usable yet. Called every frame. */
  sync(): void {
    const host = this.host;
    for (const kind of DUCK_ORDER) {
      const button = this.buttons[kind];
      const state = powerState(host.state, kind);
      const left = powerCooldown(host.state, kind);
      const r = POWER_BUTTON.radius;
      button.shade.clear();
      if (state === 'resting') {
        // A pie slice of shade, full at the start of the rest and gone when it's ready. Drawn as a
        // polygon with a point every 15 degrees: Phaser's own slice() would be 100 points, redone every frame.
        const share = left / POWERS[kind].cooldown;
        const points = [new Phaser.Geom.Point(0, 0)];
        const steps = Math.max(1, Math.ceil(24 * share));
        for (let i = 0; i <= steps; i++) {
          const a = -Math.PI / 2 + Math.PI * 2 * share * (i / steps);
          points.push(new Phaser.Geom.Point(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2)));
        }
        button.shade.fillStyle(COLORS.ink, 0.55).fillPoints(points, true);
        button.seconds.setText(String(Math.ceil(left)));
      } else {
        button.seconds.setText('');
      }
      if (state !== button.state) {
        // The first time a Big Move is ready, say what it does.
        if (state === 'ready' && !introducedPowers.has(kind)) {
          introducedPowers.add(kind);
          if (!host.popup) this.showInfo(kind, 'Ready! Tap the gold button.');
        }
        button.state = state;
        button.container.setAlpha(state === 'noDuck' ? 0.4 : state === 'notNow' ? 0.75 : 1);
        if (state === 'ready') button.face.clearTint();
        else button.face.setTint(0x9a9a9a);
        button.glow.setAlpha(state === 'ready' ? 0.75 : 0);
      }
    }
  }

  /** A card beside the button: the duck, its Big Move, what it does, and a note (why it can't be used yet, or that it's ready). */
  private showInfo(kind: DuckKind, note: string): void {
    const host = this.host;
    host.closePopup();
    const power = POWERS[kind];
    const words = host.add.text(-150, 0, power.description, { ...textStyle(19, INK), wordWrap: { width: 300 } }).setOrigin(0, 0);
    const H = 108 + words.height;
    const top = -H / 2;
    words.setY(top + 62);
    const card = drawCard(host.add.graphics(), 330, H, { radius: 18, border: COLORS.gold, borderWidth: 4 });
    const button = this.buttons[kind];
    const y = Math.max(H / 2 + 20, Math.min(WORLD.height - H / 2 - 20, button.container.y));
    const popup = host.add
      .container(POWER_BUTTON.x - POWER_BUTTON.radius - 185, y, [
        card,
        host.add.image(-126, top + 32, `duck-${kind}`).setDisplaySize(40, 40),
        host.add.text(-100, top + 20, `${DUCKS[kind].name}'s Big Move`, textStyle(17, INK_GREY)).setOrigin(0, 0.5),
        host.add.text(-100, top + 43, power.name, textStyle(24, { ...INK, color: COLORS.textGold, weight: '700' })).setOrigin(0, 0.5),
        words,
        host.add.text(-150, H / 2 - 24, note, textStyle(17, { ...INK, color: COLORS.blueDarkCss, weight: '700' })).setOrigin(0, 0.5),
      ])
      .setDepth(DEPTH.hud + 5);
    host.showPopup(popup, 5000);
  }

  private onTap(kind: DuckKind): void {
    const host = this.host;
    const button = this.buttons[kind];
    const state = powerState(host.state, kind);
    if (state !== 'ready') {
      playSound(host, 'noPeas');
      host.tweens.add({ targets: button.container, x: button.container.x - 6, duration: 50, yoyo: true, repeat: 3 });
      const why =
        state === 'noDuck'
          ? `Put a ${DUCKS[kind].name} out first!`
          : state === 'notNow'
            ? 'Wait for the wave, then tap!'
            : `Resting: ready in ${Math.ceil(powerCooldown(host.state, kind))}s`;
      this.showInfo(kind, why);
      return;
    }
    const result = usePower(host.state, kind);
    if (!result) return;
    host.closePopup();
    host.tweens.add({ targets: button.container, scale: 1.2, duration: 120, yoyo: true });
    this.show(kind, result);
    host.refreshHud();
  }

  /** The big show when a flock power goes off. */
  private show(kind: DuckKind, result: PowerResult): void {
    const host = this.host;
    host.showBanner(`${POWERS[kind].name}!`);
    for (const id of result.hitIds) {
      const sprite = host.enemySprites.get(id);
      if (sprite) sprite.flashUntil = host.time.now + 200;
    }
    for (const duckId of result.duckIds) {
      const found = host.duckSprite(duckId);
      if (!found) continue;
      const { sprite, duck } = found;
      const { range } = duckStats(host.state.battle, duck);
      host.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.3, duration: 140, yoyo: true });
      switch (kind) {
        case 'sunny':
          playSound(host, 'splash');
          host.ring(duck.position.x, duck.position.y - 20, range, COLORS.blue, 600);
          host.fx.splash.explode(40, duck.position.x, duck.position.y - 30);
          for (const id of result.hitIds) {
            const enemy = host.enemySprites.get(id);
            if (enemy) host.fx.splash.explode(14, enemy.root.x, enemy.root.y - 20);
          }
          break;
        case 'potato':
          playSound(host, 'flap');
          host.ring(duck.position.x, duck.position.y - 20, range, 0xffffff, 500);
          host.fx.feathers.explode(24, duck.position.x, duck.position.y - 30);
          host.fx.puff.explode(16, duck.position.x, duck.position.y);
          break;
        case 'chester':
          playSound(host, 'quack');
          host.cameras.main.shake(350, 0.006);
          host.ring(duck.position.x, duck.position.y - 30, 900, COLORS.gold, 900);
          host.time.delayedCall(150, () => host.ring(duck.position.x, duck.position.y - 30, 700, COLORS.gold, 800));
          host.floatText({ x: duck.position.x, y: duck.position.y - 80 }, 'QUAAACK!', COLORS.goldCss);
          break;
        case 'curtis':
          playSound(host, 'upgrade');
          host.ring(duck.position.x, duck.position.y - 20, 900, COLORS.green, 900);
          host.fx.stars.explode(14, duck.position.x, duck.position.y - 40);
          host.floatText({ x: duck.position.x, y: duck.position.y - 80 }, 'Hold the line!', COLORS.peaCss);
          break;
      }
    }
  }
}
