import Phaser from 'phaser';
import { CLIMB } from '../constants.js';

// Der Alpinist — Auto-Climb-Mechanik (Phase B_GAME2_KLETTERN).
//
// Er klettert kontinuierlich und stetig nach oben (CLIMB.speed), Schwerkraft ist
// dabei AUS. Der Spieler lenkt nur links/rechts (← → bzw. Touch). Die
// Sprung-Mechanik (Bogen über Lücken/Überhänge) + die Lücken-Logik kommen in
// B_GAME2.3 — hier klettert er erstmal durchgehend bis zum Wand-Ende.
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setAllowGravity(false); // beim Klettern keine Schwerkraft
    this.body.setSize(16, 28).setOffset(3, 2);

    this.jumping = false;

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.createAnims(scene);
    this.play('climb');
  }

  createAnims(scene) {
    const a = scene.anims;
    if (a.exists('climb')) return; // einmalig global registrieren
    // Klettern: dieselben zwei Posen wie die alte Lauf-Animation, als Greifen
    // links/rechts gelesen.
    a.create({
      key: 'climb',
      frames: [{ key: 'player_run_a' }, { key: 'player_run_b' }],
      frameRate: 6,
      repeat: -1,
    });
    a.create({ key: 'idle', frames: [{ key: 'player_idle' }], frameRate: 1, repeat: -1 });
    a.create({ key: 'jump', frames: [{ key: 'player_jump' }], frameRate: 1 });
    a.create({ key: 'fall', frames: [{ key: 'player_fall' }], frameRate: 1 });
  }

  // Lenkung aus Tastatur ODER Touch zusammenführen.
  steerInput() {
    const touch = this.scene.touch;
    const left = this.cursors.left.isDown || (touch && touch.left);
    const right = this.cursors.right.isDown || (touch && touch.right);
    return { left, right };
  }

  applySteer() {
    const { left, right } = this.steerInput();
    if (left && !right) {
      this.setVelocityX(-CLIMB.steerSpeed);
      this.setFlipX(true);
    } else if (right && !left) {
      this.setVelocityX(CLIMB.steerSpeed);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }
  }

  // Sprung-Intent: SPACE (Desktop) oder Tap (Touch). ↑ ist seit NACHSCHLAG.1
  // NICHT mehr Sprung, sondern Tempo (siehe applyVerticalTempo).
  jumpInput() {
    const touch = this.scene.touch;
    return Phaser.Input.Keyboard.JustDown(this.cursors.space) || (touch && touch.consumeJump());
  }

  // Vertikales Tempo (NACHSCHLAG.1): ↑ schneller hoch, ↓ langsamer/runter,
  // sonst Grund-Tempo. Moduliert den Auto-Climb, ersetzt ihn nicht.
  applyVerticalTempo() {
    this.body.setAllowGravity(false);
    const up = this.cursors.up.isDown;
    const down = this.cursors.down.isDown;
    if (up && !down) this.setVelocityY(-CLIMB.fastSpeed);
    else if (down && !up) this.setVelocityY(CLIMB.downSpeed);
    else this.setVelocityY(-CLIMB.speed);
  }

  // Sprung = kurzes Hochschnellen (Brocken ausweichen). Bogen unter
  // Welt-Schwerkraft, danach Wieder-Fangen an der (durchgehenden) Wand.
  startJump() {
    this.jumping = true;
    this.body.setAllowGravity(true);
    this.setVelocityY(CLIMB.jumpVy);
  }

  endJump() {
    this.jumping = false;
    this.body.setAllowGravity(false);
    this.setVelocityY(-CLIMB.speed); // wieder an der Wand
  }

  update() {
    this.applySteer();

    if (this.jumpInput() && !this.jumping) this.startJump();

    if (this.jumping) {
      // Bogen vorbei (fällt wieder) → wieder fangen.
      if (this.body.velocity.y >= 0) this.endJump();
    } else {
      // Auto-Climb mit ↑/↓-Tempo-Modulation.
      this.applyVerticalTempo();
    }

    this.updateAnim();
  }

  updateAnim() {
    if (this.jumping) {
      this.play(this.body.velocity.y < 0 ? 'jump' : 'fall', true);
    } else {
      const descending = this.cursors.down.isDown && !this.cursors.up.isDown;
      this.play(descending ? 'fall' : 'climb', true);
    }
  }
}
