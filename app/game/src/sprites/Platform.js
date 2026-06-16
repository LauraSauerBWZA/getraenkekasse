import Phaser from 'phaser';

// Statische Plattform variabler Breite. Als TileSprite gezeichnet, damit die
// 16x16-Material-Kachel sauber über die ganze Breite kachelt. Physik-Body ist
// statisch (bewegt sich nicht, kollidiert mit Player/Gegnern).
//
// Materialien (Spec §8): 'rock' (Standard), 'ice', 'wood'. Eis kann später
// rutschig werden — vorerst ist die Physik für alle gleich, nur die Optik
// unterscheidet sich.

export const PLATFORM_HEIGHT = 22;

const TEXTURE_BY_TYPE = {
  rock: 'tile_rock',
  ice: 'tile_ice',
  wood: 'tile_wood',
};

export class Platform extends Phaser.GameObjects.TileSprite {
  constructor(scene, x, y, width, type = 'rock') {
    const texture = TEXTURE_BY_TYPE[type] ?? TEXTURE_BY_TYPE.rock;
    super(scene, x, y, width, PLATFORM_HEIGHT, texture);
    this.platformType = type;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // true = statischer Body

    // Body exakt an die TileSprite-Anzeigegröße koppeln (Origin 0.5/0.5).
    this.body.setSize(width, PLATFORM_HEIGHT);
    this.body.updateFromGameObject();
  }
}
