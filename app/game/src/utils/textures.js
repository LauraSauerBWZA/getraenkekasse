import { COLORS } from '../constants.js';

// Platzhalter-Texturen prozedural erzeugen — keine PNG-Assets in dieser Phase.
// Echte Pixel-Art wird später als eigene Aufgabe ergänzt; sie ersetzt diese
// Texturen unter denselben Keys, der Rest des Codes bleibt unverändert.

// Zeichnet ein Rechteck (optional gerundet, optional Rahmen) und registriert es
// als Textur unter `key`.
function rectTexture(scene, key, w, h, fill, opts = {}) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(fill, 1);
  if (opts.radius) g.fillRoundedRect(0, 0, w, h, opts.radius);
  else g.fillRect(0, 0, w, h);
  if (opts.stroke !== undefined) {
    g.lineStyle(opts.strokeWidth || 2, opts.stroke, 1);
    if (opts.radius) g.strokeRoundedRect(1, 1, w - 2, h - 2, opts.radius);
    else g.strokeRect(1, 1, w - 2, h - 2);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

// Erzeugt alle (Platzhalter-)Texturen einmalig beim Boot.
export function buildTextures(scene) {
  // 1x1-Pixel — universell für Balken, Partikel, HUD-Flächen, Tinten.
  rectTexture(scene, 'px', 1, 1, 0xffffff);

  // Titel-Emblem (Menü-Platzhalter): amber-Kachel mit Glow-Rahmen.
  rectTexture(scene, 'emblem', 96, 96, COLORS.amberDeep, {
    radius: 22,
    stroke: COLORS.amberGlow,
    strokeWidth: 3,
  });
}
