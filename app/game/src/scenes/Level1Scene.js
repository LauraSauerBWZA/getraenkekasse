import Phaser from 'phaser';
import {
  GAME,
  COLORS,
  CSS,
  SCENES,
  START_LIVES,
  PIXELS_PER_METER,
  TIMEOUT_MS,
  CLIMB,
  BROCKEN,
} from '../constants.js';
import { WALL, OVERHANGS, COLLECTIBLES, wallSegments, isInGap } from '../levels/level1.js';
import { Player } from '../sprites/Player.js';
import { Collectible } from '../sprites/Collectible.js';
import { Hud } from '../utils/hud.js';
import { TouchControls } from '../utils/mobile.js';

// Auto-Climb-Felswand (Phase B_GAME2_KLETTERN). Der Spieler klettert automatisch
// hoch; gelenkt wird nur ←→. Diese Szene baut die durchgehende Wand mit Lücken
// und Überhängen auf. Sprung (B_GAME2.3), Brocken (B_GAME2.4) und Collectibles
// (B_GAME2.5) kommen in den folgenden Sub-Commits.
export class Level1Scene extends Phaser.Scene {
  constructor() {
    super(SCENES.level1);
  }

  create() {
    this.lives = START_LIVES;
    this.score = 0;
    this.collectiblesFound = 0;
    this.enemiesDefeated = 0; // bleibt 0 (Walker entfallen) — Feld additiv erhalten
    this.invulnerable = false;
    this.finished = false;
    this.maxHeightM = 0;
    this.startedAt = this.time.now;

    this.physics.world.setBounds(0, 0, GAME.width, GAME.worldHeight);
    this.cameras.main.setBounds(0, 0, GAME.width, GAME.worldHeight);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.buildBackground();
    this.buildWall();
    this.spawnPlayer();
    this.buildGoal();
    this.buildBrocken();
    this.buildCollectibles();

    this.touch = new TouchControls(this);
    this.hud = new Hud(this, { onMenu: () => this.scene.start(SCENES.menu) });
    this.showTouchHint();

    this.input.keyboard.on('keydown-ESC', () => this.scene.start(SCENES.menu));
  }

  buildBackground() {
    // Wärmerer Himmel oben (Ziel-Nähe), kühl/dunkel unten.
    const g = this.add.graphics();
    g.fillStyle(COLORS.bgWarm, 0.5);
    g.fillRect(0, 0, GAME.width, GAME.worldHeight * 0.25);
    g.setScrollFactor(1);

    for (let y = GAME.worldHeight - 300; y > 300; y -= 1000) {
      this.add
        .text(8, y, `${Math.round((WALL.startY - y) / PIXELS_PER_METER)} m`, {
          fontFamily: CSS.fontUi,
          fontSize: '10px',
          color: CSS.inkMute,
        })
        .setAlpha(0.4);
    }
  }

  // Durchgehende Wand als gekachelte Segmente (Lücken bleiben offen = Himmel),
  // plus solide Überhang-Blöcke, die je eine Spur blockieren.
  buildWall() {
    for (const seg of wallSegments()) {
      const h = seg.bottom - seg.top;
      this.add
        .tileSprite(GAME.width / 2, (seg.top + seg.bottom) / 2, GAME.width, h, 'wall')
        .setScrollFactor(1);
    }

    this.overhangs = this.physics.add.staticGroup();
    for (const o of OVERHANGS) {
      const x = o.side === 'left' ? 85 : GAME.width - 85; // 170px breit, flush am Rand
      this.overhangs.create(x, o.y, 'overhang');
    }
  }

  spawnPlayer() {
    this.player = new Player(this, GAME.width / 2, WALL.startY);
    // Überhänge blockieren den Aufstieg in ihrer Spur → ausweichen.
    this.physics.add.collider(this.player, this.overhangs);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setFollowOffset(0, -GAME.height * 0.15);
  }

  buildGoal() {
    this.add.image(GAME.width / 2, WALL.goalY - 56, 'helicopter');
    this.goal = this.physics.add.staticImage(GAME.width / 2, WALL.goalY, 'windenhaken');
    this.physics.add.overlap(this.player, this.goal, () => this.win());
  }

  showTouchHint() {
    if (!this.touch.active) return;
    const { width, height } = this.scale;
    const style = { fontFamily: CSS.fontUi, fontSize: '13px', color: CSS.inkMute };
    const a = this.add
      .text(width / 2, height * 0.4, '↤  Hälfte halten zum Lenken  ↦', style)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(99);
    const b = this.add
      .text(width / 2, height * 0.82, 'tippen = springen', style)
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

  buildCollectibles() {
    this.collectibles = this.add.group();
    for (const c of COLLECTIBLES) {
      this.collectibles.add(new Collectible(this, c.x, c.y, c.type));
    }
    this.physics.add.overlap(this.player, this.collectibles, (_player, item) => {
      this.score += item.value;
      this.collectiblesFound += 1;
      this.popup(item.x, item.y, `+${item.value}`, CSS.amberGlow);
      item.destroy();
    });
  }

  // Herabfallende Brocken (Spec §3): periodischer Spawn oberhalb des Sichtfelds,
  // Rate steigt mit der Höhe. Akkumulator in update() statt fixem Timer, damit
  // die Rate dynamisch mit der Kletterhöhe sinkt.
  buildBrocken() {
    this.brocken = this.physics.add.group();
    this.brockenAccum = 0;
    this.physics.add.overlap(this.player, this.brocken, (_p, b) => this.handleBrockenHit(b));
  }

  spawnBrocken() {
    const big = Math.random() < BROCKEN.bigChance;
    const camTop = this.cameras.main.scrollY;
    const x = Phaser.Math.Between(24, GAME.width - 24);
    const b = this.brocken.create(x, camTop - 30, big ? 'boulder' : 'rock');
    b.setData('big', big);
    b.body.setAllowGravity(false);
    b.setVelocityY(BROCKEN.fallSpeed);
    b.body.setSize(big ? 22 : 12, big ? 22 : 12);
  }

  updateBrocken(delta) {
    // Spawn-Intervall sinkt linear mit der Höhe (Wandhöhe ~500 m, Spec §9).
    const frac = Phaser.Math.Clamp(this.maxHeightM / 500, 0, 1);
    const interval = Phaser.Math.Linear(BROCKEN.rateStartMs, BROCKEN.rateMinMs, frac);
    this.brockenAccum += delta;
    if (this.brockenAccum >= interval) {
      this.brockenAccum = 0;
      this.spawnBrocken();
    }
    // Brocken unter dem Sichtfeld entfernen.
    const camBottom = this.cameras.main.scrollY + GAME.height;
    this.brocken.children.iterate((b) => {
      if (b && b.y > camBottom + 80) b.destroy();
      return true;
    });
  }

  handleBrockenHit(b) {
    if (this.invulnerable) return;
    const big = b.getData('big');
    b.destroy();
    if (big) this.hitPlayer(); // großer Brocken: −1 Leben
    else this.hitPlayerSmall(); // kleiner Stein: Rückwurf
  }

  // Kleiner Stein: Höhenverlust (Rückwurf) + kurze Unverwundbarkeit, kein Tod.
  hitPlayerSmall() {
    this.invulnerable = true;
    this.player.setAlpha(0.4);
    this.player.y = Math.min(WALL.bottomY - 20, this.player.y + CLIMB.smallKnockback);
    this.popup(this.player.x, this.player.y - 26, 'Rückwurf!', CSS.rescue);
    this.time.delayedCall(CLIMB.stunMs, () => {
      this.invulnerable = false;
      this.player.setAlpha(1);
    });
  }

  win() {
    if (this.finished) return;
    this.finished = true;
    this.stopHazards();
    this.physics.pause();

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

  gameOver(reason) {
    if (this.finished) return;
    this.finished = true;
    this.stopHazards();
    this.physics.pause();
    this.scene.start(SCENES.gameover, {
      reason,
      score: this.score + this.maxHeightM,
      heightM: this.maxHeightM,
      timeMs: this.time.now - this.startedAt,
      collectiblesFound: this.collectiblesFound,
      enemiesDefeated: this.enemiesDefeated,
    });
  }

  // Hazard-Timer stoppen (Brocken-Spawn kommt in B_GAME2.4).
  stopHazards() {
    if (this.brockenTimer) this.brockenTimer.remove();
  }

  // Großer Brocken: −1 Leben mit Unverwundbarkeits-Fenster (Blink).
  hitPlayer() {
    if (this.invulnerable) return;
    this.lives -= 1;
    this.invulnerable = true;
    this.player.setAlpha(0.4);
    this.popup(this.player.x, this.player.y - 26, '−1 ♥', CSS.rescue);
    this.time.delayedCall(CLIMB.stunMs, () => {
      this.invulnerable = false;
      this.player.setAlpha(1);
    });
    if (this.lives <= 0) this.gameOver('lives');
  }

  // Kurzer aufsteigender Punkte-Hinweis (Feedback beim Sammeln).
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

  // Liegt y in einer Lücke (kein Halt)? Vom Player für Fallen/Sprung genutzt.
  isInGap(y) {
    return isInGap(y);
  }

  // Gekletterte Höhe in Metern (>= 0), relativ zur Start-Position.
  currentHeightM() {
    return Math.max(0, Math.round((WALL.startY - this.player.y) / PIXELS_PER_METER));
  }

  update(time, delta) {
    if (this.finished) return;
    this.player.update();
    this.updateBrocken(delta);

    const heightM = this.currentHeightM();
    if (heightM > this.maxHeightM) this.maxHeightM = heightM;

    const timeMs = this.time.now - this.startedAt;
    // Anzeige + Score basieren auf der MAX erreichten Höhe (NACHSCHLAG.1):
    // beim Runter-/wieder-Hochfahren springt die Höhe nicht zurück, kein
    // Doppelzählen.
    this.hud.update({ lives: this.lives, score: this.score, heightM: this.maxHeightM, timeMs });

    if (timeMs >= TIMEOUT_MS) this.gameOver('timeout');
  }
}
