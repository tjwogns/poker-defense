/** 브라우저가 백그라운드에서 돌아온 직후의 거대한 프레임 델타를 버린다. */
export const MAX_FRAME_DELTA_SECONDS = 0.25;

export function safeFrameDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs / 1000, MAX_FRAME_DELTA_SECONDS);
}
