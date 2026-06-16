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
  constructor(scene) {
    this.scene = scene;
    const pad = 12;

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
      .text(GAME.width - pad, pad, '▲ 0 m', {
        fontFamily: CSS.fontUi,
        fontSize: '15px',
        color: CSS.ink,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.timeText = scene.add
      .text(GAME.width - pad, pad + 22, '00:00', {
        fontFamily: CSS.fontUi,
        fontSize: '13px',
        color: CSS.inkDim,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
  }

  update({ lives, score, heightM, timeMs }) {
    for (let i = 0; i < this.hearts.length; i++) {
      this.hearts[i].setAlpha(i < lives ? 1 : 0.2);
    }
    this.scoreText.setText(`Score ${score}`);
    this.heightText.setText(`▲ ${heightM} m`);
    this.timeText.setText(formatTime(timeMs));
  }
}
