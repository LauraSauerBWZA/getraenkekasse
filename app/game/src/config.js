import Phaser from 'phaser';
import { GAME, COLORS, PHYS, SCENES } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { Level1Scene } from './scenes/Level1Scene.js';
import { WinScene } from './scenes/WinScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { HighscoreScene } from './scenes/HighscoreScene.js';

// Phaser-Game-Config. Scale.FIT skaliert den 480x800-Canvas proportional in den
// Viewport (Desktop wie Mobile), CENTER_BOTH zentriert ihn. Arcade-Physik global
// mit Gravity aus den Konstanten. Szenen werden phasenweise ergänzt
// (Level1/Win/GameOver ab B_GAME.2/.7/.10).
export function createConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: COLORS.bg,
    width: GAME.width,
    height: GAME.height,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: PHYS.gravity }, debug: false },
    },
    scene: [BootScene, MenuScene, Level1Scene, WinScene, GameOverScene, HighscoreScene],
  };
}

// Re-Export, damit Szenen-Keys auch außerhalb erreichbar sind.
export { SCENES };
