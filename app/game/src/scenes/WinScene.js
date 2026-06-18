import Phaser from 'phaser';
import { COLORS, CSS, SCENES } from '../constants.js';
import { formatTime } from '../utils/hud.js';
import { makeButton } from '../utils/ui.js';
import { postScore, fetchLeaderboard } from '../utils/api.js';

// Level geschafft (Spec §7): Abflug-Animation (Haken + Alpinist werden zur
// Kabine gezogen, Hubschrauber fliegt weg), danach Score-Summary + Buttons.
// Die Score-Speicherung (API) und die Bestenlisten-Platzierung kommen in
// B_GAME.8 — hier wird `this.stats` bereits vollständig übergeben.
export class WinScene extends Phaser.Scene {
  constructor() {
    super(SCENES.win);
  }

  init(data) {
    this.stats = {
      level: 1,
      score: 0,
      heightM: 0,
      timeMs: 0,
      collectiblesFound: 0,
      enemiesDefeated: 0,
      livesLost: 0,
      ...data,
    };
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(width / 2, height * 0.1, 'ABGEFLOGEN! 🚁', {
        fontFamily: CSS.fontDisplay,
        fontSize: '30px',
        color: CSS.amberGlow,
      })
      .setOrigin(0.5);

    this.playFlyAway(width, height);
  }

  // Haken + Alpinist hoch zur Kabine, dann Hubschrauber raus aus dem Bild.
  playFlyAway(width, height) {
    const baseY = height * 0.34;
    const heli = this.add.sprite(width / 2, baseY, 'helicopter').setScale(1.4).play('heli_rotor');
    const hook = this.add.image(width / 2, baseY + 56, 'windenhaken').setScale(1.2);
    const climber = this.add.image(width / 2, baseY + 92, 'player_idle');

    this.tweens.add({ targets: [hook, climber], y: '-=42', duration: 1400, ease: 'Sine.in' });
    this.tweens.add({
      targets: [heli, hook, climber],
      x: width + 180,
      y: -120,
      scale: 0.5,
      alpha: 0.4,
      delay: 1500,
      duration: 1700,
      ease: 'Sine.in',
      onComplete: () => this.showSummary(width, height),
    });
  }

  showSummary(width, height) {
    const s = this.stats;
    const cx = width / 2;
    let y = height * 0.28;

    this.add
      .text(cx, y, 'Bericht der Bergung', {
        fontFamily: CSS.fontDisplay,
        fontSize: '20px',
        color: CSS.amber,
      })
      .setOrigin(0.5);
    y += 40;

    const rows = [
      ['Gesammelt', `${s.collectiblesFound}`],
      ['Höhe', `${s.heightM} m`],
      ['Zeit', formatTime(s.timeMs)],
      ['Leben verloren', `${s.livesLost}`],
    ];
    for (const [k, v] of rows) {
      this.add
        .text(cx - 120, y, k, { fontFamily: CSS.fontUi, fontSize: '14px', color: CSS.inkDim })
        .setOrigin(0, 0.5);
      this.add
        .text(cx + 120, y, v, { fontFamily: CSS.fontUi, fontSize: '14px', color: CSS.ink })
        .setOrigin(1, 0.5);
      y += 26;
    }

    y += 18;
    this.add
      .text(cx, y, `${s.score}`, {
        fontFamily: CSS.fontDisplay,
        fontSize: '48px',
        color: CSS.amberGlow,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, y + 32, 'PUNKTE', {
        fontFamily: CSS.fontUi,
        fontSize: '11px',
        color: CSS.inkDim,
      })
      .setOrigin(0.5);

    // Status der Score-Speicherung + Bestenlisten-Platzierung (B_GAME.8).
    y += 58;
    this.statusText = this.add
      .text(cx, y, 'Speichere Score …', {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.inkDim,
      })
      .setOrigin(0.5);

    y += 36;
    makeButton(this, cx, y, '▶  Nochmal', () => this.scene.start(SCENES.level1));
    makeButton(this, cx, y + 54, 'Zurück zum Menü', () => this.scene.start(SCENES.menu), {
      bg: '#241a12',
    });

    this.saveAndRank();
  }

  // Score speichern und die Wochen-Platzierung anzeigen (Spec §7). Fehler (z.B.
  // Backend offline) sind nicht spielkritisch — dann nur ein dezenter Hinweis.
  async saveAndRank() {
    try {
      const saved = await postScore(this.stats);
      const board = await fetchLeaderboard('week');
      const mine = board.find((e) => e.userId === saved.userId);
      if (mine && mine.rank === 1) {
        this.statusText.setText('🥇 Neuer Spitzenreiter dieser Woche!').setColor(CSS.amberGlow);
      } else if (mine) {
        this.statusText.setText(`🏆 Du bist jetzt Platz ${mine.rank} diese Woche!`).setColor(CSS.amberGlow);
      } else {
        this.statusText.setText('Score gespeichert.').setColor(CSS.success);
      }
    } catch {
      this.statusText.setText('Score nicht gespeichert (Backend offline?).').setColor(CSS.rescue);
    }
  }
}
