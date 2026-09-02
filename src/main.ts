import Phaser from 'phaser';
import { PlayScene } from './game/PlayScene';
import { MenuScene } from './game/MenuScene';
import { currentLayoutMode } from './game/device';
import { installRendererRecovery } from './game/rendererRecovery';
import { readStoredRendererMode, shouldUseCanvasRenderer } from './game/rendererPolicy';
import { PORTRAIT_BASE_WIDTH, portraitLogicalHeight, setActivePortraitHeight } from './game/layout';

function viewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function installViewportSizing(): void {
  const sync = () => document.documentElement.style.setProperty('--game-viewport-height', `${viewportHeight()}px`);
  sync();
  window.visualViewport?.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
}

async function boot(): Promise<void> {
  installViewportSizing();
  await document.fonts.ready;
  const portrait = currentLayoutMode() === 'portrait';
  const portraitHeight = portraitLogicalHeight(window.innerWidth, viewportHeight());
  if (portrait) setActivePortraitHeight(portraitHeight);
  const useCanvas = shouldUseCanvasRenderer(
    window.location.search,
    readStoredRendererMode(window.sessionStorage),
  );
  const game = new Phaser.Game({
    type: useCanvas ? Phaser.CANVAS : Phaser.AUTO,
    width: portrait ? PORTRAIT_BASE_WIDTH : 1280,
    height: portrait ? portraitHeight : 720,
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
