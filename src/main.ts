import Phaser from 'phaser';
import { PlayScene } from './game/PlayScene';
import { MenuScene } from './game/MenuScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'app',
  backgroundColor: '#0d1a12',
  scene: [MenuScene, PlayScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
