import Phaser from 'phaser';
import { COLORS, CSS, SCENES } from '../constants.js';
import { formatTime } from '../utils/hud.js';
import { makeButton } from '../utils/ui.js';

// Game Over (Spec §7): kein Leben mehr ODER Timeout. Zeigt den Grund + den
// erreichten Score (KEIN Speichern — nur die WinScene speichert) und bietet
// Neustart / Menü.
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super(SCENES.gameover);
  }

  init(data) {
    this.stats = {
      reason: 'lives',
      score: 0,
      heightM: 0,
      timeMs: 0,
      collectiblesFound: 0,
      enemiesDefeated: 0,
      ...data,
    };
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(cx, height * 0.22, 'GAME OVER', {
        fontFamily: CSS.fontDisplay,
        fontSize: '36px',
        color: CSS.rescue,
      })
      .setOrigin(0.5);

    const reasonText =
      this.stats.reason === 'timeout'
        ? 'Die Zeit ist um — der Hubschrauber musste abdrehen.'
        : 'Keine Leben mehr — der Aufstieg endet hier.';
    this.add
      .text(cx, height * 0.32, reasonText, {
        fontFamily: CSS.fontUi,
        fontSize: '14px',
        color: CSS.inkDim,
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height * 0.46, `${this.stats.score}`, {
        fontFamily: CSS.fontDisplay,
        fontSize: '48px',
        color: CSS.ink,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, height * 0.46 + 32, 'PUNKTE (nicht gewertet)', {
        fontFamily: CSS.fontUi,
        fontSize: '11px',
        color: CSS.inkMute,
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        height * 0.58,
        `Höhe ${this.stats.heightM} m · Zeit ${formatTime(this.stats.timeMs)} · ${this.stats.collectiblesFound} gesammelt`,
        { fontFamily: CSS.fontUi, fontSize: '12px', color: CSS.inkDim },
      )
      .setOrigin(0.5);

    makeButton(this, cx, height * 0.72, '▶  Erneut versuchen', () =>
      this.scene.start(SCENES.level1),
    );
    makeButton(this, cx, height * 0.72 + 54, 'Zurück zum Menü', () => this.scene.start(SCENES.menu), {
      bg: '#241a12',
    });
  }
}
