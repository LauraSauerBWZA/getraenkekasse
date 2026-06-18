import Phaser from 'phaser';
import { MOVE, PLAYER } from '../constants.js';

// Der Alpinist — Forced-Scroll-Mechanik (Phase B_GAME2_KLETTERN, NACHSCHLAG2).
//
// Die Kamera scrollt eigenständig hoch (Scene); der Spieler bewegt sich frei im
// Ausschnitt (← → ↑ ↓), ohne Schwerkraft und ohne Auto-Climb. Keine Taste =
// stehenbleiben. SPACE = kurzer Sprung-Burst nach oben (schnelles Ausweichen).
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    // B_GAME5.1: deutlich größer + forgiving Hitbox (Box < sichtbares Sprite).
    this.setScale(PLAYER.scale);
    this.body
      .setSize(PLAYER.hitboxW, PLAYER.hitboxH)
      .setOffset(PLAYER.hitboxOffsetX, PLAYER.hitboxOffsetY);

    this.jumping = false;
    this.moving = false;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.createAnims(scene);
    this.play('idle');
  }

  createAnims(scene) {
    const a = scene.anims;
    if (a.exists('climb')) return;
    a.create({
      key: 'climb',
      frames: [{ key: 'player_run_a' }, { key: 'player_run_b' }],
      frameRate: 10, // B_GAME5.2: etwas schneller → dynamischer Kletter-Zyklus
      repeat: -1,
    });
    a.create({ key: 'idle', frames: [{ key: 'player_idle' }], frameRate: 1, repeat: -1 });
    a.create({ key: 'jump', frames: [{ key: 'player_jump' }], frameRate: 1 });
    a.create({ key: 'fall', frames: [{ key: 'player_fall' }], frameRate: 1 });
  }

  // Sprung-Intent: SPACE (Desktop) oder Tap (Touch).
  jumpInput() {
    const touch = this.scene.touch;
    return Phaser.Input.Keyboard.JustDown(this.cursors.space) || (touch && touch.consumeJump());
  }

  applyFreeMove() {
    this.body.setAllowGravity(false);
    const touch = this.scene.touch;
    let mx;
    let my;
    if (touch && touch.active && touch.moveActive) {
      // Analoger Joystick (B_GAME_TOUCH): moveX/moveY ist bereits ein Vektor mit
      // |v| ≤ 1 (Magnitude = Tempo) → KEINE Diagonal-Normalisierung.
      mx = touch.moveX;
      my = touch.moveY;
    } else {
      // Tastatur (Desktop, unverändert): ±1 je Achse, Diagonale normalisiert.
      mx = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
      my = (this.cursors.down.isDown ? 1 : 0) - (this.cursors.up.isDown ? 1 : 0);
      if (mx && my) {
        mx *= Math.SQRT1_2;
        my *= Math.SQRT1_2;
      }
    }
    this.setVelocity(mx * MOVE.speed, my * MOVE.speed);
    if (mx < 0) this.setFlipX(true);
    else if (mx > 0) this.setFlipX(false);
    this.moving = mx !== 0 || my !== 0;
  }

  // Sprung-Burst: Bogen unter Welt-Schwerkraft, ← → lenkt in der Luft.
  startJump() {
    this.jumping = true;
    this.body.setAllowGravity(true);
    this.setVelocityY(MOVE.jumpVy);
  }

  endJump() {
    this.jumping = false;
    this.body.setAllowGravity(false);
    this.setVelocityY(0);
  }

  applyAirControl() {
    const touch = this.scene.touch;
    let dir;
    if (touch && touch.active && touch.moveActive) {
      dir = touch.moveX; // analoge X-Lenkung aus dem Joystick
    } else {
      dir = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
    }
    this.setVelocityX(dir * MOVE.speed);
    if (dir < 0) this.setFlipX(true);
    else if (dir > 0) this.setFlipX(false);
  }

  update() {
    if (this.jumpInput() && !this.jumping) this.startJump();

    if (this.jumping) {
      this.applyAirControl();
      if (this.body.velocity.y >= 0) this.endJump();
    } else {
      this.applyFreeMove();
    }

    this.updateAnim();
  }

  updateAnim() {
    if (this.jumping) {
      this.play(this.body.velocity.y < 0 ? 'jump' : 'fall', true);
    } else if (this.moving) {
      this.play('climb', true);
    } else {
      this.play('idle', true);
    }
  }
}
