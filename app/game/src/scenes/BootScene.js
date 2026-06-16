import Phaser from 'phaser';
import { buildTextures } from '../utils/textures.js';
import { CSS, SCENES } from '../constants.js';

// Lädt/erzeugt Assets und springt ins Menü. Da wir (vorerst) prozedurale
// Platzhalter-Texturen nutzen, gibt es keinen echten Asset-Download — der
// Lade-Text ist nur Konvention/Optik.
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload() {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Lade Bergwacht-Alpinist …', {
        fontFamily: CSS.fontUi,
        fontSize: '16px',
        color: CSS.inkDim,
      })
      .setOrigin(0.5);
  }

  create() {
    buildTextures(this);
    this.scene.start(SCENES.menu);
  }
}
