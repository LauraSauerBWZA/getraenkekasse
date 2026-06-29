import Phaser from 'phaser';
import { CSS, COLORS, SCENES } from '../constants.js';
import { makeButton } from '../utils/ui.js';
import { createMuteButton, getGameAudio } from '../utils/audio.js';
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

    // Ruhigere Menü-Melodie (B_GAME6.3). Beim allerersten Besuch ist Web-Audio
    // evtl. noch nicht entsperrt (Autoplay) → erst nach dem Unlock starten,
    // Listener bei Szenenwechsel sauber entfernen.
    this.audio = getGameAudio(this);
    this.startMenuMusic();
    this.events.once('shutdown', () => this.audio.stopMusic());

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

    makeButton(this, cx, height * 0.67, 'ℹ️  So spielst du', () => this.openInstructions(), {
      bg: '#241a12',
      fontSize: '14px',
    });

    makeButton(this, cx, height * 0.755, '🏆  Alle Highscores', () => this.scene.start(SCENES.highscore), {
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

  // Menü-Musik starten — sobald Web-Audio entsperrt ist. Verlässt der Spieler
  // das Menü vor dem Unlock, wird der Listener wieder entfernt (kein Start nach
  // Szenenwechsel).
  startMenuMusic() {
    const sm = this.sound;
    if (sm && sm.locked) {
      const onUnlock = () => this.audio.startMusic('menu');
      sm.once('unlocked', onUnlock);
      this.events.once('shutdown', () => sm.off('unlocked', onUnlock));
    } else {
      this.audio.startMusic('menu');
    }
  }

  // Bedienungs-Anleitung (B_GAME6.6, C.1): kompaktes Overlay-Panel. Erkennt
  // Touch vs. Desktop und zeigt die passende Steuerungs-Variante; Spielziel +
  // Sicherungs-Regel gelten für beide. Wird einmal gebaut und ein-/ausgeblendet.
  openInstructions() {
    if (this.instr) {
      this.instr.setVisible(true);
      return;
    }
    const { width, height } = this.scale;
    const cx = width / 2;
    const isTouch = this.sys.game.device.input.touch;
    const c = this.add.container(0, 0).setDepth(200).setScrollFactor(0);

    const shade = this.add
      .rectangle(cx, height / 2, width, height, 0x0c0a08, 0.86)
      .setInteractive(); // absorbiert Klicks hinter dem Panel
    const panelH = 430;
    const panelW = width - 36;
    const panel = this.add
      .rectangle(cx, height / 2, panelW, panelH, 0x241a12, 0.98)
      .setStrokeStyle(2, 0xe3a857, 0.9);
    const left = cx - panelW / 2 + 20;
    let y = height / 2 - panelH / 2 + 22;

    const title = this.add
      .text(cx, y, 'So spielst du', { fontFamily: CSS.fontDisplay, fontSize: '22px', color: CSS.amberGlow })
      .setOrigin(0.5);
    c.add([shade, panel, title]);
    y += 40;

    const head = (text) => {
      const t = this.add.text(left, y, text, { fontFamily: CSS.fontUi, fontSize: '14px', color: CSS.amber });
      c.add(t);
      y += 24;
    };
    const line = (text) => {
      const t = this.add.text(left + 8, y, text, {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.inkDim,
        wordWrap: { width: panelW - 56 },
      });
      c.add(t);
      y += t.height + 8;
    };
    const iconLine = (key, text) => {
      const img = this.add.image(left + 10, y + 8, key).setScale(0.85);
      const t = this.add.text(left + 28, y, text, {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.inkDim,
        wordWrap: { width: panelW - 76 },
      });
      c.add([img, t]);
      y += Math.max(t.height, 22) + 8;
    };

    head(isTouch ? '📱 Steuerung (Handy)' : '⌨️ Steuerung (Tastatur)');
    if (isTouch) {
      line('Joystick unten halten & ziehen — bewegen (weiter ziehen = schneller)');
      line('Tippen — springen');
      line('Button unten links — an Exe einklippen (sichern)');
    } else {
      line('Pfeiltasten — bewegen');
      line('Leertaste — springen');
      line('Taste E — an Exe einklippen (sichern)');
    }
    y += 6;
    head('Ziel & Regeln');
    iconLine('windenhaken', 'Den Windenhaken ganz oben greifen 🚁');
    iconLine('exe', 'Exen einklippen sichert dich — ungesichert + Treffer = Game Over');
    iconLine('drink', 'Items sammeln = Punkte');

    const close = makeButton(this, cx, height / 2 + panelH / 2 - 28, 'Verstanden', () =>
      this.instr.setVisible(false),
    );
    c.add(close);

    this.instr = c;
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
