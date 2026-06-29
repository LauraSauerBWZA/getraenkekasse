import { GAME, EXE } from '../constants.js';

// Level-1-Geometrie für die Auto-Climb-Felswand (Phase B_GAME2_KLETTERN, ab
// NACHSCHLAG.3 mit frei befahrbarer Wand: keine Lücken/Griffzonen mehr).
// y wächst nach unten (Phaser): großes y = unten/Start, kleines y = oben/Ziel.

export const WALL = {
  topY: 90, // Wand-Oberkante (Ziel-Nähe)
  bottomY: GAME.worldHeight, // Wand-Unterkante (Boden)
  startY: GAME.worldHeight - 90, // Spieler-Start (unten an der Wand)
  goalY: 150, // Windenhaken-Hotspot
};

// Überhänge — ragen von einer Seite (links/rechts) in die Wand und blockieren
// eine Spur. Einziges festes Hindernis; erzwingen seitliches Ausweichen.
function buildOverhangs() {
  const list = [];
  let i = 0;
  for (let y = 10000; y > 1000; y -= 1100) {
    list.push({ y, side: i % 2 === 0 ? 'left' : 'right' });
    i += 1;
  }
  return list;
}
export const OVERHANGS = buildOverhangs();

// Exen (Vorstieg-Sicherung, B_GAME4.1): regelmäßig entlang der Route, abwechselnd
// links/rechts nahe der Wand-Seite (erreichbar). Dicht genug zum regelmäßigen
// Sichern, aber nicht trivial. Versetzt zu den Überhängen (eigenes Raster).
export function buildExes() {
  const list = [];
  // Faire Eröffnung (B_GAME4B.3): erste Exe früh, zentral und in Reichweite des
  // Spieler-Starts (Mitte), damit man sich sofort sichern kann.
  list.push({ x: GAME.width / 2 - 20, y: WALL.startY - 370, side: 'left' });
  let i = 0;
  for (let y = WALL.startY - 600; y > WALL.goalY + 300; y -= EXE.spacingPx) {
    const side = i % 2 === 0 ? 'left' : 'right';
    list.push({ x: side === 'left' ? EXE.inset : GAME.width - EXE.inset, y, side });
    i += 1;
  }
  return list;
}
export const EXES = buildExes();

// Sammelbares entlang der Kletterroute (Spec §4.2). Karabiner im Zickzack
// (häufig), Seile seltener, Getränke vereinzelt an riskanten Höhen.
export function buildCollectibles() {
  const items = [];

  let toggle = 0;
  for (let y = WALL.startY - 500; y > WALL.goalY + 200; y -= 700) {
    items.push({ x: toggle % 2 === 0 ? 150 : 330, y, type: 'carabiner' });
    toggle += 1;
  }

  for (let y = WALL.startY - 1200; y > WALL.goalY + 400; y -= 2400) {
    items.push({ x: 240, y, type: 'rope' });
  }

  for (let y = WALL.startY - 2600; y > WALL.goalY + 800; y -= 3200) {
    items.push({ x: 240, y, type: 'drink' });
  }

  return items;
}
export const COLLECTIBLES = buildCollectibles();

// Emblem-Bonus-Item (B_GAME4.5): selten (2× pro Level), an unterschiedlichen
// Höhen, mittig in der Brocken-Bahn = riskant. Pendelt horizontal (Scene).
// B_GAME6.7: zwei Bewegungsmuster — #1 pendelt horizontal (wie bisher), #2
// driftet diagonal (neues Muster, schwerer mitzunehmen).
export const BONUS_SPOTS = [
  { x: GAME.width / 2, y: WALL.startY - 2600, motion: 'pendulum' },
  { x: GAME.width / 2, y: WALL.startY - 6800, motion: 'drift' },
];
