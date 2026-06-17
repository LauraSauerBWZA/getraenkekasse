import Phaser from 'phaser';
import { CSS, COLORS, SCENES } from '../constants.js';
import { makeButton } from '../utils/ui.js';
import { fetchLeaderboard } from '../utils/api.js';

// Startmenü: Titel, Emblem, Kurz-Erklärung, Wochen-Bestenlisten-Preview und
// Start-Button. Der humorvolle Text + die vollständige Highscore-Ansicht +
// GameOverScene-Verzahnung folgen in B_GAME.10.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.menu);
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add.image(width / 2, height * 0.16, 'emblem');

    this.add
      .text(width / 2, height * 0.3, 'BERGWACHT', {
        fontFamily: CSS.fontDisplay,
        fontSize: '34px',
        color: CSS.amberGlow,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.3 + 36, 'ALPINIST', {
        fontFamily: CSS.fontDisplay,
        fontSize: '34px',
        color: CSS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.44,
        'Erklimme den Windenhaken des Hubschraubers.\nKarabiner sammeln, Steinen ausweichen.',
        {
          fontFamily: CSS.fontUi,
          fontSize: '13px',
          color: CSS.inkDim,
          align: 'center',
          lineSpacing: 5,
        },
      )
      .setOrigin(0.5);

    this.renderLeaderboardPreview(height * 0.54);

    makeButton(this, width / 2, height * 0.86, '▶  Level 1 spielen', () =>
      this.scene.start(SCENES.level1),
    );

    this.add
      .text(width / 2, height - 22, 'Phase B_GAME_ALPINIST · Platzhalter-Grafik', {
        fontFamily: CSS.fontUi,
        fontSize: '11px',
        color: CSS.inkMute,
      })
      .setOrigin(0.5);
  }

  // Top der Woche (max 5). Lädt asynchron; bis dahin steht „lade …".
  renderLeaderboardPreview(yTop) {
    const { width } = this.scale;
    const cx = width / 2;

    this.add
      .text(cx, yTop, '🏆  BESTENLISTE · DIESE WOCHE', {
        fontFamily: CSS.fontUi,
        fontSize: '12px',
        color: CSS.amber,
      })
      .setOrigin(0.5);

    const status = this.add
      .text(cx, yTop + 28, 'lade …', { fontFamily: CSS.fontUi, fontSize: '12px', color: CSS.inkMute })
      .setOrigin(0.5);

    fetchLeaderboard('week')
      .then((board) => {
        status.destroy();
        if (!board.length) {
          this.add
            .text(cx, yTop + 28, 'Noch keine Läufe — sei die/der Erste! 🧗', {
              fontFamily: CSS.fontUi,
              fontSize: '12px',
              color: CSS.inkMute,
            })
            .setOrigin(0.5);
          return;
        }
        board.slice(0, 5).forEach((e, i) => {
          const rowY = yTop + 26 + i * 22;
          const color = e.rank === 1 ? CSS.amberGlow : CSS.ink;
          this.add
            .text(cx - 130, rowY, `${e.rank}. ${e.userName}`, {
              fontFamily: CSS.fontUi,
              fontSize: '13px',
              color,
            })
            .setOrigin(0, 0.5);
          this.add
            .text(cx + 130, rowY, `${e.score}`, {
              fontFamily: CSS.fontUi,
              fontSize: '13px',
              color,
            })
            .setOrigin(1, 0.5);
        });
      })
      .catch(() => {
        status.setText('Bestenliste offline.').setColor(CSS.inkMute);
      });
  }
}
