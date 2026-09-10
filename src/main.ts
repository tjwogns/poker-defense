import Phaser from 'phaser';
import { PlayScene } from './game/PlayScene';
import { MenuScene } from './game/MenuScene';
import { BattlefieldScene } from './game/BattlefieldScene';
import { setActiveLayoutMode } from './game/device';
import { installRendererRecovery } from './game/rendererRecovery';
import { readStoredRendererMode, shouldUseCanvasRenderer } from './game/rendererPolicy';
import { setActivePortraitHeight } from './game/layout';
import { viewportCanvasLayout } from './game/viewportLayout';
import { isPixelArtEnabled } from './game/unitAssets';
import { applyDocumentLocale, tr } from './i18n';

function viewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function installViewportSizing(): void {
  const sync = () => document.documentElement.style.setProperty('--game-viewport-height', `${viewportHeight()}px`);
  sync();
  window.visualViewport?.addEventListener('resize', sync);
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
}

async function boot(): Promise<void> {
  applyDocumentLocale();
  installViewportSizing();
  await document.fonts.ready;
  const canvasLayout = viewportCanvasLayout(window.innerWidth, window.innerHeight, viewportHeight());
  setActiveLayoutMode(canvasLayout.mode);
  if (canvasLayout.mode === 'portrait') setActivePortraitHeight(canvasLayout.height);
  const useCanvas = shouldUseCanvasRenderer(
    window.location.search,
    readStoredRendererMode(window.sessionStorage),
  );
  const pixelArtPreview = isPixelArtEnabled(window.location.search);
  const game = new Phaser.Game({
    type: useCanvas ? Phaser.CANVAS : Phaser.AUTO,
    width: canvasLayout.width,
    height: canvasLayout.height,
    parent: 'app',
    backgroundColor: '#0a0a0f',
    roundPixels: pixelArtPreview,
    scene: [MenuScene, PlayScene, BattlefieldScene],
    scale: {
      mode: Phaser.Scale.FIT,
      // #app owns centering (including safe-area padding). Phaser margins would center twice.
      autoCenter: Phaser.Scale.NO_CENTER,
    },
  });

  game.canvas.tabIndex = 0;
  game.canvas.setAttribute('role', 'application');
  game.canvas.setAttribute('aria-label', tr('포커 디펜스 게임 화면', 'Poker Defense game screen'));
  game.canvas.setAttribute('aria-describedby', 'game-instructions');
  installRendererRecovery(game);
}

void boot();
