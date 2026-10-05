import type Phaser from 'phaser';
import { DUCKS, type DuckKind } from '../../data/ducks';
import type { HatKind } from '../../data/hats';
import { CHASES } from '../../data/synergy';
import { nameAt, statsAt } from '../../logic/upgrades';
import { duckWithHat } from '../../ui/hats';
import { COLORS, INK, textStyle } from '../../ui/theme';
import { fitWidth } from '../../ui/widgets';

/** Lines about a duck's power, hawks, and the Pecking Loop, for the duck panel and the picker's info card. */
export function duckInfoLines(
scene: Phaser.Scene,
hats: Partial<Record<DuckKind, HatKind>>,
kind: DuckKind,
partner?: DuckKind,
level = 0,
path = 0,
): Phaser.GameObjects.GameObject[] {
  const stats = { ...statsAt(kind, level, path), name: nameAt(kind, level, path) };
  const lines: Phaser.GameObjects.GameObject[] = [
    duckWithHat(scene, kind, -118, -58, 64, hats[kind]),
    fitWidth(scene.add.text(-80, -74, stats.name, textStyle(28, { ...INK, weight: '700' })).setOrigin(0, 0.5), 222),
    scene.add.image(-68, -44, `power-${stats.power.icon}`).setDisplaySize(24, 24),
    scene.add.text(-50, -44, stats.power.name, textStyle(20, { ...INK, color: COLORS.blueDarkCss, weight: '700' })).setOrigin(0, 0.5),
    scene.add
      .text(-138, -12, stats.power.description, { ...textStyle(17, INK), wordWrap: { width: 276 } })
      .setOrigin(0, 0),
  ];
  // Hawks. Chester can't peck them, but his Alarm Quack still freezes them.
  const freezesHawks = !stats.canHitFlying && !!stats.alarmQuack;
  const hawkText = (stats.flyerDamage ?? 1) > 1 ? 'Extra strong against hawks' : stats.canHitFlying ? 'Hits hawks' : freezesHawks ? "Freezes hawks, can't peck them" : "Can't hit hawks";
  const helpsWithHawks = stats.canHitFlying || freezesHawks;
  lines.push(scene.add.image(-126, 44, 'hawk').setDisplaySize(22, 22).setAlpha(helpsWithHawks ? 1 : 0.4));
  lines.push(
    scene.add
      .text(-108, 44, hawkText, textStyle(16, { ...INK, color: helpsWithHawks ? COLORS.textGreen : COLORS.textGrey }))
      .setOrigin(0, 0.5),
  );
  // Pecking Loop.
  const chases = CHASES[kind];
  const chasedBy = (Object.keys(CHASES) as DuckKind[]).find((k) => CHASES[k] === kind);
  const loopText = partner
    ? `Faster! Next to ${DUCKS[partner].name}`
    : chases
      ? `Faster next to ${DUCKS[chases].name}`
      : chasedBy
        ? `Makes ${DUCKS[chasedBy].name} faster`
        : 'Ignores everyone';
  lines.push(scene.add.text(-126, 70, '♥', textStyle(18, { color: COLORS.pinkCss, stroke: '#ffffff', strokeThickness: 3 })).setOrigin(0.5));
  lines.push(scene.add.text(-108, 70, loopText, textStyle(16, { ...INK, color: partner ? COLORS.pinkTextCss : '#8a5a70' })).setOrigin(0, 0.5));
  return lines;
}
