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
  t: 0x5a4a2e, // Klettergurt (Gurtband, braun-oliv — B_GAME5.2)
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

// Alpinist (22x32 = 11x16-Grid ×2, B_GAME5.2): freundlicher Bergwacht-Kletterer,
// gelber Helm, rote Jacke, blaue Hose, weißes Brust-Emblem, Klettergurt (t) mit
// kurzem Seil-Loop (n). Alle Posen gleich hoch (16 Reihen) → kein Origin-Bobbing
// beim Frame-Wechsel. Kletter-Zyklus (climb_a/climb_b) bewegt Arme UND Beine
// kontralateral (links-Arm-hoch ↔ rechts-Bein-hoch und gespiegelt) → lebendig,
// aber lesbare Silhouette. Emblem-Zentrum 'x' = transparent (dunkles Kreuz).

// Stand: Arme am Körper, Beine leicht gegrätscht.
const ALPINIST_IDLE = [
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
  '.ottattto..',
  '..oRnnRo...',
  '..obbbbo...',
  '..obbbbo...',
  '..oboobo...',
  '..oo..oo...',
];

// Kletter-Frame A: linker Arm greift hoch, rechte Hand tief; rechtes Bein
// angewinkelt hoch, linkes Bein gestreckt nach unten.
const ALPINIST_CLIMB_A = [
  '...oooo....',
  '..oyyyyo...',
  '..oyYYyo...',
  '..oooooo...',
  '...okko....',
  '.k.orrrro..',
  '.rorrrrro..',
  '.orwwwwro..',
  '.orwxxwroR.',
  '.orwwwwroR.',
  '.ottattoRk.',
  '..oRnnRo...',
  '..obbbbo...',
  '..obbbo....',
  '.oboo.bo...',
  'oo....bo...',
];

// Kletter-Frame B = A horizontal gespiegelt (rechter Arm hoch, linkes Bein hoch).
const ALPINIST_CLIMB_B = [
  '...oooo....',
  '..oyyyyo...',
  '..oyYYyo...',
  '..oooooo...',
  '...okko....',
  '..orrrro.k.',
  '..orrrrror.',
  '.orwwwwro..',
  '.Rorwxxwro.',
  '.Rorwwwwro.',
  '.kRottatto.',
  '...oRnnRo..',
  '...obbbbo..',
  '....obbbo..',
  '...ob.oobo.',
  '...ob....oo',
];

// Sprung: beide Arme hoch (Greifen nach oben), Beine zusammen.
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
  '.ottattto..',
  '..oRnnRo...',
  '..obbbbo...',
  '..obbbbo...',
  '..obbbbo...',
  '..oooooo...',
];

// Fall: Arme + Beine ausgebreitet (Stabilisieren).
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
  '.ottattto..',
  '..oRnnRo...',
  '.obb..bbo..',
  '.obo..obo..',
  '.oo....oo..',
  '.o......o..',
];

function alpinistGrid(pose) {
  if (pose === 'jump') return ALPINIST_JUMP;
  if (pose === 'fall') return ALPINIST_FALL;
  if (pose === 'run_a') return ALPINIST_CLIMB_A;
  if (pose === 'run_b') return ALPINIST_CLIMB_B;
  return ALPINIST_IDLE;
}

function playerTexture(scene, key, pose) {
  drawPixels(scene, key, alpinistGrid(pose), 2);
}

// Kleiner Stein (16x16 = 8x8-Grid ×2): hell, rundlich, freundlich — signalisiert
// „nur Rückwurf". Heller Grauton mit Glanz, helle Outline.
const ROCK_GRID = [
  '..eeee..',
  '.elllle.',
  'elflllle',
  'elllllLe',
  'elLllLLe',
  '.eLLLLe.',
  '..eeee..',
  '........',
];
function rockTexture(scene) {
  drawPixels(scene, 'rock', ROCK_GRID, 2);
}

// Großer Brocken (28x28 = 14x14-Grid ×2): dunkel, kantig, mit Rissen — wirkt
// bedrohlich, signalisiert „−1 Leben". Klar von dem kleinen Stein unterscheidbar.
const BOULDER_GRID = [
  '...oooooo.....',
  '..odddddoo....',
  '.oddddddddo...',
  'oddddddddddo..',
  'oddccdddddDo..',
  'oddcddddcdDo..',
  'odddddccddDo..',
  'oddddddcddDo..',
  'oddDddddddDo..',
  '.oDddDdddDo...',
  '.oDDdddDDDo...',
  '..oDDDDDDo....',
  '...oooooo.....',
  '..............',
];
function boulderTexture(scene) {
  drawPixels(scene, 'boulder', BOULDER_GRID, 2);
}

// Karabiner (16x16 = 8x8 ×2): silberner Ring mit Loch, Glanz oben-links,
// goldenes Gate rechts — metallisch + wertvoll.
const CARABINER_GRID = [
  '..ssss..',
  '.sf..Ss.',
  'ss....ss',
  's......s',
  'ss....sa',
  '.s....Sa',
  '.sS..Ss.',
  '..ssss..',
];
function carabinerTexture(scene) {
  drawPixels(scene, 'carabiner', CARABINER_GRID, 2);
}

// Seil (12x16 = 6x8 ×2): aufgerollte orange Lagen.
const ROPE_GRID = [
  '.nnnn.',
  'nNnnNn',
  'nnffnn',
  'nNnnNn',
  'nnnnnn',
  'nNnnNn',
  'nnnnnn',
  '.nNNn.',
];
function ropeTexture(scene) {
  drawPixels(scene, 'rope', ROPE_GRID, 2);
}

// Getränk (20x20 = 10x10 ×2): Maß-Krug mit Schaumkrone + Henkel + Glanz —
// einladend, der wertvolle Pickup.
const DRINK_GRID = [
  '.ffffff...',
  'ffffffff..',
  'oooooooo..',
  'onnnnno.oo',
  'onfnnno..o',
  'onfnnno.oo',
  'onnnnno...',
  'onnnnno...',
  'oooooooo..',
  '.oooooo...',
];
function drinkTexture(scene) {
  drawPixels(scene, 'drink', DRINK_GRID, 2);
}

// Stilisiertes Emblem-Item (20x20 = 10x10 ×2): goldenes Medaillon, weißes Feld,
// rotes Kreuz, Funkeln — das seltene, besonders begehrenswerte Extra-Item
// (Mechanik erst in B_GAME4; hier nur das Sprite).
const EMBLEM_ITEM_GRID = [
  '...aqa....',
  '..aaaaaa..',
  '.awwwwwwa.',
  '.awwxxwwa.',
  '.awxxxxwa.',
  '.awxxxxwa.',
  '.awwxxwwa.',
  '.awwwwwwa.',
  '..aaaaaa..',
  '...aaaa..q',
];
function emblemItemTexture(scene) {
  drawPixels(scene, 'emblem_item', EMBLEM_ITEM_GRID, 2);
}

// Durchgehende Felswand-Kachel (256x256, B_GAME3.5): dunkle, kühle Pixel-Rock-
// Struktur auf 8px-Raster (blockiger GBC-Look). Bewusst dunkel/dezent, damit die
// bunten Vordergrund-Sprites davor klar lesbar bleiben. Vertikal kachelbar.
const WALL_TONES = [0x262232, 0x2d2838, 0x211d2a, 0x322c3e];
function wallTexture(scene) {
  const s = 256;
  const cell = 8;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(WALL_TONES[0], 1);
  g.fillRect(0, 0, s, s);
  // Jede 8px-Zelle ein zufälliger dunkler Ton → blockige Felsmaserung.
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      g.fillStyle(WALL_TONES[Math.floor(Math.random() * WALL_TONES.length)], 1);
      g.fillRect(x, y, cell, cell);
    }
  }
  // Vereinzelte dunkle Risse (rasterausgerichtet, dezent).
  g.fillStyle(0x17141c, 1);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(Math.random() * (s / cell)) * cell;
    const y0 = Math.floor(Math.random() * (s / cell)) * cell;
    const len = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < len; k++) g.fillRect(x, (y0 + k * cell) % s, cell, cell);
  }
  g.generateTexture('wall', s, s);
  g.destroy();
}

// Überhang-Block (170x46, B_GAME2): ragt in die Wand, blockiert eine Spur.
// Blockige Pixel-Maserung wie die Wand, aber mit heller Ober-/dunkler Unterkante,
// damit der Vorsprung klar als solides Hindernis lesbar ist.
const OVERHANG_TONES = [0x342e42, 0x2d2838, 0x3b3450];
function overhangTexture(scene) {
  const w = 170;
  const h = 46;
  const cell = 8;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(OVERHANG_TONES[1], 1);
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      g.fillStyle(OVERHANG_TONES[Math.floor(Math.random() * OVERHANG_TONES.length)], 1);
      g.fillRect(x, y, cell, cell);
    }
  }
  g.fillStyle(0x564d6a, 1); // helle Oberkante (Vorsprung-Lesbarkeit)
  g.fillRect(0, 0, w, 4);
  g.fillStyle(0x14111c, 1); // dunkle Unterkante
  g.fillRect(0, h - 4, w, 4);
  g.generateTexture('overhang', w, h);
  g.destroy();
}

// Hubschrauber (64x32 = 16x8-Grid ×4): Bergwacht-Heli rot/weiß/gelb, blaues
// Cockpit-Fenster, Heckausleger + Heckrotor, Landekufen. Zwei Frames, die sich
// nur im Hauptrotor unterscheiden → 2-Frame-Rotor-Animation (heli_rotor).
const HELI_BODY = [
  '......oo........', // Rotormast
  '..oyyyyyo......', // gelbes Dach
  '.orbbbrrrooooo..', // rote Kabine, blaues Fenster, Heckausleger
  '.orbbbrrrhhhhho.', // weiße Unterseite + Ausleger
  '.oRRRRRRRo..oo..', // Kabinenboden + Heckrotor
  '..o.....o...o...', // Streben + Heckrotor
  '.ooooooooo......', // Landekufe
];
function helicopterTexture(scene, key, rotorRow) {
  drawPixels(scene, key, [rotorRow, ...HELI_BODY], 4);
}

// Windenhaken (20x32 = 10x16-Grid ×2): Rettungsseil + Ring + offener Haken,
// mit Gold-Glanz (q) — signalisiert „Ziel, hier hin!".
const WINDENHAKEN_GRID = [
  '....pp....',
  '....pp....',
  '....pp....',
  '....pp....',
  '....pp....',
  '....pp....',
  '...ssss...',
  '..sq..qs..',
  '..s....s..',
  '..s....s..',
  '...ssss...',
  '....ss....',
  '...s..s...',
  '..s....s..',
  '..ss..s...',
  '...sss....',
];
function windenhakenTexture(scene) {
  drawPixels(scene, 'windenhaken', WINDENHAKEN_GRID, 2);
}

// Menü-Titel-Emblem (96x96, B_GAME3.7): stilisiertes Bergwacht-Emblem —
// goldenes Medaillon, weißes Feld, rotes Kreuz, blauer Berg mit Schneekappe.
// Anlehnung, kein 1:1-Logo. Harte Kanten (GBC-Look).
function menuEmblemTexture(scene) {
  const s = 96;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Goldenes Medaillon + Glanz.
  g.fillStyle(PALETTE.a, 1);
  g.fillRoundedRect(4, 4, s - 8, s - 8, 20);
  g.fillStyle(PALETTE.q, 1);
  g.fillRoundedRect(10, 10, s - 20, 9, 6);
  // Weißes Feld.
  g.fillStyle(PALETTE.w, 1);
  g.fillRoundedRect(16, 16, s - 32, s - 32, 14);
  // Blauer Berg + Schneekappe (untere Hälfte).
  g.fillStyle(0x3f74e0, 1);
  g.fillTriangle(20, 78, 48, 40, 76, 78);
  g.fillStyle(PALETTE.w, 1);
  g.fillTriangle(40, 52, 48, 40, 56, 52);
  // Rotes Kreuz (obere Hälfte).
  g.fillStyle(0xe2403a, 1);
  g.fillRect(44, 22, 8, 24);
  g.fillRect(36, 30, 24, 8);
  // Outline.
  g.lineStyle(3, PALETTE.o, 1);
  g.strokeRoundedRect(4, 4, s - 8, s - 8, 20);
  g.generateTexture('emblem', s, s);
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

  // Stilisiertes Menü-Titel-Emblem (B_GAME3.7).
  menuEmblemTexture(scene);

  // Alpinist-Posen für die Animationen (B_GAME.3).
  playerTexture(scene, 'player_idle', 'idle');
  playerTexture(scene, 'player_run_a', 'run_a');
  playerTexture(scene, 'player_run_b', 'run_b');
  playerTexture(scene, 'player_jump', 'jump');
  playerTexture(scene, 'player_fall', 'fall');

  // Felsbrocken (B_GAME2.4): kleiner Stein (Rückwurf) + großer Brocken (−1 Leben).
  rockTexture(scene);
  boulderTexture(scene);

  // Collectibles (B_GAME.5) + Emblem-Item (B_GAME3.4, Mechanik in B_GAME4).
  carabinerTexture(scene);
  ropeTexture(scene);
  drinkTexture(scene);
  emblemItemTexture(scene);

  // HUD (B_GAME.6).
  heartTexture(scene);

  // Ziel (B_GAME.7): Hubschrauber (2 Rotor-Frames) + Windenhaken.
  helicopterTexture(scene, 'helicopter', '..pppppppppp....'); // Rotor lang
  helicopterTexture(scene, 'helicopter_b', '......pppp......'); // Rotor gedreht/blur
  windenhakenTexture(scene);

  // Felswand + Überhänge (B_GAME2).
  wallTexture(scene);
  overhangTexture(scene);
}
