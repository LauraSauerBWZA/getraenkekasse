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

// Alpinist-Platzhalter (22x30) in mehreren Posen für die Animationen
// (idle/run_a/run_b/jump/fall). Beine, Arme und Helmstellung variieren je Pose;
// Körper/Gurt bleiben gleich. Alle Koordinaten ≥ 0 (generateTexture beschneidet
// negative Bereiche).
const PLAYER_W = 22;
const PLAYER_H = 30;

function playerTexture(scene, key, pose) {
  const w = PLAYER_W;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Beine (Pose-abhängig).
  g.fillStyle(0x3a2f24, 1);
  if (pose === 'run_a') {
    g.fillRect(3, 24, 5, 6);
    g.fillRect(13, 22, 5, 6);
  } else if (pose === 'run_b') {
    g.fillRect(4, 22, 5, 6);
    g.fillRect(14, 24, 5, 6);
  } else if (pose === 'jump') {
    g.fillRect(5, 23, 5, 6);
    g.fillRect(12, 23, 5, 6);
  } else if (pose === 'fall') {
    g.fillRect(1, 24, 5, 6);
    g.fillRect(16, 24, 5, 6);
  } else {
    g.fillRect(5, 24, 5, 6); // idle
    g.fillRect(12, 24, 5, 6);
  }

  // Arme (Pose-abhängig).
  g.fillStyle(COLORS.amber, 1);
  if (pose === 'jump') {
    g.fillRect(0, 4, 4, 8);
    g.fillRect(w - 4, 4, 4, 8);
  } else if (pose === 'fall') {
    g.fillRect(0, 13, 4, 7);
    g.fillRect(w - 4, 13, 4, 7);
  } else {
    g.fillRect(0, 9, 4, 9);
    g.fillRect(w - 4, 9, 4, 9);
  }

  // Körper/Jacke.
  g.fillStyle(COLORS.amberDeep, 1);
  g.fillRoundedRect(2, 8, w - 4, 17, 4);
  // Klettergurt.
  g.fillStyle(COLORS.ink, 1);
  g.fillRect(4, 16, w - 8, 2);
  // Helm.
  g.fillStyle(COLORS.amberGlow, 1);
  g.fillRoundedRect(3, 0, w - 6, 10, 4);

  g.generateTexture(key, w, PLAYER_H);
  g.destroy();
}

// Kleiner fallender Stein (16x16) — Treffer = Rückwurf.
function rockTexture(scene) {
  const s = 16;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x6b6258, 1);
  g.fillRoundedRect(0, 0, s, s, 4);
  g.fillStyle(0x4a4036, 1);
  g.fillRect(3, 4, 3, 3);
  g.fillRect(9, 8, 3, 3);
  g.fillRect(6, 11, 2, 2);
  g.lineStyle(1, 0x2a2420, 0.6);
  g.strokeRoundedRect(0, 0, s, s, 4);
  g.generateTexture('rock', s, s);
  g.destroy();
}

// Großer Felsbrocken (28x28) — dunkel, deutlich größer; Treffer kostet ein Leben.
function boulderTexture(scene) {
  const s = 28;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x39322b, 1);
  g.fillRoundedRect(0, 0, s, s, 7);
  g.fillStyle(0x241f19, 1);
  g.fillRect(5, 7, 5, 5);
  g.fillRect(16, 14, 6, 6);
  g.fillRect(9, 19, 4, 4);
  g.lineStyle(2, 0x14110d, 0.7);
  g.strokeRoundedRect(0, 0, s, s, 7);
  g.generateTexture('boulder', s, s);
  g.destroy();
}

// Collectibles (Spec §5/§8): Karabiner (gold), Seil (orange), Getränk (grün).
function carabinerTexture(scene) {
  const s = 16;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.lineStyle(3, COLORS.amberGlow, 1);
  g.strokeRoundedRect(3, 1, 8, 14, 4); // längliche Öse
  g.lineStyle(2, COLORS.amber, 1);
  g.beginPath();
  g.moveTo(11, 4);
  g.lineTo(14, 7); // Schnapper
  g.strokePath();
  g.generateTexture('carabiner', s, s);
  g.destroy();
}

function ropeTexture(scene) {
  const w = 12;
  const h = 16;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xd98a4a, 1); // orange
  for (let y = 0; y < h; y += 4) {
    g.fillRect(1, y, w - 2, 2); // gewickelte Lagen
  }
  g.lineStyle(1, 0x8a5a2a, 0.7);
  g.strokeRect(1, 0, w - 2, h);
  g.generateTexture('rope', w, h);
  g.destroy();
}

function drinkTexture(scene) {
  const s = 20;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.success, 1);
  g.fillRoundedRect(5, 4, 10, 14, 3); // Flaschen-/Becher-Körper
  g.fillRect(8, 0, 4, 5); // Hals
  g.fillStyle(0xffffff, 0.35);
  g.fillRect(7, 7, 2, 7); // Glanz
  g.generateTexture('drink', s, s);
  g.destroy();
}

// Durchgehende Felswand-Kachel (64x64, B_GAME2): Fels mit Greif-Optik —
// vertikales Seil + horizontales Felsband (Leiste) eingebacken, damit die
// gekachelte Wand „kletterbar" wirkt.
function wallTexture(scene) {
  const s = 64;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.rock, 1);
  g.fillRect(0, 0, s, s);
  // dunkle Sprenkel
  g.fillStyle(0x3a322a, 1);
  g.fillRect(40, 10, 6, 6);
  g.fillRect(8, 34, 5, 5);
  g.fillRect(50, 48, 6, 5);
  // Felsband / Leiste (Greifkante)
  g.fillStyle(0x6a5d4d, 1);
  g.fillRect(0, 46, s, 5);
  // hängendes Seil
  g.fillStyle(COLORS.inkDim, 1);
  g.fillRect(18, 0, 3, s);
  g.fillStyle(COLORS.amberDeep, 1);
  g.fillRect(17, 28, 5, 4); // Knoten
  // Kachelrahmen (dezent)
  g.lineStyle(1, 0x000000, 0.18);
  g.strokeRect(0, 0, s, s);
  g.generateTexture('wall', s, s);
  g.destroy();
}

// Überhang-Block (170x46, B_GAME2): ragt von einer Seite in die Wand, blockiert
// eine Spur — dunkler Fels, klar als Hindernis lesbar.
function overhangTexture(scene) {
  const w = 170;
  const h = 46;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x2a241d, 1);
  g.fillRoundedRect(0, 0, w, h, 8);
  g.fillStyle(COLORS.rock, 1);
  g.fillRect(0, 0, w, 6); // helle Oberkante
  g.lineStyle(1, 0x000000, 0.3);
  g.strokeRoundedRect(0, 0, w, h, 8);
  g.generateTexture('overhang', w, h);
  g.destroy();
}

// Hubschrauber (64x32) — Ziel-Deko oben, fliegt in der WinScene weg.
function helicopterTexture(scene) {
  const w = 64;
  const h = 32;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.amberDeep, 1);
  g.fillRoundedRect(8, 10, 36, 16, 6); // Kabine
  g.fillRect(40, 14, 22, 5); // Heckausleger
  g.fillStyle(0x3a2f24, 1);
  g.fillRect(4, 6, 52, 3); // Hauptrotor
  g.fillRect(30, 3, 3, 8); // Rotormast
  g.fillRect(58, 8, 3, 13); // Heckrotor
  g.fillStyle(COLORS.ice, 1);
  g.fillCircle(18, 18, 5); // Cockpit-Fenster
  g.generateTexture('helicopter', w, h);
  g.destroy();
}

// Windenhaken (20x32): Seil + J-Haken — der Ziel-Hotspot.
function windenhakenTexture(scene) {
  const w = 20;
  const h = 32;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.inkDim, 1);
  g.fillRect(9, 0, 2, 16); // Seil
  g.fillStyle(COLORS.ink, 1);
  g.fillRect(9, 14, 3, 12); // Haken vertikal
  g.fillRect(9, 23, 8, 3); // Haken unten
  g.fillRect(14, 19, 3, 6); // Haken-Spitze
  g.generateTexture('windenhaken', w, h);
  g.destroy();
}

// HUD-Herz (16x16) für die Lebensanzeige.
function heartTexture(scene) {
  const s = 16;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.rescue, 1);
  g.fillCircle(5, 5, 4);
  g.fillCircle(11, 5, 4);
  g.fillTriangle(1, 6, 15, 6, 8, 15);
  g.generateTexture('heart', s, s);
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

  // Alpinist-Posen für die Animationen (B_GAME.3).
  playerTexture(scene, 'player_idle', 'idle');
  playerTexture(scene, 'player_run_a', 'run_a');
  playerTexture(scene, 'player_run_b', 'run_b');
  playerTexture(scene, 'player_jump', 'jump');
  playerTexture(scene, 'player_fall', 'fall');

  // Felsbrocken (B_GAME2.4): kleiner Stein (Rückwurf) + großer Brocken (−1 Leben).
  rockTexture(scene);
  boulderTexture(scene);

  // Collectibles (B_GAME.5).
  carabinerTexture(scene);
  ropeTexture(scene);
  drinkTexture(scene);

  // HUD (B_GAME.6).
  heartTexture(scene);

  // Ziel (B_GAME.7): Hubschrauber + Windenhaken.
  helicopterTexture(scene);
  windenhakenTexture(scene);

  // Felswand + Überhänge (B_GAME2).
  wallTexture(scene);
  overhangTexture(scene);
}
