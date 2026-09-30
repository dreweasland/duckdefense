import Phaser from 'phaser';
import { playSound } from '../audio/sfx';
import { drawGrass, drawOutskirts } from '../art/terrain';
import { DUCK_ORDER, DUCKS, type DuckKind } from '../data/ducks';
import { HAT_ORDER, HATS, type HatKind } from '../data/hats';
import { hatFor, isHatUnlocked, totalStars, wearHat } from '../logic/hats';
import { loadProgress, saveProgress } from '../save';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { duckWithHat } from '../ui/hats';
import { drawCard, drawPill, drawRoundButton, drawSoundButton, popSpeechBubble } from '../ui/widgets';

// The Wardrobe: tap a duck, then tap a hat to put it on. Stars from winning levels unlock hats.

const DUCK_CARD = { width: 180, height: 190, y: 230, spacing: 200 };
const HAT_CARD = { width: 150, height: 124, spacing: 164, rows: [440, 580] };
const PER_ROW = 6;

export class WardrobeScene extends Phaser.Scene {
  private selected: DuckKind = 'sunny';
  private stars = 0;
  private duckCards: { kind: DuckKind; container: Phaser.GameObjects.Container }[] = [];
  private hatCards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('WardrobeScene');
  }

  create(): void {
    setupCamera(this);
    drawGrass(this, 71);
    drawOutskirts(this, 72);
    const cx = WORLD.width / 2;
    this.selected = 'sunny';
    this.duckCards = [];
    this.hatCards = [];
    this.stars = totalStars(loadProgress());

    this.add.text(cx, 62, 'Duck Wardrobe', textStyle(58, { weight: '700', strokeThickness: 10 })).setOrigin(0.5);

    // Stars earned so far (they unlock hats).
    drawPill(this, WORLD.width - 110, 62, 130, 52);
    this.add.image(WORLD.width - 148, 62, 'star').setDisplaySize(34, 34).setTint(COLORS.gold);
    this.add.text(WORLD.width - 126, 62, String(this.stars), textStyle(30)).setOrigin(0, 0.5);

    const arrow = this.add
      .graphics()
      .fillStyle(0xffffff)
      .fillTriangle(8, -16, 8, 16, -16, 0)
      .lineStyle(4, COLORS.ink)
      .strokeTriangle(8, -16, 8, 16, -16, 0);
    const back = drawRoundButton(this, 70, 70, 40, COLORS.blue, COLORS.blueDark, [arrow]);
    back.hit.on('pointerdown', () => {
      playSound(this, 'tap');
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('TitleScene'));
    });
    drawSoundButton(this, WORLD.width - 40, WORLD.height - 40, 100);

    this.drawDucks();
    this.drawHats();
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  /** The four ducks, each wearing its hat. The one being dressed has a gold border. */
  private drawDucks(): void {
    this.duckCards.forEach(({ container }) => container.destroy());
    this.duckCards = [];
    const progress = loadProgress();
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    DUCK_ORDER.forEach((kind, i) => {
      const x = WORLD.width / 2 + (i - (DUCK_ORDER.length - 1) / 2) * DUCK_CARD.spacing;
      const on = kind === this.selected;
      const card = drawCard(this.add.graphics(), DUCK_CARD.width, DUCK_CARD.height, {
        radius: 20,
        border: on ? COLORS.gold : COLORS.ink,
        borderWidth: on ? 7 : 3,
        fill: on ? 0xfff0b3 : COLORS.cream,
      });
      const duck = duckWithHat(this, kind, 0, 4, 120, hatFor(progress, kind));
      const name = this.add.text(0, DUCK_CARD.height / 2 - 22, DUCKS[kind].name, textStyle(22, { ...ink, weight: '700' })).setOrigin(0.5);
      const hit = this.add.zone(0, 0, DUCK_CARD.width, DUCK_CARD.height).setInteractive({ useHandCursor: true });
      const container = this.add.container(x, DUCK_CARD.y - (on ? 6 : 0), [card, duck, name, hit]);
      if (on) this.tweens.add({ targets: duck, y: -2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      hit.on('pointerdown', () => {
        if (kind === this.selected) return;
        playSound(this, 'tap');
        this.selected = kind;
        this.drawDucks();
        this.drawHats();
      });
      this.duckCards.push({ kind, container });
    });
  }

  /** Every hat, plus "No hat". Locked hats show a padlock and how many stars they need. */
  private drawHats(): void {
    this.hatCards.forEach((card) => card.destroy());
    this.hatCards = [];
    const wearing = hatFor(loadProgress(), this.selected);
    const choices: (HatKind | undefined)[] = [undefined, ...HAT_ORDER];
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    choices.forEach((hat, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, choices.length - row * PER_ROW);
      const x = WORLD.width / 2 + ((i % PER_ROW) - (inRow - 1) / 2) * HAT_CARD.spacing;
      const y = HAT_CARD.rows[row]!;
      const unlocked = !hat || isHatUnlocked(hat, this.stars);
      const on = hat === wearing;
      const parts: Phaser.GameObjects.GameObject[] = [
        drawCard(this.add.graphics(), HAT_CARD.width, HAT_CARD.height, {
          radius: 16,
          border: on ? COLORS.gold : COLORS.ink,
          borderWidth: on ? 6 : 3,
          fill: on ? 0xfff0b3 : COLORS.cream,
        }),
      ];
      if (hat) {
        parts.push(this.add.image(0, -14, `hat-${hat}`).setDisplaySize(76, 68).setAlpha(unlocked ? 1 : 0.35));
      } else {
        // "No hat": a circle with a line through it.
        parts.push(this.add.graphics().lineStyle(6, 0xb8b0a8).strokeCircle(0, -14, 24).lineBetween(-17, 3, 17, -31));
      }
      parts.push(
        this.add
          .text(0, HAT_CARD.height / 2 - 20, hat ? HATS[hat].name : 'No hat', textStyle(16, { ...ink, weight: '700' }))
          .setOrigin(0.5)
          .setAlpha(unlocked ? 1 : 0.5),
      );
      if (!unlocked && hat) {
        // Padlock with the stars needed.
        parts.push(
          this.add.graphics().fillStyle(COLORS.panel, 0.75).fillRoundedRect(-44, -30, 88, 34, 17),
          this.add.image(-22, -13, 'star').setDisplaySize(24, 24).setTint(COLORS.gold),
          this.add.text(-6, -13, String(HATS[hat].stars), textStyle(20)).setOrigin(0, 0.5),
        );
      }
      const hit = this.add.zone(0, 0, HAT_CARD.width, HAT_CARD.height).setInteractive({ useHandCursor: true });
      parts.push(hit);
      const container = this.add.container(x, y, parts);
      hit.on('pointerdown', () => this.pickHat(hat, container));
      this.hatCards.push(container);
    });
  }

  private pickHat(hat: HatKind | undefined, card: Phaser.GameObjects.Container): void {
    if (hat && !isHatUnlocked(hat, this.stars)) {
      playSound(this, 'noPeas');
      this.tweens.add({ targets: card, x: card.x + 8, duration: 50, yoyo: true, repeat: 3 });
      const more = HATS[hat].stars - this.stars;
      popSpeechBubble(this, card.x, card.y - 60, `${more} more ${more === 1 ? 'star' : 'stars'}!`, 200);
      return;
    }
    saveProgress(wearHat(loadProgress(), this.selected, hat));
    playSound(this, hat ? 'upgrade' : 'tap');
    this.drawDucks();
    this.drawHats();
    // The duck hops happily in its new hat.
    const duck = this.duckCards.find((d) => d.kind === this.selected)?.container;
    if (duck) this.tweens.add({ targets: duck, y: duck.y - 20, duration: 140, yoyo: true, ease: 'Quad.Out' });
  }
}
