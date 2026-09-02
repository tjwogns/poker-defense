export interface UiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PANEL_BOUNDS: UiRect = { x: 798, y: 68, width: 458, height: 640 };

/** 8px 거터를 가진 고정 패널 구획. 텍스트 길이는 각 영역 안에서 줄바꿈한다. */
export const PANEL_SECTIONS = {
  nextWave: { x: 798, y: 68, width: 458, height: 112 },
  directive: { x: 798, y: 192, width: 458, height: 72 },
  economy: { x: 798, y: 276, width: 458, height: 120 },
  build: { x: 798, y: 408, width: 458, height: 150 },
  utility: { x: 798, y: 570, width: 458, height: 50 },
} as const satisfies Record<string, UiRect>;

export const BOSS_HUD_BOUNDS: UiRect = { x: 812, y: 136, width: 430, height: 36 };
export const HAND_PREVIEW_BOUNDS: UiRect = { x: 472, y: 594, width: 250, height: 30 };
export const HAND_ODDS_SUMMARY_BOUNDS: UiRect = { x: 472, y: 616, width: 172, height: 42 };
export const HAND_ODDS_BUTTON_BOUNDS: UiRect = { x: 650, y: 616, width: 80, height: 42 };
export const HAND_ACTION_BOUNDS: UiRect = { x: 472, y: 658, width: 247, height: 48 };

export const PORTRAIT_LAYOUT = {
  width: 390,
  height: 844,
  hud: { x: 0, y: 44, width: 390, height: 52 },
  field: { x: 8, y: 106, width: 374, height: 264 },
  nextWave: { x: 8, y: 382, width: 374, height: 58 },
  handDividerY: 452,
  handY: 524,
  handSummaryY: 588,
  coach: { x: 8, y: 622, width: 374, height: 36 },
  action: { x: 8, y: 674, width: 374, height: 56 },
  utility: { x: 8, y: 744, width: 374, height: 50 },
  tile: 22,
} as const;

export const PORTRAIT_BASE_WIDTH = 390;
export const PORTRAIT_BASE_HEIGHT = 844;
export const PORTRAIT_MIN_HEIGHT = 720;
export const PORTRAIT_MAX_HEIGHT = 920;

let activePortraitHeight = PORTRAIT_BASE_HEIGHT;

/** 실제 CSS 뷰포트 비율을 보존하되 지나치게 짧거나 긴 캔버스는 안전 범위로 제한한다. */
export function portraitLogicalHeight(viewportWidth: number, viewportHeight: number): number {
  if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0) {
    return PORTRAIT_BASE_HEIGHT;
  }
  const fitted = Math.round(PORTRAIT_BASE_WIDTH * viewportHeight / viewportWidth);
  return Math.max(PORTRAIT_MIN_HEIGHT, Math.min(PORTRAIT_MAX_HEIGHT, fitted));
}

export function setActivePortraitHeight(height: number): void {
  activePortraitHeight = Math.max(PORTRAIT_MIN_HEIGHT, Math.min(PORTRAIT_MAX_HEIGHT, Math.round(height)));
}

export function getActivePortraitHeight(): number {
  return activePortraitHeight;
}

export function portraitScale(height: number): number {
  return height / PORTRAIT_BASE_HEIGHT;
}

/** 390×844 기준 세로 좌표를 현재 논리 캔버스 높이에 맞춘다. */
export function portraitY(height: number, referenceY: number): number {
  return Math.round(referenceY * portraitScale(height));
}

export function portraitSceneHeight(scene: { scale: { height: number } }): number {
  return scene.scale.height || PORTRAIT_BASE_HEIGHT;
}

export function rectsOverlap(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}
