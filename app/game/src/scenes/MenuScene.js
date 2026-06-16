import Phaser from 'phaser';
import { CSS, COLORS, SCENES } from '../constants.js';

// B_GAME.1: Menü-Stub. Titel, Emblem, Kurz-Erklärung, Start-Button.
// Der Start-Button wird in B_GAME.2 die Level1Scene starten; das Leaderboard
// und der humorvolle Text folgen in B_GAME.8/B_GAME.10.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.menu);
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add.image(width / 2, height * 0.24, 'emblem');

    this.add
      .text(width / 2, height * 0.4, 'BERGWACHT', {
        fontFamily: CSS.fontDisplay,
        fontSize: '34px',
        color: CSS.amberGlow,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.4 + 38, 'ALPINIST', {
        fontFamily: CSS.fontDisplay,
        fontSize: '34px',
        color: CSS.ink,
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.58,
        'Erklimme den Windenhaken des Hubschraubers.\nKarabiner sammeln, Steinen ausweichen.',
        {
          fontFamily: CSS.fontUi,
          fontSize: '14px',
          color: CSS.inkDim,
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5);

    const start = this.add
      .text(width / 2, height * 0.76, '▶  Level 1 spielen', {
        fontFamily: CSS.fontUi,
        fontSize: '18px',
        color: CSS.ink,
        backgroundColor: CSS.amberDeep,
        padding: { x: 22, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    start.on('pointerover', () => start.setColor(CSS.amberGlow));
    start.on('pointerout', () => start.setColor(CSS.ink));
    start.on('pointerup', () => {
      // B_GAME.1-Stub — ab B_GAME.2: this.scene.start(SCENES.level1)
      start.setText('… Level kommt in B_GAME.2');
    });

    this.add
      .text(width / 2, height - 26, 'Phase B_GAME_ALPINIST · Platzhalter-Grafik', {
        fontFamily: CSS.fontUi,
        fontSize: '11px',
        color: CSS.inkMute,
      })
      .setOrigin(0.5);
  }
}
