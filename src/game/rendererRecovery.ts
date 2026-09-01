import Phaser from 'phaser';
import { enableCanvasSafeMode } from './rendererPolicy';

const RECOVERY_TIMEOUT_MS = 4_000;

interface RecoveryElements {
  root: HTMLElement;
  message: HTMLElement;
  detail: HTMLElement;
  safeMode: HTMLButtonElement;
}

function recoveryElements(): RecoveryElements | null {
  const root = document.getElementById('renderer-recovery');
  const message = document.getElementById('renderer-recovery-message');
  const detail = document.getElementById('renderer-recovery-detail');
  const safeMode = document.getElementById('renderer-safe-mode');
  if (!root || !message || !detail || !(safeMode instanceof HTMLButtonElement)) return null;
  return { root, message, detail, safeMode };
}

/** WebGL이 사라져도 캔버스 밖의 복구 안내와 Canvas 재시작 경로를 유지한다. */
export function installRendererRecovery(game: Phaser.Game): () => void {
  const elements = recoveryElements();
  if (!elements) return () => undefined;

  game.canvas.dataset.renderer = game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas';
  if (game.renderer.type !== Phaser.WEBGL) {
    elements.root.hidden = true;
    return () => undefined;
  }

  const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  let timeout: number | null = null;
  let recovering = false;
  let loopWasRunning = false;

  const clearRecoveryTimeout = (): void => {
    if (timeout === null) return;
    window.clearTimeout(timeout);
    timeout = null;
  };

  const showStalledRecovery = (): void => {
    timeout = null;
    if (!recovering) return;
    elements.message.textContent = '그래픽 장치 자동 복구가 지연되고 있습니다';
    elements.detail.textContent = '안정 모드로 다시 시작하면 WebGL 대신 Canvas를 사용합니다. 현재 진행 중인 판은 종료됩니다.';
    elements.safeMode.hidden = false;
    elements.safeMode.focus();
  };

  const onContextLost = (): void => {
    if (recovering) return;
    recovering = true;
    loopWasRunning = game.loop.running;
    game.loop.sleep();
    elements.root.hidden = false;
    elements.safeMode.hidden = true;
    elements.message.textContent = '그래픽 장치를 복구하는 중입니다';
    elements.detail.textContent = '게임을 잠시 멈췄습니다. 복구되면 자동으로 이어집니다.';
    clearRecoveryTimeout();
    timeout = window.setTimeout(showStalledRecovery, RECOVERY_TIMEOUT_MS);
  };

  const onContextRestored = (): void => {
    if (!recovering) return;
    recovering = false;
    clearRecoveryTimeout();
    elements.root.hidden = true;
    elements.safeMode.hidden = true;
    if (loopWasRunning) game.loop.wake(true);
    window.dispatchEvent(new CustomEvent('poker-defense:renderer-restored'));
  };

  const onSafeMode = (): void => {
    enableCanvasSafeMode(window.sessionStorage);
    window.location.reload();
  };

  renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, onContextLost);
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, onContextRestored);
  elements.safeMode.addEventListener('click', onSafeMode);

  const dispose = (): void => {
    clearRecoveryTimeout();
    renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, onContextLost);
    renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, onContextRestored);
    elements.safeMode.removeEventListener('click', onSafeMode);
  };
  game.events.once(Phaser.Core.Events.DESTROY, dispose);
  return dispose;
}
