export interface UiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PANEL_BOUNDS: UiRect = { x: 780, y: 16, width: 484, height: 688 };

/** 8px 거터를 가진 고정 패널 구획. 텍스트 길이는 각 영역 안에서 줄바꿈한다. */
export const PANEL_SECTIONS = {
  status: { x: 792, y: 26, width: 460, height: 148 },
  economy: { x: 792, y: 182, width: 460, height: 68 },
  unit: { x: 792, y: 258, width: 460, height: 122 },
  controls: { x: 792, y: 388, width: 460, height: 72 },
  powers: { x: 792, y: 468, width: 460, height: 76 },
  relics: { x: 792, y: 552, width: 460, height: 68 },
  help: { x: 792, y: 628, width: 460, height: 64 },
} as const satisfies Record<string, UiRect>;

export const BOSS_HUD_BOUNDS: UiRect = { x: 804, y: 128, width: 436, height: 38 };
export const HAND_PREVIEW_BOUNDS: UiRect = { x: 460, y: 562, width: 296, height: 46 };

export function rectsOverlap(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}
