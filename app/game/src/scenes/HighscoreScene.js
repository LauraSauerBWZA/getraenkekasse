import Phaser from 'phaser';
import { COLORS, CSS, SCENES } from '../constants.js';
import { formatTime } from '../utils/hud.js';
import { makeButton } from '../utils/ui.js';
import { fetchLeaderboard } from '../utils/api.js';

// Vollständige Bestenliste (Spec §7: „Highscores anschauen"). Umschaltbar nach
// Zeitraum (Woche/Monat/Gesamt). Bei ≤ 20 Einträgen passt alles auf den Screen.
const FRAMES = [
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'all', label: 'Gesamt' },
];

export class HighscoreScene extends Phaser.Scene {
  constructor() {
    super(SCENES.highscore);
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(cx, 44, 'BESTENLISTE', {
        fontFamily: CSS.fontDisplay,
        fontSize: '28px',
        color: CSS.amberGlow,
      })
      .setOrigin(0.5);

    // Zeitraum-Umschalter.
    this.timeframe = 'week';
    this.tabs = [];
    FRAMES.forEach((f, i) => {
      const tab = this.add
        .text(cx + (i - 1) * 90, 86, f.label, {
          fontFamily: CSS.fontUi,
          fontSize: '14px',
          color: CSS.inkDim,
          backgroundColor: '#241a12',
          padding: { x: 14, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      tab.frameKey = f.key;
      tab.on('pointerup', () => this.select(f.key));
      this.tabs.push(tab);
    });

    // Container für die Zeilen (wird bei jedem Wechsel neu befüllt).
    this.rows = this.add.container(0, 0);

    makeButton(this, cx, height - 48, 'Zurück zum Menü', () => this.scene.start(SCENES.menu), {
      bg: '#241a12',
    });

    this.select('week');
  }

  select(timeframe) {
    this.timeframe = timeframe;
    this.tabs.forEach((t) => t.setColor(t.frameKey === timeframe ? CSS.amberGlow : CSS.inkDim));
    this.render();
  }

  async render() {
    const { width } = this.scale;
    const cx = width / 2;
    this.rows.removeAll(true);

    const loading = this.add.text(cx, 140, 'lade …', {
      fontFamily: CSS.fontUi,
      fontSize: '13px',
      color: CSS.inkMute,
    });
    loading.setOrigin(0.5);
    this.rows.add(loading);

    let board;
    try {
      board = await fetchLeaderboard(this.timeframe);
    } catch {
      loading.setText('Bestenliste konnte nicht geladen werden.');
      return;
    }
    // Szene evtl. schon gewechselt → nicht mehr rendern.
    if (!this.scene.isActive(SCENES.highscore)) return;
    this.rows.removeAll(true);

    if (!board.length) {
      const empty = this.add
        .text(cx, 160, 'Noch keine Läufe in diesem Zeitraum.', {
          fontFamily: CSS.fontUi,
          fontSize: '13px',
          color: CSS.inkMute,
        })
        .setOrigin(0.5);
      this.rows.add(empty);
      return;
    }

    let y = 124;
    for (const e of board) {
      const color = e.isCurrentUser ? CSS.amberGlow : e.rank === 1 ? CSS.amber : CSS.ink;
      const rank = this.add
        .text(cx - 150, y, `${e.rank}.`, { fontFamily: CSS.fontUi, fontSize: '14px', color })
        .setOrigin(0, 0.5);
      const name = this.add
        .text(cx - 120, y, e.userName, { fontFamily: CSS.fontUi, fontSize: '14px', color })
        .setOrigin(0, 0.5);
      const time = this.add
        .text(cx + 60, y, formatTime(e.timeMs), {
          fontFamily: CSS.fontUi,
          fontSize: '11px',
          color: CSS.inkMute,
        })
        .setOrigin(1, 0.5);
      const score = this.add
        .text(cx + 150, y, `${e.score}`, { fontFamily: CSS.fontUi, fontSize: '14px', color })
        .setOrigin(1, 0.5);
      this.rows.add([rank, name, time, score]);
      y += 28;
    }
  }
}
