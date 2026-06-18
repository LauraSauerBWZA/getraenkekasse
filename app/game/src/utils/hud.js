import { GAME, CSS, START_LIVES } from '../constants.js';

// mm:ss aus Millisekunden.
export function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Bildschirmfestes HUD (Spec §6/§7): Leben (Herzen), Live-Score, Höhe, Spielzeit.
// Alle Elemente mit scrollFactor 0 (folgen der Kamera nicht) und hoher Depth,
// damit sie über der Spielwelt liegen.
export class Hud {
  constructor(scene, { onMenu } = {}) {
    this.scene = scene;
    const pad = 12;

    // Menü-Button (ESC-Ersatz für Mobile, B_GAME.9) oben rechts.
    if (onMenu) {
      this.menuBtn = scene.add
        .text(GAME.width - pad, pad, '≡ Menü', {
          fontFamily: CSS.fontUi,
          fontSize: '13px',
          color: CSS.inkDim,
          backgroundColor: '#241a12',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(101)
        .setInteractive({ useHandCursor: true });
      this.menuBtn.on('pointerup', onMenu);
    }

    this.hearts = [];
    for (let i = 0; i < START_LIVES; i++) {
      const h = scene.add
        .image(pad + 9 + i * 22, pad + 9, 'heart')
        .setScrollFactor(0)
        .setDepth(100);
      this.hearts.push(h);
    }

    this.scoreText = scene.add
      .text(pad, pad + 24, 'Score 0', {
        fontFamily: CSS.fontUi,
        fontSize: '15px',
        color: CSS.amberGlow,
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.heightText = scene.add
      .text(GAME.width - pad, pad + 30, '▲ 0 m', {
        fontFamily: CSS.fontUi,
        fontSize: '15px',
        color: CSS.ink,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.timeText = scene.add
      .text(GAME.width - pad, pad + 52, '00:00', {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.inkDim,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // Sicherungs-Status (B_GAME4B.7): permanenter Indikator — grün „gesichert"
    // wenn in die zuletzt passierte Exe geclippt, sonst rot „ungesichert"
    // (= ein Treffer ist tödlich). Doppel-Codierung mit Aura + Seil in der Szene.
    this.securedLabel = scene.add
      .text(pad, pad + 50, '⚠ ungesichert', {
        fontFamily: CSS.fontUi,
        fontSize: '12px',
        color: CSS.rescue,
      })
      .setScrollFactor(0)
      .setDepth(100);
  }

  update({ lives, score, heightM, timeMs, secured = false }) {
    for (let i = 0; i < this.hearts.length; i++) {
      this.hearts[i].setAlpha(i < lives ? 1 : 0.2);
    }
    this.scoreText.setText(`Score ${score}`);
    this.heightText.setText(`▲ ${heightM} m`);
    this.timeText.setText(formatTime(timeMs));

    if (secured) this.securedLabel.setText('⚓ gesichert').setColor(CSS.success);
    else this.securedLabel.setText('⚠ ungesichert').setColor(CSS.rescue);
  }
}
