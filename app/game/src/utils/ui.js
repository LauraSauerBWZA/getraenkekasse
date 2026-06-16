import { CSS } from '../constants.js';

// Einfacher Text-Button mit Hover-Feedback. Wird von Win-/GameOver-/MenuScene
// genutzt. Gibt das Text-Objekt zurück (für weitere Anpassungen).
export function makeButton(scene, x, y, label, onClick, opts = {}) {
  const baseColor = opts.color || CSS.ink;
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: CSS.fontUi,
      fontSize: opts.fontSize || '16px',
      color: baseColor,
      backgroundColor: opts.bg || CSS.amberDeep,
      padding: { x: opts.px ?? 20, y: opts.py ?? 11 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });

  btn.on('pointerover', () => btn.setColor(CSS.amberGlow));
  btn.on('pointerout', () => btn.setColor(baseColor));
  btn.on('pointerup', onClick);
  return btn;
}
