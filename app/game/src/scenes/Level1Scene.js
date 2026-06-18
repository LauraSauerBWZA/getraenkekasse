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
  ICICLE,
  WALL_METERS,
} from '../constants.js';
import { WALL, OVERHANGS, COLLECTIBLES, EXES } from '../levels/level1.js';
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
    this.reachedTop = false;
    this.securedUntil = 0; // B_GAME4.3: Ende des Schutzfensters (this.time.now-Basis)
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
    this.buildIcicles();
    this.buildExes();
    this.buildSecuredVisuals();
    this.buildCollectibles();

    this.touch = new TouchControls(this);
    this.hud = new Hud(this, { onMenu: () => this.scene.start(SCENES.menu) });
    this.showTouchHint();

    this.input.keyboard.on('keydown-ESC', () => this.scene.start(SCENES.menu));
    // Einklippen-Taste (B_GAME4.2): E — linke Hand frei (Bewegung = Pfeile rechts,
    // Sprung = Space), kollidiert nicht mit der Steuerung.
    this.clipKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
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

  // Ziel am Wand-Ende. B_GAME5.6: Der Windenhaken ist ein ECHTES Treffer-Ziel —
  // der Sieg wird per präziser Kollision auf den Haken ausgelöst (nicht mehr
  // durch bloßes Erreichen der Wand-Oberkante). Der Haken pulsiert leicht
  // (anvisierbar); getroffen werden muss er trotzdem gezielt.
  buildGoal() {
    this.add.sprite(GAME.width / 2, WALL.goalY - 56, 'helicopter').play('heli_rotor');
    this.hook = this.physics.add.image(GAME.width / 2, WALL.goalY, 'windenhaken');
    this.hook.body.setAllowGravity(false);
    this.hook.body.setImmovable(true);
    // Enge Hitbox nur um den Haken-Bügel (Seil oben zählt nicht).
    this.hook.body.setSize(12, 18).setOffset(4, 12);
    this.tweens.add({
      targets: this.hook,
      scale: 1.18,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.physics.add.overlap(this.player, this.hook, () => this.win());
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

  // Exen an der Wand (B_GAME4.1): sichtbare Quickdraws, scrollen im Welt-Raster
  // mit (scrollFactor 1).
  buildExes() {
    this.exes = [];
    this.lastClippedExe = null;
    for (const e of EXES) {
      const sprite = this.add.image(e.x, e.y, 'exe');
      sprite.setData('clipped', false);
      this.exes.push(sprite);
    }
  }

  // Klipp-Intent aus Taste E (Desktop) ODER Mobile-Button.
  handleClipInput() {
    const intent =
      Phaser.Input.Keyboard.JustDown(this.clipKey) || (this.touch && this.touch.consumeClip());
    if (intent) this.attemptClip();
  }

  // Einklippen (B_GAME4.2): nächste noch nicht geklippte Exe in Reichweite suchen.
  // Erfolg → Punkte + geklippt-Markierung (kein erneutes Klippen). Schutzfenster
  // folgt in B_GAME4.3.
  attemptClip() {
    let nearest = null;
    let best = EXE.reachRadius;
    for (const exe of this.exes) {
      if (exe.getData('clipped')) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, exe.x, exe.y);
      if (d <= best) {
        best = d;
        nearest = exe;
      }
    }
    if (!nearest) {
      this.popup(this.player.x, this.player.y - 30, 'keine Exe', CSS.inkMute); // dezentes Fehl-Feedback
      return;
    }
    nearest.setData('clipped', true);
    nearest.setTint(0x88e0a0); // geklippt-Indikator (grünlich)
    this.score += EXE.clipScore;
    this.lastClippedExe = nearest;
    // B_GAME4.3: Schutzfenster öffnen/auffrischen.
    this.securedUntil = this.time.now + EXE.securedMs;
    this.popup(nearest.x, nearest.y - 20, `+${EXE.clipScore} gesichert`, CSS.success);
  }

  // Gesichert = kurzes Schutzfenster nach dem Klippen aktiv (B_GAME4.3).
  isSecured() {
    return this.time.now < this.securedUntil;
  }

  securedFrac() {
    return Phaser.Math.Clamp((this.securedUntil - this.time.now) / EXE.securedMs, 0, 1);
  }

  // Sicht-Feedback für „gesichert" (B_GAME4.4): Aura am Kletterer (ADD-Glow) +
  // Seil-Linie zur zuletzt geklippten Exe. Beide nur sichtbar im Schutzfenster.
  buildSecuredVisuals() {
    this.aura = this.add
      .image(this.player.x, this.player.y, 'aura')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(49)
      .setVisible(false);
    this.ropeGfx = this.add.graphics().setDepth(48);
  }

  updateSecuredVisuals() {
    const secured = this.isSecured();
    this.aura.setVisible(secured);
    this.ropeGfx.clear();
    if (!secured) return;
    // Aura pulsiert leicht und folgt dem Kletterer.
    const pulse = 1 + 0.12 * Math.sin(this.time.now / 110);
    this.aura.setPosition(this.player.x, this.player.y).setScale(pulse).setAlpha(0.85);
    // Seil-Linie vom Kletterer zur zuletzt geklippten Exe (Welt-Koordinaten).
    if (this.lastClippedExe) {
      this.ropeGfx.lineStyle(2, 0x88e0a0, 0.85);
      this.ropeGfx.lineBetween(
        this.player.x,
        this.player.y,
        this.lastClippedExe.x,
        this.lastClippedExe.y,
      );
    }
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

  // Höhen-Fortschritt 0..1 — zentrale Bezugsgröße aller Progressions-Kurven.
  progressFrac() {
    return Phaser.Math.Clamp(this.maxHeightM / WALL_METERS, 0, 1);
  }

  spawnBrocken() {
    // Anteil großer (gefährlicher) Brocken wächst mit der Höhe.
    const bigChance = Phaser.Math.Linear(
      BROCKEN.bigChanceLow,
      BROCKEN.bigChanceHigh,
      this.progressFrac(),
    );
    const big = Math.random() < bigChance;
    const camTop = this.cameras.main.scrollY;
    const x = Phaser.Math.Between(24, GAME.width - 24);
    const b = this.brocken.create(x, camTop - 30, big ? 'boulder' : 'rock');
    b.setData('big', big);
    b.body.setAllowGravity(false);
    b.setVelocityY(BROCKEN.fallSpeed);
    b.body.setSize(big ? 22 : 12, big ? 22 : 12);
  }

  updateBrocken(delta) {
    // Spawn-Intervall sinkt linear mit der Höhe (dichter oben).
    const interval = Phaser.Math.Linear(
      BROCKEN.rateStartMs,
      BROCKEN.rateMinMs,
      this.progressFrac(),
    );
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
    // Gesichert (B_GAME4.3): großer Brocken abgemildert zu Rückwurf (kein Leben),
    // kleiner Stein wirkungslos (Seil fängt). Ungesichert = unveränderte Werte.
    if (this.isSecured()) {
      if (big) this.hitPlayerSmall();
      return;
    }
    if (big) this.hitPlayer(); // großer Brocken: −1 Leben
    else this.hitPlayerSmall(); // kleiner Stein: Rückwurf
  }

  // Eiszapfen (B_GAME5.4): zweiter Hindernis-Typ mit eigenem Spawn-Akkumulator.
  buildIcicles() {
    this.icicles = this.physics.add.group();
    this.icicleAccum = 0;
    this.physics.add.overlap(this.player, this.icicles, (_p, ic) => this.handleIcicleHit(ic));
  }

  // Telegraph-Glitzern an der Decke → erst danach fällt der Zapfen (Fairness:
  // keine unangekündigten Tode). Position folgt dem aktuellen Kamera-Oberrand.
  spawnIcicle() {
    const x = Phaser.Math.Between(30, GAME.width - 30);
    const warnY = this.cameras.main.scrollY + 12;
    const warn = this.add.image(x, warnY, 'icicle').setAlpha(0);
    this.tweens.add({
      targets: warn,
      alpha: 0.85,
      duration: ICICLE.warnMs / 2,
      yoyo: true,
      onComplete: () => {
        warn.destroy();
        if (this.finished) return;
        const ic = this.icicles.create(x, this.cameras.main.scrollY + 6, 'icicle');
        ic.body.setAllowGravity(false);
        ic.setVelocityY(ICICLE.fallSpeed);
        ic.body.setSize(8, 12);
      },
    });
  }

  updateIcicles(delta) {
    // Gestaffeltes Einführen: Eiszapfen erst ab introHeightM (unten gibt es sie
    // nicht). Darüber steigt die Dichte bis zum Wand-Ende.
    if (this.maxHeightM < ICICLE.introHeightM) return;
    const frac = Phaser.Math.Clamp(
      (this.maxHeightM - ICICLE.introHeightM) / (WALL_METERS - ICICLE.introHeightM),
      0,
      1,
    );
    const interval = Phaser.Math.Linear(ICICLE.rateStartMs, ICICLE.rateMinMs, frac);
    this.icicleAccum += delta;
    if (this.icicleAccum >= interval) {
      this.icicleAccum = 0;
      this.spawnIcicle();
    }
    const camBottom = this.cameras.main.scrollY + GAME.height;
    this.icicles.children.iterate((ic) => {
      if (ic && ic.y > camBottom + 80) ic.destroy();
      return true;
    });
  }

  handleIcicleHit(ic) {
    if (this.invulnerable) return;
    ic.destroy();
    // Gesichert mildert Eisschlag analog zum großen Brocken ab (Q2: Steinschlag =
    // Eisschlag) → nur Rückwurf statt −1 Leben.
    if (this.isSecured()) {
      this.hitPlayerSmall();
      return;
    }
    this.hitPlayer(); // Eiszapfen ist scharf → −1 Leben
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

  // Wand-Ende erreicht (Kamera steht): einmaliger Hinweis, dann liegt der Sieg
  // allein am gezielten Haken-Treffer. Faires Verhalten: Haken bleibt erreichbar,
  // Gefahren bleiben aktiv (Geschicklichkeits-Show-down vor dem Sieg).
  onReachedTop() {
    if (this.reachedTop) return;
    this.reachedTop = true;
    this.popup(GAME.width / 2, this.hook.y + 34, 'Haken greifen!', CSS.amberGlow);
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

  // Oben am Ausschnitt clampen, damit der Spieler nicht über den sichtbaren
  // Bereich hinaus nach oben verschwindet. Unten gibt es KEINEN Clamp — dort
  // droht das Rausdrücken (checkPushOut).
  clampPlayerTop() {
    const cam = this.cameras.main;
    const top = cam.scrollY + 18;
    if (this.player.y < top) {
      this.player.y = top;
      if (this.player.body.velocity.y < 0) this.player.body.velocity.y = 0;
    }
  }

  // Wird der Spieler von der hochscrollenden Kamera unten rausgeschoben:
  // −1 Leben + Position-Reset in die Ausschnitt-Mitte (KEIN Höhen-Reset) + kurze
  // Unverwundbarkeit. 0 Leben → GameOver.
  checkPushOut() {
    if (this.invulnerable) return;
    const cam = this.cameras.main;
    if (this.player.y <= cam.scrollY + GAME.height) return; // noch im Bild

    this.lives -= 1;
    if (this.lives <= 0) {
      this.gameOver('lives');
      return;
    }
    this.player.setPosition(GAME.width / 2, cam.scrollY + GAME.height / 2);
    this.player.setVelocity(0, 0);
    this.invulnerable = true;
    this.player.setAlpha(0.4);
    this.popup(this.player.x, this.player.y - 26, '−1 ♥ rausgedrückt', CSS.rescue);
    this.time.delayedCall(HIT.stunMs, () => {
      this.invulnerable = false;
      this.player.setAlpha(1);
    });
  }

  update(time, delta) {
    if (this.finished) return;

    this.scrollCamera(delta);
    this.player.update();
    this.handleClipInput();
    this.clampPlayerTop();
    this.checkPushOut();
    this.updateBrocken(delta);
    this.updateIcicles(delta);

    this.updateSecuredVisuals();

    const heightM = this.currentHeightM();
    if (heightM > this.maxHeightM) this.maxHeightM = heightM;

    const timeMs = this.time.now - this.startedAt;
    this.hud.update({
      lives: this.lives,
      score: this.score,
      heightM: this.maxHeightM,
      timeMs,
      securedFrac: this.securedFrac(),
    });

    // Kamera am Wand-Ende: stoppt (clampt bei 0). Jetzt muss der Haken gezielt
    // getroffen werden — Brocken/Eiszapfen fallen weiter (Show-down). Der Sieg
    // läuft ausschließlich über die Haken-Kollision (buildGoal).
    if (this.cameras.main.scrollY <= 0) this.onReachedTop();
    if (timeMs >= TIMEOUT_MS) this.gameOver('timeout');
  }
}
