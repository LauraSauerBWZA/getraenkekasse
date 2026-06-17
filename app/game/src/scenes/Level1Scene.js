import Phaser from 'phaser';
import {
  GAME,
  COLORS,
  CSS,
  SCENES,
  SCORE,
  START_LIVES,
  PHYS,
  PIXELS_PER_METER,
  TIMEOUT_MS,
} from '../constants.js';
import { Platform } from '../sprites/Platform.js';
import { Player } from '../sprites/Player.js';
import { Enemy } from '../sprites/Enemy.js';
import { Collectible } from '../sprites/Collectible.js';
import { Hud } from '../utils/hud.js';
import { TouchControls } from '../utils/mobile.js';

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

// Bergsteiger-Gegner: Plattform-Index + Patrouillen-Radius. Auf breiteren
// Plattformen, die genug Lauffläche bieten.
const WALKER_SPEC = [
  { i: 1, range: 55 },
  { i: 5, range: 70 },
  { i: 11, range: 55 },
  { i: 13, range: 48 },
];

// Collectibles: Plattform-Index, x-Versatz zur Plattform-Mitte, Typ.
// Karabiner häufig, Seile seltener, Getränke (+100) an kniffligen Stellen.
const COLLECTIBLE_SPEC = [
  { i: 1, dx: -30, type: 'carabiner' },
  { i: 2, dx: 30, type: 'carabiner' },
  { i: 3, dx: 0, type: 'rope' },
  { i: 4, dx: 0, type: 'carabiner' },
  { i: 5, dx: -55, type: 'carabiner' },
  { i: 5, dx: 55, type: 'carabiner' },
  { i: 6, dx: 0, type: 'drink' },
  { i: 7, dx: 0, type: 'carabiner' },
  { i: 8, dx: 0, type: 'rope' },
  { i: 9, dx: 25, type: 'carabiner' },
  { i: 11, dx: 0, type: 'drink' },
  { i: 12, dx: 0, type: 'carabiner' },
  { i: 13, dx: 0, type: 'rope' },
  { i: 15, dx: 0, type: 'drink' },
];

// Start-Position des Spielers: mittig auf dem Boden.
const PLAYER_START = { x: 240, y: 3140 - 40 };

export class Level1Scene extends Phaser.Scene {
  constructor() {
    super(SCENES.level1);
  }

  create() {
    // Lauf-Zustand (wird in B_GAME.6 im HUD angezeigt, in B_GAME.7/.8 gespeichert).
    this.lives = START_LIVES;
    this.score = 0;
    this.collectiblesFound = 0;
    this.enemiesDefeated = 0;
    this.invulnerable = false;
    this.finished = false;
    this.maxHeightM = 0;
    this.startedAt = this.time.now;

    this.physics.world.setBounds(0, 0, GAME.width, GAME.worldHeight);
    this.cameras.main.setBounds(0, 0, GAME.width, GAME.worldHeight);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.buildBackground();
    this.buildPlatforms();
    this.spawnPlayer();
    this.buildEnemies();
    this.buildCollectibles();
    this.buildGoal();
    this.setupCombat();

    // Touch-Steuerung (Mobile) — Player.update liest this.touch mit.
    this.touch = new TouchControls(this);
    this.hud = new Hud(this, { onMenu: () => this.scene.start(SCENES.menu) });
    this.showTouchHint();

    // ESC → zurück ins Menü (Desktop).
    this.input.keyboard.on('keydown-ESC', () => this.scene.start(SCENES.menu));
  }

  // Kurzer Steuer-Hinweis nur auf Touch-Geräten, blendet nach ~4s aus.
  showTouchHint() {
    if (!this.touch.active) return;
    const { width, height } = this.scale;
    const style = { fontFamily: CSS.fontUi, fontSize: '13px', color: CSS.inkMute };
    const a = this.add
      .text(width / 2, height * 0.4, '↤  halten zum Laufen  ↦', style)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(99);
    const b = this.add
      .text(width / 2, height * 0.82, 'unten tippen = springen', style)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(99);
    this.tweens.add({
      targets: [a, b],
      alpha: 0,
      delay: 3000,
      duration: 1000,
      onComplete: () => {
        a.destroy();
        b.destroy();
      },
    });
  }

  // Dezenter Höhen-Verlauf + Höhenmarken, damit Scrollen sichtbar ist.
  buildBackground() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.bgWarm, 0.5);
    g.fillRect(0, 0, GAME.width, GAME.worldHeight * 0.5); // oben etwas wärmer
    g.setScrollFactor(1);

    for (let y = GAME.worldHeight - 200; y > 200; y -= 400) {
      this.add
        .text(8, y, `${Math.round((PLAYER_START.y - y) / PIXELS_PER_METER)} m`, {
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

  spawnPlayer() {
    this.player = new Player(this, PLAYER_START.x, PLAYER_START.y);
    this.physics.add.collider(this.player, this.platforms);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    // Spieler vertikal etwas unter die Bildmitte legen — Klettern „nach oben".
    this.cameras.main.setFollowOffset(0, -GAME.height * 0.15);
  }

  buildEnemies() {
    // Laufende Bergsteiger auf festen Plattformen.
    this.enemies = this.add.group();
    for (const w of WALKER_SPEC) {
      const p = LEVEL1_PLATFORMS[w.i];
      // Gegner-Mitte 23px über Plattform-Mitte = steht auf der Oberkante.
      const enemy = new Enemy(this, p.x, p.y - 23, w.range);
      this.enemies.add(enemy);
    }
    this.physics.add.collider(this.enemies, this.platforms);

    // Fallende Steine: dynamische Gruppe, periodischer Spawn knapp über dem
    // Sichtfeld. Sie zerschellen beim Plattform-Kontakt.
    this.stones = this.physics.add.group();
    this.physics.add.collider(this.stones, this.platforms, (stone) => stone.destroy());
    this.stoneTimer = this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => this.spawnStone(),
    });
  }

  spawnStone() {
    const camTop = this.cameras.main.scrollY;
    const x = Phaser.Math.Between(20, GAME.width - 20);
    const stone = this.stones.create(x, camTop - 20, 'rock');
    stone.setVelocityY(120);
    stone.body.setSize(14, 14);
  }

  buildCollectibles() {
    this.collectibles = this.add.group();
    for (const c of COLLECTIBLE_SPEC) {
      const p = LEVEL1_PLATFORMS[c.i];
      // 26px über Plattform-Mitte = knapp über der Oberkante schwebend.
      this.collectibles.add(new Collectible(this, p.x + c.dx, p.y - 26, c.type));
    }

    this.physics.add.overlap(this.player, this.collectibles, (_player, item) => {
      this.score += item.value;
      this.collectiblesFound += 1;
      this.popup(item.x, item.y, `+${item.value}`, CSS.amberGlow);
      item.destroy();
    });
  }

  buildGoal() {
    // Hubschrauber als Deko über der obersten Plattform; der Windenhaken
    // darunter ist der Ziel-Hotspot. Top-Plattform: idx 15 (x 360, y 170).
    this.add.image(360, 78, 'helicopter');
    this.goal = this.physics.add.staticImage(360, 128, 'windenhaken');
    this.physics.add.overlap(this.player, this.goal, () => this.win());
  }

  win() {
    if (this.finished) return;
    this.finished = true;
    this.stoneTimer.remove();
    this.physics.pause();

    // Score-Formel (Spec §6): Basis (Collectibles + besiegte Gegner) plus
    // Höhenbonus (1 Punkt pro gekletterten Meter).
    const heightBonus = this.maxHeightM;
    this.scene.start(SCENES.win, {
      level: 1,
      score: this.score + heightBonus,
      baseScore: this.score,
      heightBonus,
      heightM: this.maxHeightM,
      timeMs: this.time.now - this.startedAt,
      collectiblesFound: this.collectiblesFound,
      enemiesDefeated: this.enemiesDefeated,
      livesLost: START_LIVES - this.lives,
    });
  }

  // Kurzer aufsteigender Punkte-Hinweis (Feedback beim Sammeln/Besiegen).
  popup(x, y, text, color) {
    const t = this.add
      .text(x, y, text, { fontFamily: CSS.fontUi, fontSize: '13px', color })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  setupCombat() {
    // Bergsteiger: von oben drauf = besiegt, sonst Schaden.
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      const stomping = player.body.velocity.y > 0 && player.body.bottom <= enemy.body.top + 12;
      if (stomping) this.defeatEnemy(enemy);
      else this.hitPlayer();
    });

    // Fallende Steine: immer Schaden (Stein verschwindet).
    this.physics.add.overlap(this.player, this.stones, (_player, stone) => {
      stone.destroy();
      this.hitPlayer();
    });
  }

  defeatEnemy(enemy) {
    this.popup(enemy.x, enemy.y - 14, `+${SCORE.enemy}`, CSS.success);
    enemy.destroy();
    this.enemiesDefeated += 1;
    this.score += SCORE.enemy;
    this.player.setVelocityY(PHYS.jump * 0.7); // Abprall nach oben
  }

  hitPlayer() {
    if (this.invulnerable) return;
    this.lives -= 1;
    this.invulnerable = true;
    this.player.setAlpha(0.4);
    this.player.setVelocityY(-220); // kleiner Rückstoß
    this.time.delayedCall(1200, () => {
      this.invulnerable = false;
      this.player.setAlpha(1);
    });
    if (this.lives <= 0) this.gameOver();
  }

  gameOver() {
    // B_GAME.10 ersetzt das durch die GameOverScene. Bis dahin: Level neu starten.
    this.scene.restart();
  }

  // Gekletterte Höhe in Metern (>= 0), relativ zur Start-Position.
  currentHeightM() {
    return Math.max(0, Math.round((PLAYER_START.y - this.player.y) / PIXELS_PER_METER));
  }

  update() {
    if (this.finished) return; // Lauf beendet (Win) — keine Updates mehr.
    this.player.update();
    this.enemies.children.iterate((enemy) => {
      if (enemy) enemy.update();
      return true;
    });
    // Steine entfernen, die unter das Sichtfeld gefallen sind.
    const camBottom = this.cameras.main.scrollY + GAME.height;
    this.stones.children.iterate((stone) => {
      if (stone && stone.y > camBottom + 80) stone.destroy();
      return true;
    });

    const heightM = this.currentHeightM();
    if (heightM > this.maxHeightM) this.maxHeightM = heightM;

    const timeMs = this.time.now - this.startedAt;
    this.hud.update({ lives: this.lives, score: this.score, heightM, timeMs });

    // Timeout (Spec §7): nach 5 Minuten Game Over.
    if (timeMs >= TIMEOUT_MS) this.gameOver();
  }
}
