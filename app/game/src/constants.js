// Spiel-Konstanten für den Bergwacht-Alpinist (Phase B_GAME_ALPINIST).
//
// Farben sind aus design/design-tokens.css (OKLCH) in sRGB-Hex überführt — Phaser
// arbeitet mit 0xRRGGBB. Die Werte sind visuell approximiert; Canvas-Flächen
// brauchen keine farbmetrische Exaktheit. Token-Name jeweils im Kommentar.

export const COLORS = {
  bg: 0x0c0a08, // --bwza-bg
  bgWarm: 0x241a12, // --bwza-bg-warm
  amber: 0xe3a857, // --bwza-amber
  amberDeep: 0xc57d3e, // --bwza-amber-deep
  amberGlow: 0xf2cb82, // --bwza-amber-glow
  rescue: 0xd2553f, // --bwza-rescue
  success: 0x57b877, // --bwza-success
  ink: 0xf4f0e9, // --bwza-ink
  inkDim: 0xc3baac, // --bwza-ink-dim
  inkMute: 0x938a7c, // --bwza-ink-mute
  glassLine: 0xffd2a0, // --bwza-glass-line (Strichfarbe)
  rock: 0x4a4036, // Fels-Plattform (dunkel, warm)
  ice: 0x9ec6e0, // Eis-Plattform (blau)
  wood: 0x8a5a36, // Holz-Plattform (braun)
};

// CSS-Strings für Phaser-Text (nutzt CSS-Farben/Fonts).
export const CSS = {
  ink: '#f4f0e9',
  inkDim: '#c3baac',
  inkMute: '#938a7c',
  amber: '#e3a857',
  amberDeep: '#c57d3e',
  amberGlow: '#f2cb82',
  rescue: '#d2553f',
  success: '#57b877',
  fontUi: "'Inter', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Fraunces', Georgia, serif",
};

// Portrait-Canvas — passt zu Climber-Gameplay (vertikales Hochklettern) und
// Mobile. Welt ist mehrere Screens hoch; Kamera scrollt vertikal.
export const GAME = {
  width: 480,
  height: 800,
  // B_GAME2: hohe Felswand (~2 Min Forced-Scroll bei SCROLL-Speed).
  worldHeight: 11000,
};

// Welt-Schwerkraft (config.js). Nur während des Sprung-Bogens + für fallende
// Brocken relevant; beim Klettern ist die Schwerkraft am Player aus.
export const PHYS = {
  gravity: 600,
};

// Freie Spielerbewegung (Forced-Scroll-Mechanik, NACHSCHLAG2). Der Spieler
// bewegt sich frei im Ausschnitt; die Geschwindigkeit muss über der maximalen
// Kamera-Scroll-Geschwindigkeit liegen, damit man mithalten/ausweichen kann.
export const MOVE = {
  speed: 210, // px/s freie Bewegung (← → ↑ ↓)
  jumpVy: -460, // Sprung-Burst nach oben (Bogen, schnelles Ausweichen)
};

// Auto-Scroll-Kamera (NACHSCHLAG2.1): scrollt eigenständig hoch, Speed steigt
// linear mit dem Höhen-Fortschritt (Beschleunigungskurve = linear).
export const SCROLL = {
  startSpeed: 55, // px/s am Anfang (unten)
  endSpeed: 135, // px/s am Wand-Ende (oben)
};

// Treffer/Reset-Folgen.
export const HIT = {
  stunMs: 1200, // Unverwundbarkeit/Blink nach Treffer/Reset (ms)
  smallKnockback: 90, // kleiner Stein: Schub nach unten (px, Richtung Gefahr)
};

// Herabfallende Felsbrocken (Spec §3). Finale Balancing-Werte (B_GAME2.6).
export const BROCKEN = {
  fallSpeed: 175, // px/s Fallgeschwindigkeit (schneller als Climb → ausweichbar)
  rateStartMs: 2600, // Spawn-Intervall unten
  rateMinMs: 1300, // Spawn-Intervall ganz oben (schwerer)
  bigChance: 0.3, // 30% große Brocken (−1 Leben), 70% kleine (Rückwurf)
};

// Punkte pro Collectible (Spec §4.2).
export const SCORE = {
  karabiner: 50,
  seil: 30,
  getraenk: 100,
};

export const START_LIVES = 3;
export const TIMEOUT_MS = 300_000; // 5 Minuten (Spec §7 GameOver-Timeout)

// Umrechnung Pixel → Höhenmeter für HUD/Score. B_GAME2: ~10800px Kletterweg
// ≈ 500 m Wandhöhe (Spec §9).
export const PIXELS_PER_METER = 21.5;

// Szenen-Keys, zentral, um Tippfehler bei scene.start() zu vermeiden.
export const SCENES = {
  boot: 'boot',
  menu: 'menu',
  level1: 'level1',
  win: 'win',
  gameover: 'gameover',
  highscore: 'highscore',
};
