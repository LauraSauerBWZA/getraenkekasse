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

// ─── B_GAME5 Balancing-Übersicht (finale Start-Werte, Playtest-tunbar) ───────
// Optik:
//   PLAYER.scale 1,7×  → sichtbarer Kletterer ≈ 37×54 px (vorher 22×30)
//   Hitbox 11×24 (Quell-px) → skaliert ≈ 19×41 px = forgiving (< Sprite)
// Mechanik / Progression (Bezug: WALL_METERS = 500 m Wandhöhe):
//   Brocken-Intervall   2600 ms (unten) → 1100 ms (oben), linear mit Höhe
//   Großbrocken-Anteil  20 % (unten) → 45 % (oben)
//   Eiszapfen           erst ab 140 m; Intervall 3200 → 1600 ms; fallSpeed 255
//                       (> Brocken 175); 360 ms Telegraph-Vorwarnung (fair)
//   Windenhaken         enge Hitbox 12×18 px-Bügel → präziser Treffer nötig;
//                       Kamera stoppt am Wand-Ende, Gefahren bleiben aktiv
//                       (Show-down), Sieg nur per Haken-Kollision
// Mobile (statischer Review): Canvas-FIT/480×800 unverändert; größerer Kletterer
//   + Eiszapfen bleiben innerhalb 480px; Touch-Steuerung unverändert. Live-Check
//   = Browser-Test-Checkliste (Mobile-Kurztest).
// ─────────────────────────────────────────────────────────────────────────────

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

// Spieler-Darstellung (B_GAME5.1): Kletterer deutlich größer als das
// 22x32-Basissprite. Die Hitbox ist BEWUSST kleiner als das sichtbare Sprite
// (forgiving hitbox), damit der größere Kletterer kein unfair großes Ziel wird.
// Body-Maße sind in Quell-Pixeln (vor Scale) — Phaser multipliziert sie mit
// `scale`. Finale Werte im Balancing-Pass (B_GAME5.7) justiert.
export const PLAYER = {
  scale: 1.7, // sichtbare Größe ≈ 37x54 px (1,7× von 22x32)
  hitboxW: 11, // schmaler als die 22px-Sprite-Breite → seitlich verzeihend
  hitboxH: 24, // etwas kürzer als 32 → Kopf/Füße ragen leicht hitbox-frei
  hitboxOffsetX: 5, // zentriert die schmale Box im Sprite
  hitboxOffsetY: 5, // Box sitzt am Rumpf, nicht am Helm-Rand
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

// Höhe der Felswand in Metern — zentrale Bezugsgröße für die Schwierigkeits-
// Progression (Spawn-Raten/Anteile skalieren von 0 m bis WALL_METERS).
export const WALL_METERS = 500;

// Herabfallende Felsbrocken (Spec §3). B_GAME5.5: Anteil großer Brocken UND
// Spawn-Dichte wachsen mit der Höhe (unten leicht, oben fordernd).
export const BROCKEN = {
  fallSpeed: 175, // px/s Fallgeschwindigkeit (schneller als Climb → ausweichbar)
  rateStartMs: 2600, // Spawn-Intervall unten
  rateMinMs: 1100, // Spawn-Intervall ganz oben (dichter als zuvor 1300)
  bigChanceLow: 0.2, // Anteil große Brocken unten (mehr Rückwurf-Steine)
  bigChanceHigh: 0.45, // Anteil große Brocken oben (mehr −1-Leben-Brocken)
};

// Eiszapfen (B_GAME5.4): zweiter Hindernis-Typ. Fällt schneller als Brocken
// (schärferes Timing), wird aber durch ein kurzes Telegraph-Glitzern fair
// angekündigt. Treffer = −1 Leben (scharf). Höhen-Gate + Raten-Progression
// folgen in B_GAME5.5.
export const ICICLE = {
  fallSpeed: 255, // px/s (vs. Brocken 175) — fordert früheres Ausweichen
  warnMs: 360, // Vorwarn-Glitzern an der Decke, bevor der Zapfen fällt
  introHeightM: 140, // erscheint erst ab ~140 m (gestaffeltes Einführen, B_GAME5.5)
  rateStartMs: 3200, // knapp über introHeight noch selten
  rateMinMs: 1600, // ganz oben dicht
};

// ─── B_GAME4B Sturzhöhe-Balancing (finale Start-Werte, Playtest-tunbar) ──────
// Mechanik:        Sturzhöhe statt Zeitfenster. „Gesichert" = in die ZULETZT
//                  PASSIERTE Exe eingeclippt (B_GAME4B.7). An einer Exe ohne
//                  Clippen vorbei → ungesichert (auch wenn weiter unten geclippt).
//                  Gefährlicher Treffer GESICHERT → −1 Leben + Sturz auf letzte
//                  geclippte Exe; UNGESICHERT → sofort Game Over. 0 Leben → GO.
// Treffer-Typen:   kleiner Stein = immer harmloser Rückwurf (kein Leben, auch
//                  ohne Anker, Q1); großer Brocken + Eiszapfen = Sturz/Game-Over.
//                  Rausdrücken am unteren Rand bleibt unabhängig (wie gehabt).
// Exen:            Abstand 320 px (abwechselnd L/R, inset 52), Reichweite 82 px,
//                  +50 Klick-Punkte. Erste Exe früh+zentral, Schon-Frist 1,5 s
//                  (keine großen Brocken am Start).
// Edge-Case:       Anker unter dem Bildrand → Sturz am unteren Rand begrenzt,
//                  −1 Leben gilt trotzdem (konsistent zu checkPushOut, Q3).
// Emblem-Bonus:    2× pro Level (versch. Höhen, mittig = riskant), +250,
//                  pendelt ±47 px (Periode 1,7 s).
// Eingabe:         Desktop = Taste E; Mobile = „Klippen"-Button unten links
//                  (KEIN Doppeltipp → keine Kollision mit dem Sprung-Tap).
// Seil:            durchgehende, wachsende Polyline Boden→alle Clips→Kletterer;
//                  jeder neue Clip verlängert sie (kein Reset), bleibt permanent.
// Status sichtbar: gesichert = ruhige Aura + grünes gespanntes Seil + HUD grün
//                  „⚓ gesichert"; ungesichert = Aura aus + rotes flatterndes
//                  Seil-Ende + HUD rot „⚠ ungesichert" + rotes Flash beim Verpassen.
// ─────────────────────────────────────────────────────────────────────────────

// Vorstieg-Sicherung (B_GAME4 + Rework B_GAME4B): Exen (Quickdraws) an der Wand-
// Seite. Einklippen in Reichweite gibt Punkte und setzt einen Fangpunkt (Anker);
// die zuletzt geclippte Exe begrenzt einen Sturz (Sturzhöhe-Modell, siehe oben).
export const EXE = {
  spacingPx: 320, // Abstand entlang der Wand (Richtwert 250–400)
  inset: 52, // x-Abstand von der Wand-Seite (noch erreichbar)
  reachRadius: 82, // px: so nah muss der Kletterer zum Einklippen ran
  clipScore: 50, // Punkte fürs Einklippen (B_GAME4B.4: gleichwertig zum Sammel-Karabiner)
};

// Faire Eröffnung (B_GAME4B.3): kurze Schon-Frist beim Start, in der KEINE
// gefährlichen (großen) Brocken spawnen — verhindert unfairen Sofort-Tod vor der
// ersten erreichbaren Exe. Eiszapfen sind ohnehin erst ab ICICLE.introHeightM da.
export const START_GRACE_MS = 1500;

// Emblem-Bonus-Item (B_GAME4.5): selten, beweglich (pendelt), riskant platziert.
export const BONUS = {
  score: 250, // deutlich wertvoller als normale Collectibles
  pendulumPx: 95, // horizontale Pendel-Amplitude
  pendulumMs: 1700, // Pendel-Periode (hin/zurück)
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
