import Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { ENEMIES } from '../../data/enemies';
import { enemyPosition, type Enemy } from '../../logic/battle';
import type { Point } from '../../logic/geometry';
import { COLORS, DEPTH, WORLD, textStyle } from '../../ui/theme';
import { popSpeechBubble } from '../../ui/widgets';
import type { GameHost } from './host';
import { BOSS_BAR_WIDTH } from './layout';

/**
 * Bosses (the Night Bandit, and the Endless Pond's others): the big health bar along the
 * bottom of the screen, and the shouting, shaking, and bursts when one arrives, gets its
 * second wind, or leaves. More than one boss at once (late in the Endless Pond): the bar
 * follows the first, then moves to the next when that one goes.
 */
export class BossBar {
  private bar?: {
    container: Phaser.GameObjects.Container;
    fill: Phaser.GameObjects.Rectangle;
    face: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.Text;
    enemyId: number;
  };

  constructor(private readonly host: GameHost) {}

  /** Whether the big bar is following this predator. */
  follows(enemyId: number): boolean {
    return this.bar?.enemyId === enemyId;
  }

  /** Keeps the big bar's fill in step with the boss it follows. */
  syncHealth(enemyId: number, health: number): void {
    if (this.bar?.enemyId === enemyId) this.bar.fill.width = BOSS_BAR_WIDTH * health;
  }

  showEntrance(enemy: Enemy): void {
    const host = this.host;
    const stats = ENEMIES[enemy.kind];
    playSound(host, 'bossArrives');
    host.cameras.main.shake(450, 0.004);
    host.showBanner(`${stats.name} is here!`);
    const pos = enemyPosition(enemy);
    const say = stats.quips?.arrive;
    if (say) host.time.delayedCall(700, () => popSpeechBubble(host, pos.x, pos.y - 110, say, DEPTH.floatText));
    if (this.bar) return;

    // Big health bar along the bottom of the screen.
    const panel = host.add
      .graphics()
      .fillStyle(COLORS.panel, 0.8)
      .fillRoundedRect(-240, -23, 480, 46, 23)
      .lineStyle(3, 0xffffff, 0.3)
      .strokeRoundedRect(-240, -23, 480, 46, 23);
    const face = host.enemyIcon(enemy.kind, -208, -1, 52, 40);
    const name = host.add.text(-174, -10, stats.name, textStyle(16)).setOrigin(0, 0.5);
    const back = host.add.rectangle(-174, 10, BOSS_BAR_WIDTH, 12, 0x000000, 0.5).setOrigin(0, 0.5);
    const fill = host.add.rectangle(-174, 10, BOSS_BAR_WIDTH, 12, COLORS.coral).setOrigin(0, 0.5);
    // Sits along the very bottom edge, below where paths run.
    const container = host.add
      .container(WORLD.width / 2, WORLD.height - 20, [panel, face, name, back, fill])
      .setDepth(DEPTH.hud)
      .setAlpha(0);
    host.tweens.add({ targets: container, alpha: 1, y: container.y - 6, duration: 400 });
    this.bar = { container, fill, face, name, enemyId: enemy.id };
  }

  /** A boss gets its second wind: it shouts, the screen shakes, and its big bar turns angry. */
  showPhase(enemy: Enemy, at: Point): void {
    const host = this.host;
    const { phase, name } = ENEMIES[enemy.kind];
    playSound(host, 'bossArrives');
    host.cameras.main.shake(400, 0.005);
    if (phase) popSpeechBubble(host, at.x, at.y - 110, phase.quip, DEPTH.floatText);
    host.showBanner(`${name} is getting angry!`);
    const sprite = host.enemySprites.get(enemy.id);
    if (sprite) {
      host.fx.stars.explode(16, at.x, at.y - 40);
      host.tweens.add({ targets: sprite.art, scale: sprite.art.scale * 1.25, duration: 160, yoyo: true, repeat: 2 });
    }
    if (this.bar?.enemyId === enemy.id) this.bar.fill.fillColor = 0xff9a2e;
  }

  /** A boss was beaten, got in, or was shooed: a burst, a banner, and the bar moves on or goes. */
  showGone(at: Point, message: string): void {
    const host = this.host;
    host.fx.puff.explode(30, at.x, at.y - 40);
    host.fx.stars.explode(20, at.x, at.y - 40);
    host.showBanner(message);
    const bar = this.bar;
    // The big bar only changes when the boss it's following is the one that left.
    if (bar && host.state.battle.enemies.some((e) => e.id === bar.enemyId)) return;
    // Another boss still out? The big bar moves to it.
    const next = host.state.battle.enemies.find((e) => ENEMIES[e.kind].boss && e.id !== bar?.enemyId);
    if (bar && next) {
      bar.enemyId = next.id;
      bar.name.setText(ENEMIES[next.kind].name);
      bar.face.setTexture(next.kind);
      bar.face.setScale(Math.min(52 / bar.face.width, 40 / bar.face.height));
      return;
    }
    this.bar = undefined;
    if (bar) host.tweens.add({ targets: bar.container, alpha: 0, duration: 400, onComplete: () => bar.container.destroy() });
  }
}
