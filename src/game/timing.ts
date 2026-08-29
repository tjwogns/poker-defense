/** 브라우저가 백그라운드에서 돌아온 직후의 거대한 프레임 델타를 버린다. */
export const MAX_FRAME_DELTA_SECONDS = 0.25;

export function safeFrameDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs / 1000, MAX_FRAME_DELTA_SECONDS);
}

/** 창 전환이 만든 자동 정지만 해제하고 사용자가 직접 멈춘 상태는 보존한다. */
export function pauseStateAfterFocus(paused: boolean, backgroundPaused: boolean): boolean {
  return backgroundPaused ? false : paused;
}

/** 복귀 이벤트가 중복·역순으로 와도 사용자가 고른 배속은 절대 덮어쓰지 않는다. */
export function speedAfterFocus(selectedSpeed: number): number {
  return selectedSpeed;
}
