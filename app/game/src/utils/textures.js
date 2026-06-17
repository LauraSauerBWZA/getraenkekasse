import { COLORS } from '../constants.js';

// Prozedurale Pixel-Art im Game-Boy-Color-Stil (Phase B_GAME3_PIXELART).
// Alles in Code gezeichnet (kein PNG). Sprites werden in niedriger Auflösung als
// Zeichen-Grid „gedacht" und über `drawPixels` mit einer zentralen Palette zu
// Texturen gebacken; ein Scale-Faktor trifft exakt die bestehenden Textur-Maße
// (Hitboxen/Positionen bleiben unangetastet, Spec §3).

// Zentrale GBC-Palette: kräftig, begrenzt, klare dunkle Outline. Zeichen → Farbe;
// '.' = transparent. Mehrfach genutzte Töne halten die Sprites farblich stimmig.
const PALETTE = {
  '.': null, // transparent
  o: 0x241826, // Outline (fast schwarz, violettstichig)
  // Alpinist
  r: 0xe2403a, // Jacke rot
  R: 0x9e2730, // Jacke rot dunkel (Schatten)
  b: 0x3f74e0, // Hose blau
  B: 0x274a9e, // Hose blau dunkel
  k: 0xf3c393, // Haut
  K: 0xcf9460, // Haut Schatten
  y: 0xf7d24a, // Helm gelb
  Y: 0xd29a26, // Helm gelb dunkel
  p: 0x6b7280, // Rucksack grau
  P: 0x444a59, // Rucksack dunkel
  w: 0xf4f0e9, // weiß
  // Brocken
  l: 0xc2bbae, // heller Stein
  L: 0x938b7c, // heller Stein Schatten
  e: 0x6b6358, // heller Stein Outline-Ersatz
  d: 0x4c4658, // großer Brocken
  D: 0x2c2738, // großer Brocken Schatten
  c: 0x12101a, // Riss
  // Collectibles
  s: 0xcdd2dc, // Silber hell
  S: 0x8a90a0, // Silber dunkel
  n: 0xe09a3c, // Seil orange
  N: 0xa96a22, // Seil orange dunkel
  g: 0x57c07a, // Getränk grün
  G: 0x2e7d4f, // Getränk grün dunkel
  f: 0xfff4d6, // Schaum/Glanz hell
  // Gold/Glanz (Emblem, Ziel, Akzente)
  a: 0xf7d24a, // gold
  q: 0xfff1a8, // gold hell / Funkeln
  // Heli
  h: 0xeceff4, // weiß-grau (Heli-Body)
  H: 0xb6bcc8, // grau Schatten
};

// Backt ein Zeichen-Grid (Array gleicher-Länge-Strings) mit `scale` zu einer
// Textur. Jede Zelle = scale×scale Pixel. Texturmaß = cols*scale × rows*scale.
function drawPixels(scene, key, grid, scale = 2, palette = PALETTE) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const rows = grid.length;
  const cols = grid[0].length;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const col = palette[grid[y][x]];
      if (col === undefined || col === null) continue;
      g.fillStyle(col, 1);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  g.generateTexture(key, cols * scale, rows * scale);
  g.destroy();
}

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

// Alpinist (22x30 = 11x15-Grid ×2): freundlicher Bergwacht-Kletterer, gelber
// Helm, rote Jacke, blaue Hose, weißes Brust-Emblem mit rotem Kreuz (stilisiert,
// kein DRK-1:1). Posen idle/run_a/run_b (Boot-Wechsel = Kletter-Wiggle),
// jump (Arme hoch, Beine zusammen), fall (Arme/Beine ausgebreitet).
const ALPINIST_HEAD = [
  '...oooo....',
  '..oyyyyo...',
  '..oyYYyo...',
  '..oooooo...',
  '...okko....',
  '..orrrro...',
  '.orrrrrro..',
  '.orwwwwro..',
  '.orwxxwro..',
  '.orwwwwro..',
  '.orrrrrro..',
  '..oRRRRo...',
  '..obbbbo...',
  '..obbbbo...',
];

const ALPINIST_JUMP = [
  '.k.oooo.k..',
  '.royyyyor..',
  '.royYYyor..',
  '.roooooor..',
  '..rokkor...',
  '..orrrro...',
  '.orrrrrro..',
  '.orwwwwro..',
  '.orwxxwro..',
  '.orwwwwro..',
  '.orrrrrro..',
  '..oRRRRo...',
  '..obbbbo...',
  '..obbbbo...',
  '..oooooo...',
];

const ALPINIST_FALL = [
  '...oooo....',
  '..oyyyyo...',
  '..oyYYyo...',
  '..oooooo...',
  '...okko....',
  'k.orrrro.k.',
  '.rorrrror..',
  '.orwwwwro..',
  '.orwxxwro..',
  '.orwwwwro..',
  '.orrrrrro..',
  '..oRRRRo...',
  '..obbbbo...',
  '.obb..bbo..',
  '.oo....oo..',
];

function alpinistGrid(pose) {
  if (pose === 'jump') return ALPINIST_JUMP;
  if (pose === 'fall') return ALPINIST_FALL;
  let boots = '..oo..oo...'; // idle
  if (pose === 'run_a') boots = '.ooo..o....';
  else if (pose === 'run_b') boots = '....o..ooo.';
  return [...ALPINIST_HEAD, boots];
}

function playerTexture(scene, key, pose) {
  drawPixels(scene, key, alpinistGrid(pose), 2);
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

// Durchgehende Felswand-Kachel (256x256, NACHSCHLAG.2): grobe, natürliche
// Felsstruktur ohne Gitter/Rahmen, ohne Seil/Griffzonen — die ganze Wandbreite
// ist frei befahrbar. Große Kachel + unregelmäßige Sprenkel/Risse lassen die
// Wiederholung beim Kacheln kaum auffallen (Platzhalter; echte Pixel-Art folgt).
function wallTexture(scene) {
  const s = 256;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.rock, 1);
  g.fillRect(0, 0, s, s);

  // dunklere Felsflecken (verschiedene Größen)
  g.fillStyle(0x3a322a, 1);
  for (let i = 0; i < 90; i++) {
    const w = 6 + Math.random() * 22;
    const h = 6 + Math.random() * 22;
    g.fillRect(Math.random() * s, Math.random() * s, w, h);
  }
  // hellere Aufhellungen
  g.fillStyle(0x554a3d, 1);
  for (let i = 0; i < 55; i++) {
    const w = 4 + Math.random() * 16;
    const h = 4 + Math.random() * 16;
    g.fillRect(Math.random() * s, Math.random() * s, w, h);
  }
  // feine Risse
  g.fillStyle(0x241f19, 1);
  for (let i = 0; i < 14; i++) {
    g.fillRect(Math.random() * s, Math.random() * s, 2, 18 + Math.random() * 40);
  }

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

// HUD-Herz (16x16) — GBC-Pixel-Art (8x8-Grid ×2). Proof für den drawPixels-Helper.
const HEART_GRID = [
  '.oo..oo.',
  'orrrrrro',
  'orfrrrro',
  'orrrrrro',
  '.orrrro.',
  '..orro..',
  '...oo...',
  '........',
];
function heartTexture(scene) {
  drawPixels(scene, 'heart', HEART_GRID, 2);
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
