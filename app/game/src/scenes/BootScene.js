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
    // Hubschrauber-Rotor-Animation (B_GAME3.6) — global einmalig registriert,
    // von Level1-Ziel und WinScene genutzt.
    this.anims.create({
      key: 'heli_rotor',
      frames: [{ key: 'helicopter' }, { key: 'helicopter_b' }],
      frameRate: 12,
      repeat: -1,
    });
    this.scene.start(SCENES.menu);
  }
}
