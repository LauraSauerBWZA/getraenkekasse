import Phaser from 'phaser';
import { PHYS } from '../constants.js';

// Der Alpinist. Arcade-Physik-Sprite mit Tastatur-Steuerung (← → laufen,
// Leertaste/↑ springen) und vier Animationen (idle/run/jump/fall).
// Mobile-Touch-Steuerung wird in B_GAME.9 ergänzt (setzt dieselben intents).
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    // Fall-Geschwindigkeit deckeln (Spec §6: Max Fall Speed). Horizontal wird
    // direkt gesetzt, daher hier nur die y-Achse relevant.
    this.setMaxVelocity(10_000, PHYS.maxFall);
    // Hitbox etwas schmaler als die Grafik (fairere Kollisionen).
    this.body.setSize(16, 28).setOffset(3, 2);

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.createAnims(scene);
    this.play('idle');
  }

  createAnims(scene) {
    const a = scene.anims;
    if (a.exists('idle')) return; // einmalig global registrieren
    a.create({ key: 'idle', frames: [{ key: 'player_idle' }], frameRate: 1, repeat: -1 });
    a.create({
      key: 'run',
      frames: [{ key: 'player_run_a' }, { key: 'player_run_b' }],
      frameRate: 9,
      repeat: -1,
    });
    a.create({ key: 'jump', frames: [{ key: 'player_jump' }], frameRate: 1 });
    a.create({ key: 'fall', frames: [{ key: 'player_fall' }], frameRate: 1 });
  }

  update() {
    const onGround = this.body.blocked.down || this.body.touching.down;
    // Tastatur (Desktop) ODER Touch-Steuerung (Mobile, B_GAME.9) zusammenführen.
    const touch = this.scene.touch;
    const left = this.cursors.left.isDown || (touch && touch.left);
    const right = this.cursors.right.isDown || (touch && touch.right);
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      (touch && touch.consumeJump());

    if (left && !right) {
      this.setVelocityX(-PHYS.speed);
      this.setFlipX(true);
    } else if (right && !left) {
      this.setVelocityX(PHYS.speed);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    if (jumpPressed && onGround) this.setVelocityY(PHYS.jump);

    // Animations-Auswahl nach Zustand.
    if (!onGround) {
      this.play(this.body.velocity.y < 0 ? 'jump' : 'fall', true);
    } else if (this.body.velocity.x !== 0) {
      this.play('run', true);
    } else {
      this.play('idle', true);
    }
  }
}
