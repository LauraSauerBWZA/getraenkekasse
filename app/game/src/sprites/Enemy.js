import Phaser from 'phaser';

// Gegnerischer Bergsteiger mit „dummer" AI (Spec §5): läuft auf seiner Plattform
// horizontal hin und her zwischen [minX, maxX]. Schwerkraft + Plattform-Collider
// halten ihn oben. Auf den Kopf gesprungen = besiegt (in der Scene behandelt),
// seitliche Berührung kostet ein Leben.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, range = 60, speed = 50) {
    super(scene, x, y, 'enemy_walk_a');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.body.setSize(20, 22).setOffset(2, 2);

    this.minX = x - range;
    this.maxX = x + range;
    this.speed = speed;
    this.setVelocityX(speed);

    this.createAnims(scene);
    this.play('enemy_walk');
  }

  createAnims(scene) {
    if (scene.anims.exists('enemy_walk')) return;
    scene.anims.create({
      key: 'enemy_walk',
      frames: [{ key: 'enemy_walk_a' }, { key: 'enemy_walk_b' }],
      frameRate: 6,
      repeat: -1,
    });
  }

  update() {
    // An den Patrouillen-Grenzen umkehren.
    if (this.body.velocity.x >= 0 && this.x >= this.maxX) {
      this.setVelocityX(-this.speed);
      this.setFlipX(true);
    } else if (this.body.velocity.x <= 0 && this.x <= this.minX) {
      this.setVelocityX(this.speed);
      this.setFlipX(false);
    }
  }
}
