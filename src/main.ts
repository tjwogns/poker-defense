import Phaser from 'phaser';
import { PlayScene } from './game/PlayScene';
import { MenuScene } from './game/MenuScene';
import { currentLayoutMode } from './game/device';

async function boot(): Promise<void> {
  await document.fonts.ready;
  const portrait = currentLayoutMode() === 'portrait';
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: portrait ? 390 : 1280,
    height: portrait ? 844 : 720,
    parent: 'app',
    backgroundColor: '#0a0a0f',
    scene: [MenuScene, PlayScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  game.canvas.tabIndex = 0;
  game.canvas.setAttribute('role', 'application');
  game.canvas.setAttribute('aria-label', '포커 디펜스 게임 화면');
  game.canvas.setAttribute('aria-describedby', 'game-instructions');
}

void boot();
