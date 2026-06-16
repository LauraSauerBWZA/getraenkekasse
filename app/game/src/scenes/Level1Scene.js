import Phaser from 'phaser';
import { GAME, COLORS, CSS, SCENES } from '../constants.js';
import { Platform } from '../sprites/Platform.js';

// Plattform-Layout Level 1 (Spec §5). x = Mitte, y = Mitte, w = Breite, t = Typ.
// Von unten (Start) nach oben (Windenhaken) im Zickzack — wechselnde Seiten
// erzwingen Sprünge. y wächst nach unten (Phaser), kleinere y = höher/Ziel.
export const LEVEL1_PLATFORMS = [
  { x: 240, y: 3140, w: 480, t: 'rock' }, // Boden / Start (volle Breite)
  { x: 150, y: 2920, w: 160, t: 'rock' },
  { x: 350, y: 2720, w: 150, t: 'wood' },
  { x: 160, y: 2520, w: 140, t: 'rock' },
  { x: 360, y: 2320, w: 120, t: 'ice' },
  { x: 200, y: 2120, w: 180, t: 'rock' },
  { x: 380, y: 1900, w: 110, t: 'wood' },
  { x: 170, y: 1700, w: 140, t: 'rock' },
  { x: 330, y: 1500, w: 120, t: 'ice' },
  { x: 150, y: 1300, w: 130, t: 'rock' },
  { x: 320, y: 1100, w: 120, t: 'wood' },
  { x: 180, y: 900, w: 150, t: 'rock' },
  { x: 340, y: 700, w: 110, t: 'ice' },
  { x: 180, y: 500, w: 140, t: 'rock' },
  { x: 340, y: 320, w: 130, t: 'wood' },
  { x: 360, y: 170, w: 120, t: 'rock' }, // oberste Plattform (Windenhaken-Nähe)
];

// Start-Position des Spielers: mittig auf dem Boden.
const PLAYER_START = { x: 240, y: 3140 - 40 };

export class Level1Scene extends Phaser.Scene {
  constructor() {
    super(SCENES.level1);
  }

  create() {
    this.physics.world.setBounds(0, 0, GAME.width, GAME.worldHeight);
    this.cameras.main.setBounds(0, 0, GAME.width, GAME.worldHeight);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.buildBackground();
    this.buildPlatforms();
    this.spawnPlayer();

    // ESC → zurück ins Menü (Dev-Komfort; Pause/echtes Menü später).
    this.input.keyboard.on('keydown-ESC', () => this.scene.start(SCENES.menu));
  }

  // Dezenter Höhen-Verlauf + Höhenmarken, damit Scrollen sichtbar ist.
  buildBackground() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bgWarm, 0.5);
    g.fillRect(0, 0, GAME.width, GAME.worldHeight * 0.5); // oben etwas wärmer
    g.setScrollFactor(1);

    for (let y = GAME.worldHeight - 200; y > 200; y -= 400) {
      this.add
        .text(8, y, `${Math.round((PLAYER_START.y - y) / 7.6)} m`, {
          fontFamily: CSS.fontUi,
          fontSize: '10px',
          color: CSS.inkMute,
        })
        .setAlpha(0.4);
    }
  }

  buildPlatforms() {
    this.platforms = this.add.group();
    for (const p of LEVEL1_PLATFORMS) {
      this.platforms.add(new Platform(this, p.x, p.y, p.w, p.t));
    }
  }

  // B_GAME.2: Platzhalter-Spieler (fällt, landet, Kamera folgt). Steuerung +
  // Animationen + die echte Player-Klasse kommen in B_GAME.3.
  spawnPlayer() {
    this.player = this.physics.add
      .sprite(PLAYER_START.x, PLAYER_START.y, 'player')
      .setCollideWorldBounds(true);

    this.physics.add.collider(this.player, this.platforms);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    // Spieler vertikal etwas unter die Bildmitte legen — Klettern „nach oben".
    this.cameras.main.setFollowOffset(0, -GAME.height * 0.15);
  }
}
