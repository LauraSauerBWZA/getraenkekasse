import Phaser from 'phaser';
import { CSS, COLORS, SCENES } from '../constants.js';
import { makeButton } from '../utils/ui.js';
import { createMuteButton } from '../utils/audio.js';
import { fetchLeaderboard } from '../utils/api.js';

// Startmenü: Titel, Emblem, Kurz-Erklärung, humorvoller Wochen-Spruch,
// Bestenlisten-Preview (Top 3), Link zur vollen Bestenliste, Start-Button.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.menu);
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    // Mute-Schalter (A.3) oben rechts, gut erreichbar.
    createMuteButton(this, width - 12, 12, { origin: 1 });

    this.add.image(cx, height * 0.13, 'emblem');

    this.add
      .text(cx, height * 0.25, 'BERGWACHT', {
        fontFamily: CSS.fontDisplay,
        fontSize: '34px',
        color: CSS.amberGlow,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, height * 0.25 + 34, 'ALPINIST', {
        fontFamily: CSS.fontDisplay,
        fontSize: '34px',
        color: CSS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height * 0.37, 'Erklimme den Windenhaken. Sammle Karabiner, weiche Steinen aus.', {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.inkDim,
        align: 'center',
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5);

    // Humorvoller Spruch — wird nach dem Laden der Bestenliste gefüllt.
    this.flavorText = this.add
      .text(cx, height * 0.45, '', {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.amber,
        align: 'center',
        lineSpacing: 4,
        wordWrap: { width: width - 50 },
      })
      .setOrigin(0.5);

    this.renderLeaderboardPreview(height * 0.54);

    makeButton(this, cx, height * 0.74, '🏆  Alle Highscores', () => this.scene.start(SCENES.highscore), {
      bg: '#241a12',
      fontSize: '14px',
    });

    makeButton(this, cx, height * 0.85, '▶  Level 1 spielen', () => this.scene.start(SCENES.level1));

    this.add
      .text(cx, height - 20, 'Phase B_GAME_ALPINIST · Platzhalter-Grafik', {
        fontFamily: CSS.fontUi,
        fontSize: '11px',
        color: CSS.inkMute,
      })
      .setOrigin(0.5);
  }

  // Top 3 der Woche + humorvoller Spruch. Lädt asynchron.
  renderLeaderboardPreview(yTop) {
    const { width } = this.scale;
    const cx = width / 2;

    this.add
      .text(cx, yTop, '🏆  DIESE WOCHE', { fontFamily: CSS.fontUi, fontSize: '12px', color: CSS.amber })
      .setOrigin(0.5);

    const status = this.add
      .text(cx, yTop + 26, 'lade …', { fontFamily: CSS.fontUi, fontSize: '12px', color: CSS.inkMute })
      .setOrigin(0.5);

    fetchLeaderboard('week')
      .then((board) => {
        status.destroy();
        this.setFlavor(board);
        if (!board.length) {
          this.add
            .text(cx, yTop + 26, 'Noch keine Läufe — sei die/der Erste! 🧗', {
              fontFamily: CSS.fontUi,
              fontSize: '12px',
              color: CSS.inkMute,
            })
            .setOrigin(0.5);
          return;
        }
        board.slice(0, 3).forEach((e, i) => {
          const rowY = yTop + 24 + i * 22;
          const color = e.rank === 1 ? CSS.amberGlow : CSS.ink;
          this.add
            .text(cx - 130, rowY, `${e.rank}. ${e.userName}`, {
              fontFamily: CSS.fontUi,
              fontSize: '13px',
              color,
            })
            .setOrigin(0, 0.5);
          this.add
            .text(cx + 130, rowY, `${e.score}`, { fontFamily: CSS.fontUi, fontSize: '13px', color })
            .setOrigin(1, 0.5);
        });
      })
      .catch(() => {
        status.setText('Bestenliste offline.').setColor(CSS.inkMute);
      });
  }

  // Humorvoller Ton (Spec §7): „der alte Platz 1 schuldet dem neuen ein Getränk".
  setFlavor(board) {
    if (!board.length) {
      this.flavorText.setText('Der Hubschrauber wartet. 🚁');
      return;
    }
    if (board.length === 1) {
      this.flavorText.setText(`🍺 Alpinist:in der Woche: ${board[0].userName}`);
      return;
    }
    this.flavorText.setText(
      `🍺 Spitze der Woche: ${board[0].userName}\n${board[1].userName} jagt — wer verliert, gibt ein Getränk aus!`,
    );
  }
}
