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

// 16x16-Plattform-Kachel mit hellerer Oberkante (Pixel-Anmutung).
function tileTexture(scene, key, base, top) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(base, 1);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(top, 1);
  g.fillRect(0, 0, 16, 3);
  g.lineStyle(1, 0x000000, 0.25);
  g.strokeRect(0, 0, 16, 16);
  g.generateTexture(key, 16, 16);
  g.destroy();
}

// Alpinist-Platzhalter (22x30): Körper, Gurt, Helm. Ein einzelner Frame; die
// Animations-Frames (idle/run/jump/fall) kommen in B_GAME.3.
function playerTexture(scene, key, bodyColor) {
  const w = 22;
  const h = 30;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(0, 6, w, h - 6, 4); // Körper/Jacke
  g.fillStyle(COLORS.ink, 1);
  g.fillRect(4, 14, w - 8, 3); // Klettergurt
  g.fillStyle(COLORS.amberGlow, 1);
  g.fillRoundedRect(2, 0, w - 4, 11, 4); // Helm
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

  // Plattform-Kacheln nach Material (Spec §8): Fels, Eis, Holz.
  tileTexture(scene, 'tile_rock', COLORS.rock, 0x6a5d4d);
  tileTexture(scene, 'tile_ice', COLORS.ice, 0xc8e4f2);
  tileTexture(scene, 'tile_wood', COLORS.wood, 0xb07a4e);

  // Alpinist-Platzhalter (Einzelframe).
  playerTexture(scene, 'player', COLORS.amberDeep);
}
