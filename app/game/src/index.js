import Phaser from 'phaser';
import { createConfig } from './config.js';

// Entry-Point: Phaser-Game an #game-root hängen.
// eslint-disable-next-line no-new
new Phaser.Game(createConfig('game-root'));
