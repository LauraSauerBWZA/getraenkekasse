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

  // Sprung-Intent aus Tastatur ODER Touch.
  jumpInput() {
    const touch = this.scene.touch;
    return (
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      (touch && touch.consumeJump())
    );
  }

  startJump() {
    this.jumping = true;
    this.body.setAllowGravity(true); // Bogen unter Welt-Schwerkraft
    this.setVelocityY(CLIMB.jumpVy);
  }

  endJump() {
    this.jumping = false;
    this.body.setAllowGravity(false);
    this.setVelocityY(-CLIMB.speed); // wieder an der Wand klettern
  }

  update() {
    this.applySteer();

    const inGap = this.scene.isInGap ? this.scene.isInGap(this.y) : false;
    if (this.jumpInput() && !this.jumping) this.startJump();

    if (this.jumping) {
      // Bogen: Wieder-Fangen an der Wand, sobald wir fallen UND nicht (mehr) in
      // einer Lücke sind — gelang der Sprung, geschieht das oberhalb der Lücke;
      // misslang er, weiter unten (Höhenverlust statt Tod).
      if (this.body.velocity.y >= 0 && !inGap) this.endJump();
    } else if (inGap) {
      // Kein Halt → fallen statt klettern (Schwerkraft an, kein Aufstieg).
      this.body.setAllowGravity(true);
      if (this.body.velocity.y < 0) this.setVelocityY(0);
    } else {
      // Auto-Climb.
      this.body.setAllowGravity(false);
      this.setVelocityY(-CLIMB.speed);
    }

    this.updateAnim(inGap);
  }

  updateAnim(inGap) {
    if (this.jumping) {
      this.play(this.body.velocity.y < 0 ? 'jump' : 'fall', true);
    } else if (inGap) {
      this.play('fall', true);
    } else {
      this.play('climb', true);
    }
  }
}
