import Phaser from 'phaser';
import { PlayScene } from './game/PlayScene';
import { MenuScene } from './game/MenuScene';
import { currentLayoutMode } from './game/device';
import { installRendererRecovery } from './game/rendererRecovery';
import { readStoredRendererMode, shouldUseCanvasRenderer } from './game/rendererPolicy';

async function boot(): Promise<void> {
  await document.fonts.ready;
  const portrait = currentLayoutMode() === 'portrait';
  const useCanvas = shouldUseCanvasRenderer(
    window.location.search,
    readStoredRendererMode(window.sessionStorage),
  );
  const game = new Phaser.Game({
    type: useCanvas ? Phaser.CANVAS : Phaser.AUTO,
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
  installRendererRecovery(game);
}

void boot();
