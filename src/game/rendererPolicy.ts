export const CANVAS_SAFE_MODE_KEY = 'poker-defense:renderer-safe-mode';

export function shouldUseCanvasRenderer(search: string, storedMode: string | null): boolean {
  const requested = new URLSearchParams(search).get('renderer');
  if (requested === 'webgl') return false;
  if (requested === 'canvas') return true;
  return storedMode === 'canvas';
}

export function readStoredRendererMode(storage: Storage): string | null {
  try {
    return storage.getItem(CANVAS_SAFE_MODE_KEY);
  } catch {
    return null;
  }
}

export function enableCanvasSafeMode(storage: Storage): void {
  try {
    storage.setItem(CANVAS_SAFE_MODE_KEY, 'canvas');
  } catch {
    // 저장소가 막힌 환경에서도 현재 복구 UI는 계속 동작한다.
  }
}
