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

  update() {
    // Auto-Climb: konstante Aufwärtsgeschwindigkeit, keine Schwerkraft.
    this.body.setAllowGravity(false);
    this.setVelocityY(-CLIMB.speed);
    this.applySteer();
    this.play('climb', true);
  }
}
