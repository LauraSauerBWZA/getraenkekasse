import Phaser from 'phaser';
import { SCORE } from '../constants.js';

// Einsammelbarer Gegenstand (Spec §5): Karabiner/Seil/Getränk. Schwebt (keine
// Schwerkraft) und hat je Typ eine eigene Animation (Spin/Wave/Glow) per Tween.
// Wert + Zähl-Kategorie liefert die Scene beim Overlap aus.
const DEFS = {
  carabiner: { texture: 'carabiner', value: SCORE.karabiner, anim: 'spin' },
  rope: { texture: 'rope', value: SCORE.seil, anim: 'wave' },
  drink: { texture: 'drink', value: SCORE.getraenk, anim: 'glow' },
};

export class Collectible extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, type = 'carabiner') {
    const def = DEFS[type] ?? DEFS.carabiner;
    super(scene, x, y, def.texture);
    this.kind = type;
    this.value = def.value;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.addAnimation(scene, def.anim);
  }

  addAnimation(scene, anim) {
    if (anim === 'spin') {
      scene.tweens.add({ targets: this, angle: 360, duration: 1600, repeat: -1 });
    } else if (anim === 'wave') {
      scene.tweens.add({
        targets: this,
        y: this.y - 6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    } else if (anim === 'glow') {
      scene.tweens.add({
        targets: this,
        scale: 1.18,
        alpha: 0.7,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }
}
