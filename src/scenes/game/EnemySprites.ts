import Phaser from 'phaser';
import { playSound } from '../../audio/sfx';
import { ENEMIES, type EnemyKind } from '../../data/enemies';
import { VARIANTS } from '../../data/variants';
import { enemyPosition, enemyStats, inBrambles, inMud, isFlying, isHidden, type Enemy } from '../../logic/battle';
import { COLORS, DEPTH, entityDepth } from '../../ui/theme';
import { killTweensDeep, popSpeechBubble } from '../../ui/widgets';
import type { BossBar } from './BossBar';
import type { EnemySprite, GameHost } from './host';

const HP_BAR_WIDTH = 46;
const SLOW_RING = 0xb08a58; // dusty ring at the feet of predators Curtis is slowing

// How each walking predator looks: its picture's size, the shadow under it, and how it waddles.
const GROUND_LOOKS: Record<Exclude<EnemyKind, 'hawk' | 'stormHawk'>, { width: number; height: number; shadow: number; wobble: number; wobbleTime: number }> = {
  raccoon: { width: 92, height: 67, shadow: 64, wobble: 4, wobbleTime: 220 },
  fox: { width: 100, height: 68, shadow: 66, wobble: 5, wobbleTime: 140 },
  mink: { width: 88, height: 44, shadow: 60, wobble: 3, wobbleTime: 160 },
  skunk: { width: 94, height: 60, shadow: 64, wobble: 4, wobbleTime: 200 },
  turtle: { width: 110, height: 75, shadow: 90, wobble: 2, wobbleTime: 520 },
  bandit: { width: 150, height: 112, shadow: 124, wobble: 3, wobbleTime: 380 },
  silverFox: { width: 150, height: 102, shadow: 104, wobble: 4, wobbleTime: 150 },
  oldSnapper: { width: 180, height: 123, shadow: 150, wobble: 1.5, wobbleTime: 700 },
};
// Flyers are seen from above, so they're square.
const FLYING_SIZES: Record<'hawk' | 'stormHawk', number> = { hawk: 88, stormHawk: 140 };
const HIDDEN_ALPHA = 0.45; // a mink hiding in the grass is see-through

/**
 * The predators' pictures: a shadow, the art (waddling, or flapping if it flies), a little
 * health bar, dizzy stars, and the dusty ring Curtis's slow puts at their feet. Kept in step
 * with the battle every frame, with tints for being hit, soaked, muddy, or a variant.
 */
export class EnemySprites {
  private readonly sprites = new Map<number, EnemySprite>();
  // So the "Squelch!" and "Ouch!" bubbles don't come from every predator at once.
  private nextOuchAt = 0;
  private nextSquelchAt = 0;

  constructor(
    private readonly host: GameHost,
    private readonly bosses: BossBar,
  ) {}

  get(id: number): EnemySprite | undefined {
    return this.sprites.get(id);
  }

  /** A quick red "ouch" flash on these predators. */
  flash(ids: number[], until: number): void {
    for (const id of ids) {
      const sprite = this.sprites.get(id);
      if (sprite) sprite.flashUntil = until;
    }
  }

  add(enemy: Enemy): void {
    const host = this.host;
    const pos = enemyPosition(enemy);
    const flying = isFlying(enemy);
    const root = host.add.container(pos.x, pos.y);
    let art: Phaser.GameObjects.Image;
    let ripple: Phaser.GameObjects.Ellipse | undefined;
    let waddle: Phaser.Tweens.Tween;
    if (flying) {
      // Hawks cast a shadow below them, and point where they're diving.
      const size = FLYING_SIZES[enemy.kind as keyof typeof FLYING_SIZES] ?? 88;
      root.add(host.add.ellipse(0, size * 0.4, size * 0.57, size * 0.18, 0x000000, 0.18));
      const [from, to] = enemy.path.points;
      art = host.add
        .image(0, 0, enemy.kind)
        .setDisplaySize(size, size)
        .setRotation(Math.atan2(to!.y - from!.y, to!.x - from!.x) + Math.PI / 2);
      waddle = host.tweens.add({ targets: art, scaleX: art.scaleX * 0.8, duration: 170, yoyo: true, repeat: -1 });
      root.setDepth(DEPTH.effects - 1);
    } else {
      const look = GROUND_LOOKS[enemy.kind as keyof typeof GROUND_LOOKS];
      root.add(host.add.ellipse(0, 4, look.shadow, 16, 0x000000, 0.2));
      // Dusty ring at its feet while Curtis slows it.
      ripple = host.add.ellipse(0, 4, look.shadow + 14, 24).setStrokeStyle(4, SLOW_RING, 0.95).setVisible(false);
      host.tweens.add({ targets: ripple, scale: 1.15, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
      root.add(ripple);
      art = host.add.image(0, 0, enemy.kind).setDisplaySize(look.width, look.height).setOrigin(0.5, 0.85);
      waddle = host.tweens.add({ targets: art, angle: { from: -look.wobble, to: look.wobble }, duration: look.wobbleTime, yoyo: true, repeat: -1 });
      // Turtles climb out of the pond with a splash.
      if (ENEMIES[enemy.kind].fromPond) host.fx.splash.explode(16, pos.x, pos.y - 10);
    }
    root.add(art);

    const hpBack = host.add.rectangle(0, 0, HP_BAR_WIDTH + 4, 10, COLORS.ink).setOrigin(0.5);
    const hpFill = host.add.rectangle(-HP_BAR_WIDTH / 2, 0, HP_BAR_WIDTH, 6, 0x6ee06e).setOrigin(0, 0.5);
    const boss = !!ENEMIES[enemy.kind].boss;
    // Health bar and dizzy stars sit just above the predator's head, however big it is.
    const top = flying ? -art.displayHeight / 2 : -art.displayHeight * 0.85;
    const hpBar = host.add.container(0, top - 8, [hpBack, hpFill]).setVisible(false);
    const dizzy = host.add
      .container(0, boss ? top - 4 : top + 6, [
        host.add.image(-12, 0, 'star').setDisplaySize(16, 16).setTint(COLORS.goldLight),
        host.add.image(12, 0, 'star').setDisplaySize(16, 16).setTint(COLORS.goldLight),
      ])
      .setVisible(false);
    host.tweens.add({ targets: dizzy, angle: 360, duration: 900, repeat: -1 });
    root.add([hpBar, dizzy]);
    // Fade in, so a predator entering near the edge of a wide screen doesn't pop into view.
    root.setAlpha(0);
    host.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.sprites.set(enemy.id, { root, art, ripple, hpBar, hpFill, dizzy, lastX: pos.x, flashUntil: 0, waddle, nextTileFx: 0 });
  }

  sync(time: number): void {
    const host = this.host;
    for (const enemy of host.state.battle.enemies) {
      const sprite = this.sprites.get(enemy.id);
      if (!sprite) continue;
      const pos = enemyPosition(enemy);
      const flying = isFlying(enemy);
      if (!flying && Math.abs(pos.x - sprite.lastX) > 0.01) sprite.art.setFlipX(pos.x < sprite.lastX);
      sprite.lastX = pos.x;
      sprite.root.setPosition(pos.x, pos.y);
      if (!flying) sprite.root.setDepth(entityDepth(pos.y));

      const health = Math.max(0, enemy.hp / enemy.maxHp);
      // The boss the big bar at the bottom follows doesn't need its own little one.
      sprite.hpBar.setVisible(health < 1 && !this.bosses.follows(enemy.id));
      this.bosses.syncHealth(enemy.id, health);
      sprite.hpFill.width = HP_BAR_WIDTH * health;
      sprite.hpFill.fillColor = health > 0.5 ? 0x6ee06e : health > 0.25 ? COLORS.gold : COLORS.coral;
      sprite.dizzy.setVisible(enemy.stopTime > 0);

      // A dusty ring at its feet while Curtis slows it.
      sprite.ripple?.setVisible(enemy.slowed);
      // Minks (and sneaky variants) hiding in the grass are hard to see until Chester's quack flushes them out.
      if (enemyStats(enemy).sneaky) sprite.art.setAlpha(isHidden(enemy) ? HIDDEN_ALPHA : 1);
      const muddy = this.showTileEffects(enemy, sprite, time);
      // A quick red "ouch" tint when hit (keeps the art readable even when hit constantly).
      if (time < sprite.flashUntil) sprite.art.setTint(0xff9a9a);
      else if (enemy.stopTime > 0 && enemy.weakness > 0) sprite.art.setTint(0xd2b4ff); // Wise Old Chester's weakness
      else if (enemy.soakedTime > 0) sprite.art.setTint(0x9fd0ff); // soaked by a Soggy Splash
      else if (muddy) sprite.art.setTint(0xc4a07c); // splattered with mud
      else if (enemy.variant) sprite.art.setTint(VARIANTS[enemy.variant].tint); // a variant wears its colour
      else sprite.art.clearTint();
    }
  }

  private showTileEffects(enemy: Enemy, sprite: EnemySprite, time: number): boolean {
    const host = this.host;
    const muddy = inMud(host.state.battle, enemy);
    // (Prickly Curtis, a boss reward, prickles predators in his slow zone just like brambles.)
    const prickly = inBrambles(host.state.battle, enemy) || (host.state.battle.mods.prickle > 0 && enemy.slowed);
    sprite.waddle.timeScale = muddy ? 0.4 : 1;
    if (!(muddy || prickly) || time < sprite.nextTileFx || host.state.phase !== 'wave') return muddy;
    sprite.nextTileFx = time + (muddy ? 320 : 450);
    const { x, y } = sprite.root;
    if (muddy) {
      host.fx.mudSplash.explode(5, x, y);
      if (time > this.nextSquelchAt) {
        this.nextSquelchAt = time + 3500;
        popSpeechBubble(host, x, y - 60, 'Squelch!', DEPTH.floatText);
      }
    }
    if (prickly) {
      sprite.flashUntil = time + 100;
      host.fx.thorns.explode(3, x, y - 20);
      if (time > this.nextOuchAt) {
        this.nextOuchAt = time + 3500;
        popSpeechBubble(host, x, y - 60, 'Ouch!', DEPTH.floatText);
      }
    }
    return muddy;
  }

  remove(id: number, how: 'defeated' | 'house' | 'shooed'): void {
    const host = this.host;
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    this.sprites.delete(id);
    killTweensDeep(host, sprite.root, ...(sprite.ripple ? [sprite.ripple] : []));
    sprite.root.setAlpha(1);
    const { root } = sprite;
    const done = () => root.destroy();
    if (how === 'defeated') {
      host.fx.puff.explode(10, root.x, root.y - 20);
      host.tweens.add({ targets: root, alpha: 0, scale: 0.5, y: root.y - 20, duration: 300, onComplete: done });
    } else if (how === 'house') {
      host.tweens.add({ targets: root, alpha: 0, scale: 0.3, x: host.house.x, y: host.house.y - 20, duration: 350, onComplete: done });
    } else {
      host.fx.sparkles.explode(12, root.x, root.y);
      host.tweens.add({ targets: root, alpha: 0, angle: 540, y: root.y - 90, duration: 600, onComplete: done });
    }
  }

  /** A boss whistles up minions: they puff into view beside it. */
  showSummon(bossId: number, minions: Enemy[]): void {
    const host = this.host;
    const boss = this.sprites.get(bossId);
    playSound(host, 'whistle');
    const summoner = host.state.battle.enemies.find((e) => e.id === bossId);
    const say = summoner && ENEMIES[summoner.kind].quips?.summon;
    if (boss && say) popSpeechBubble(host, boss.root.x, boss.root.y - 110, say, DEPTH.floatText);
    for (const minion of minions) {
      this.add(minion);
      const pos = enemyPosition(minion);
      host.fx.puff.explode(8, pos.x, pos.y - 20);
    }
  }
}
