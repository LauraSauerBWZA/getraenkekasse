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

// Gegnerischer Bergsteiger (24x24), zwei Lauf-Frames (rescue-rot = feindlich).
function enemyTexture(scene, key, step) {
  const s = 24;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x5a2420, 1); // Beine
  if (step === 0) {
    g.fillRect(4, 19, 5, 5);
    g.fillRect(15, 17, 5, 5);
  } else {
    g.fillRect(5, 17, 5, 5);
    g.fillRect(14, 19, 5, 5);
  }
  g.fillStyle(COLORS.rescue, 1); // Körper
  g.fillRoundedRect(3, 6, s - 6, 14, 3);
  g.fillStyle(0x3a2f24, 1); // dunkler Helm
  g.fillRoundedRect(5, 0, s - 10, 8, 3);
  g.fillStyle(0xffffff, 1); // Augen
  g.fillRect(8, 3, 2, 2);
  g.fillRect(14, 3, 2, 2);
  g.generateTexture(key, s, s);
  g.destroy();
}

// Fallender Stein (16x16).
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

  // Gegner (B_GAME.4): Bergsteiger (2 Frames) + fallender Stein.
  enemyTexture(scene, 'enemy_walk_a', 0);
  enemyTexture(scene, 'enemy_walk_b', 1);
  rockTexture(scene);

  // Collectibles (B_GAME.5).
  carabinerTexture(scene);
  ropeTexture(scene);
  drinkTexture(scene);

  // HUD (B_GAME.6).
  heartTexture(scene);
}
