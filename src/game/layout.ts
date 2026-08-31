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

export function rectsOverlap(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}
