import Phaser from 'phaser';
import { fetchScores, type ScoreRow } from '../api';
import { playSound } from '../audio/sfx';
import { drawGrass, drawOutskirts } from '../art/terrain';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { LEVELS } from '../data/levels';
import { dailyDate, dailyFor } from '../logic/daily';
import { COLORS, WORLD, setupCamera, textStyle } from '../ui/theme';
import { drawBackButton, drawCard, fadeToScene } from '../ui/widgets';

export interface LeaderboardSceneData {
  level?: number;
  /** Show this date's Daily Challenge board (YYYY-MM-DD) instead of a level's. */
  daily?: string;
  /** Show the Endless Pond board. */
  endless?: boolean;
  difficulty?: Difficulty;
  /** Score id to highlight (the one just posted). */
  highlightId?: number;
  /** Where the back button goes. */
  back?: { scene: string; data?: object };
}

const LIST = { x: WORLD.width / 2, y: 430, width: 640, height: 420, rowHeight: 36 };
const MEDALS = [0xffd23f, 0xc9d1d9, 0xe0955a];

export class LeaderboardScene extends Phaser.Scene {
  private level = 0;
  /** The Daily Challenge date the Daily tab shows, and whether that tab is picked. */
  private dailyDate = '';
  /** Which tab is picked: the Daily Challenge, a level (this.level), or the Endless Pond. */
  private board: 'daily' | 'level' | 'endless' = 'level';
  private difficulty: Difficulty = 'easy';
  private highlightId?: number;
  private back: { scene: string; data?: object } = { scene: 'TitleScene' };
  private tabs: { refresh: () => void }[] = [];
  private list?: Phaser.GameObjects.Container;
  private requestId = 0;

  constructor() {
    super('LeaderboardScene');
  }

  init(data: LeaderboardSceneData): void {
    this.level = data.level ?? 0;
    this.dailyDate = data.daily ?? dailyDate();
    this.board = data.endless ? 'endless' : data.daily ? 'daily' : 'level';
    this.difficulty = data.difficulty ?? 'easy';
    this.highlightId = data.highlightId;
    this.back = data.back ?? { scene: 'TitleScene' };
    this.tabs = [];
    this.list = undefined;
  }

  create(): void {
    setupCamera(this);
    drawGrass(this, 61);
    drawOutskirts(this, 62);
    const cx = WORLD.width / 2;

    this.add.image(cx - 190, 62, 'icon-trophy').setDisplaySize(60, 60);
    this.add.text(cx + 30, 62, 'Top Scores', textStyle(58, { weight: '700', strokeThickness: 10 })).setOrigin(0.5);

    // The Daily Challenge tab, then level tabs, then the Endless Pond, then Easy / Normal.
    const tabs = LEVELS.length + 2;
    const tabX = (i: number) => cx + (i - (tabs - 1) / 2) * 190;
    const dailyName = dailyFor(this.dailyDate)?.challenge.name ?? 'Daily';
    this.drawTab(tabX(0), 138, 178, `★ ${dailyName}`, () => this.board === 'daily', () => (this.board = 'daily'));
    LEVELS.forEach((info, i) => {
      this.drawTab(tabX(i + 1), 138, 178, `${i + 1}. ${info.name}`, () => this.board === 'level' && this.level === i, () => {
        this.board = 'level';
        this.level = i;
      });
    });
    this.drawTab(tabX(tabs - 1), 138, 178, '∞ Endless', () => this.board === 'endless', () => (this.board = 'endless'));
    (['easy', 'normal'] as const).forEach((difficulty, i) => {
      this.drawTab(cx + (i - 0.5) * 170, 192, 150, DIFFICULTIES[difficulty].label, () => this.difficulty === difficulty, () => (this.difficulty = difficulty));
    });

    drawBackButton(this, () => fadeToScene(this, this.back.scene, this.back.data));

    this.cameras.main.fadeIn(250, 0, 0, 0);
    void this.loadScores();
  }

  private drawTab(x: number, y: number, width: number, label: string, isOn: () => boolean, select: () => void): void {
    const g = this.add.graphics();
    const text = this.add.text(0, 0, label, textStyle(20, { strokeThickness: 0 })).setOrigin(0.5);
    const refresh = () => {
      const on = isOn();
      g.clear()
        .fillStyle(on ? COLORS.gold : COLORS.panel, on ? 1 : 0.6)
        .fillRoundedRect(-width / 2, -20, width, 40, 20)
        .lineStyle(3, on ? COLORS.ink : 0xffffff, on ? 1 : 0.3)
        .strokeRoundedRect(-width / 2, -20, width, 40, 20);
      text.setColor(on ? COLORS.inkCss : '#ffffff');
    };
    refresh();
    const hit = this.add.zone(0, 0, width, 44).setInteractive({ useHandCursor: true });
    this.add.container(x, y, [g, text, hit]);
    this.tabs.push({ refresh });
    hit.on('pointerdown', () => {
      if (isOn()) return;
      playSound(this, 'tap');
      select();
      this.highlightId = undefined;
      this.tabs.forEach((tab) => tab.refresh());
      void this.loadScores();
    });
  }

  private showList(content: Phaser.GameObjects.GameObject[]): void {
    this.list?.destroy();
    const card = drawCard(this.add.graphics(), LIST.width, LIST.height, { radius: 24, borderWidth: 4 });
    this.list = this.add.container(LIST.x, LIST.y, [card, ...content]);
  }

  private message(text: string): void {
    this.showList([this.add.text(0, 0, text, textStyle(28, { color: COLORS.inkCss, strokeThickness: 0 })).setOrigin(0.5)]);
  }

  private async loadScores(): Promise<void> {
    const id = ++this.requestId;
    this.message('Loading...');
    const board = this.board === 'daily' ? { daily: this.dailyDate } : this.board === 'endless' ? ({ endless: true } as const) : { level: this.level };
    const result = await fetchScores(board, this.difficulty);
    if (id !== this.requestId || !this.sys.isActive()) return; // a newer tab was picked, or we left
    if (!result.ok) {
      this.message(result.error);
      return;
    }
    if (result.data.length === 0) {
      this.message('No scores yet. Be the first!');
      return;
    }
    this.showList(result.data.flatMap((row, i) => this.drawRow(row, i)));
  }

  private drawRow(row: ScoreRow, index: number): Phaser.GameObjects.GameObject[] {
    const y = -LIST.height / 2 + 34 + index * LIST.rowHeight;
    const ink = { color: COLORS.inkCss, strokeThickness: 0 };
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (row.id === this.highlightId) {
      parts.push(this.add.rectangle(0, y, LIST.width - 30, LIST.rowHeight - 4, 0xffe9a0).setStrokeStyle(2, COLORS.gold));
    }
    const medal = MEDALS[index];
    if (medal !== undefined) parts.push(this.add.circle(-LIST.width / 2 + 46, y, 15, medal).setStrokeStyle(3, COLORS.ink));
    parts.push(this.add.text(-LIST.width / 2 + 46, y, String(index + 1), textStyle(18, { ...ink, weight: '700' })).setOrigin(0.5));
    // Names are shown as plain text (never as HTML), so nothing typed can do anything sneaky.
    parts.push(this.add.text(-LIST.width / 2 + 84, y, row.name, textStyle(24, { ...ink, weight: '700' })).setOrigin(0, 0.5));
    if (this.board === 'endless') {
      // Endless Pond scores are waves survived.
      parts.push(this.add.text(LIST.width / 2 - 36, y, `${row.score} ${row.score === 1 ? 'wave' : 'waves'}`, textStyle(24, { ...ink, weight: '700' })).setOrigin(1, 0.5));
      return parts;
    }
    parts.push(this.add.image(LIST.width / 2 - 170, y, 'icon-heart').setDisplaySize(20, 20));
    parts.push(this.add.text(LIST.width / 2 - 155, y, String(row.hearts), textStyle(20, ink)).setOrigin(0, 0.5));
    parts.push(this.add.text(LIST.width / 2 - 36, y, String(row.score), textStyle(24, { ...ink, weight: '700' })).setOrigin(1, 0.5));
    return parts;
  }
}
