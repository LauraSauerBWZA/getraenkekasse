import { GAME } from '../constants.js';

// Level-1-Geometrie für die Auto-Climb-Felswand (Phase B_GAME2_KLETTERN).
// y wächst nach unten (Phaser): großes y = unten/Start, kleines y = oben/Ziel.

export const WALL = {
  topY: 90, // Wand-Oberkante (Ziel-Nähe)
  bottomY: GAME.worldHeight, // Wand-Unterkante (Boden)
  startY: GAME.worldHeight - 90, // Spieler-Start (unten an der Wand)
  goalY: 150, // Windenhaken-Hotspot
};

// Lücken (griffloses Band) — erzwingen einen Sprung (Logik in B_GAME2.3).
// Aufsteigend nach y, mit Mittelpunkt + Bandgrenzen (±70px).
function buildGaps() {
  const gaps = [];
  for (let y = 2800; y <= 9200; y += 1600) {
    gaps.push({ center: y, yTop: y - 70, yBottom: y + 70 });
  }
  return gaps;
}
export const GAPS = buildGaps();

// Überhänge — blockieren je eine Spur (links/rechts), zwingen zum Ausweichen.
// Gleichmäßige Kadenz, aber nicht zu nah an einer Lücke (sonst unfair).
function buildOverhangs() {
  const list = [];
  let i = 0;
  for (let y = 10000; y > 1000; y -= 1100) {
    const tooNearGap = GAPS.some((g) => Math.abs(g.center - y) < 160);
    if (!tooNearGap) list.push({ y, side: i % 2 === 0 ? 'left' : 'right' });
    i += 1;
  }
  return list;
}
export const OVERHANGS = buildOverhangs();

// Durchgehende Wand = [topY, bottomY] abzüglich der Lücken → Segmente, die als
// gekachelte TileSprites gerendert werden.
export function wallSegments() {
  const segs = [];
  let top = WALL.topY;
  for (const g of GAPS) {
    if (g.yTop > top) segs.push({ top, bottom: g.yTop });
    top = g.yBottom;
  }
  if (WALL.bottomY > top) segs.push({ top, bottom: WALL.bottomY });
  return segs;
}

// Prüft, ob eine y-Position in einer Lücke liegt (kein Halt → fallen/springen).
export function isInGap(y) {
  return GAPS.some((g) => y >= g.yTop && y <= g.yBottom);
}
