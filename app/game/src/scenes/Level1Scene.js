import Phaser from 'phaser';
import {
  GAME,
  COLORS,
  CSS,
  SCENES,
  START_LIVES,
  PIXELS_PER_METER,
  TIMEOUT_MS,
  SCROLL,
  HIT,
  BROCKEN,
} from '../constants.js';
import { WALL, OVERHANGS, COLLECTIBLES } from '../levels/level1.js';
import { Player } from '../sprites/Player.js';
import { Collectible } from '../sprites/Collectible.js';
import { Hud } from '../utils/hud.js';
import { TouchControls } from '../utils/mobile.js';

// Forced-Scroll-Felswand (Phase B_GAME2_KLETTERN, NACHSCHLAG2). Die Kamera
// scrollt eigenständig nach oben (Speed steigt mit der Höhe); der Spieler bewegt
// sich frei im Ausschnitt und muss mithalten. Höhe/Score ergeben sich aus dem
// Kamera-Fortschritt; das Wand-Ende zu erreichen = überleben bis oben → WinScene.
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

    // Forced-Scroll: Kamera startet am unteren Wand-Ende und scrollt eigenständig
    // hoch (kein startFollow). scrollY läuft von startScrollY → 0 (Wand-Ende).
    this.startScrollY = GAME.worldHeight - GAME.height;
    this.cameras.main.setScroll(0, this.startScrollY);

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

  // Durchgehende, frei befahrbare Wand (ein TileSprite über die ganze Höhe)
  // plus solide Überhang-Blöcke, die je eine Spur blockieren.
  buildWall() {
    const h = WALL.bottomY - WALL.topY;
    this.add
      .tileSprite(GAME.width / 2, (WALL.topY + WALL.bottomY) / 2, GAME.width, h, 'wall')
      .setScrollFactor(1);

    this.overhangs = this.physics.add.staticGroup();
    for (const o of OVERHANGS) {
      const x = o.side === 'left' ? 85 : GAME.width - 85; // 170px breit, flush am Rand
      this.overhangs.create(x, o.y, 'overhang');
    }
  }

  spawnPlayer() {
    // Start in der Mitte des anfänglichen Ausschnitts (Kamera folgt NICHT).
    this.player = new Player(this, GAME.width / 2, this.startScrollY + GAME.height / 2);
    // Überhänge blockieren eine Spur → ausweichen.
    this.physics.add.collider(this.player, this.overhangs);
  }

  // Ziel-Deko am Wand-Ende; der Sieg wird über den Kamera-Fortschritt ausgelöst
  // (Spieler sieht Hubschrauber/Windenhaken, wenn die Kamera oben ankommt).
  buildGoal() {
    this.add.image(GAME.width / 2, WALL.goalY - 56, 'helicopter');
    this.add.image(GAME.width / 2, WALL.goalY, 'windenhaken');
  }

  showTouchHint() {
    if (!this.touch.active) return;
    const { width, height } = this.scale;
    const style = { fontFamily: CSS.fontUi, fontSize: '13px', color: CSS.inkMute };
    const a = this.add
      .text(width / 2, height * 0.4, 'halten = bewegen (auch hoch/runter)', style)
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

  // Kleiner Stein: Schub nach unten (Richtung Gefahr) + kurze Unverwundbarkeit,
  // kein Lebensverlust.
  hitPlayerSmall() {
    this.invulnerable = true;
    this.player.setAlpha(0.4);
    this.player.y += HIT.smallKnockback;
    this.popup(this.player.x, this.player.y - 26, 'Rückwurf!', CSS.rescue);
    this.time.delayedCall(HIT.stunMs, () => {
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
    this.time.delayedCall(HIT.stunMs, () => {
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

  // Höhe in Metern aus dem KAMERA-Fortschritt (nicht aus der Spieler-Position):
  // scrollY läuft von startScrollY → 0, daher monoton steigend.
  currentHeightM() {
    return Math.round((this.startScrollY - this.cameras.main.scrollY) / PIXELS_PER_METER);
  }

  // Kamera eigenständig nach oben scrollen; Speed steigt linear mit dem Höhen-
  // Fortschritt (Beschleunigungskurve).
  scrollCamera(delta) {
    const cam = this.cameras.main;
    const progress = Phaser.Math.Clamp((this.startScrollY - cam.scrollY) / this.startScrollY, 0, 1);
    const speed = Phaser.Math.Linear(SCROLL.startSpeed, SCROLL.endSpeed, progress);
    cam.scrollY = Math.max(0, cam.scrollY - (speed * delta) / 1000);
  }

  // Spieler im sichtbaren Ausschnitt halten. NACHSCHLAG2.1: oben UND unten
  // geclampt (spielbar ohne Tod). Der untere Clamp wird in NACHSCHLAG2.3 durch
  // das „Rausdrücken kostet ein Leben" ersetzt.
  clampPlayerToView() {
    const cam = this.cameras.main;
    const top = cam.scrollY + 18;
    const bottom = cam.scrollY + GAME.height - 18;
    if (this.player.y < top) {
      this.player.y = top;
      if (this.player.body.velocity.y < 0) this.player.body.velocity.y = 0;
    } else if (this.player.y > bottom) {
      this.player.y = bottom;
      if (this.player.body.velocity.y > 0) this.player.body.velocity.y = 0;
    }
  }

  update(time, delta) {
    if (this.finished) return;

    this.scrollCamera(delta);
    this.player.update();
    this.clampPlayerToView();
    this.updateBrocken(delta);

    const heightM = this.currentHeightM();
    if (heightM > this.maxHeightM) this.maxHeightM = heightM;

    const timeMs = this.time.now - this.startedAt;
    this.hud.update({ lives: this.lives, score: this.score, heightM: this.maxHeightM, timeMs });

    // Kamera am Wand-Ende angekommen → durchgehalten → Sieg.
    if (this.cameras.main.scrollY <= 0) this.win();
    if (timeMs >= TIMEOUT_MS) this.gameOver('timeout');
  }
}
