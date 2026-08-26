import { describe, expect, test } from 'vitest';
import {
  BOSS_HUD_BOUNDS,
  HAND_PREVIEW_BOUNDS,
  PANEL_BOUNDS,
  PANEL_SECTIONS,
  rectsOverlap,
} from '../src/game/layout';

describe('play UI layout', () => {
  test('우측 패널의 모든 섹션은 패널 안에 머문다', () => {
    for (const section of Object.values(PANEL_SECTIONS)) {
      expect(section.x).toBeGreaterThanOrEqual(PANEL_BOUNDS.x);
      expect(section.y).toBeGreaterThanOrEqual(PANEL_BOUNDS.y);
      expect(section.x + section.width).toBeLessThanOrEqual(PANEL_BOUNDS.x + PANEL_BOUNDS.width);
      expect(section.y + section.height).toBeLessThanOrEqual(PANEL_BOUNDS.y + PANEL_BOUNDS.height);
    }
  });

  test('상태·유닛·컨트롤·스킬·유물·도움말 영역은 서로 겹치지 않는다', () => {
    const entries = Object.entries(PANEL_SECTIONS);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        expect(
          rectsOverlap(entries[i][1], entries[j][1]),
          `${entries[i][0]} overlaps ${entries[j][0]}`,
        ).toBe(false);
      }
    }
  });

  test('보스 HUD는 상태 영역 안에 포함되어 필드와 겹치지 않는다', () => {
    const status = PANEL_SECTIONS.status;
    expect(BOSS_HUD_BOUNDS.x).toBeGreaterThanOrEqual(status.x);
    expect(BOSS_HUD_BOUNDS.y).toBeGreaterThanOrEqual(status.y);
    expect(BOSS_HUD_BOUNDS.x + BOSS_HUD_BOUNDS.width).toBeLessThanOrEqual(status.x + status.width);
    expect(BOSS_HUD_BOUNDS.y + BOSS_HUD_BOUNDS.height).toBeLessThanOrEqual(status.y + status.height);
  });

  test('카드 결과 안내는 우측 패널 경계를 침범하지 않는다', () => {
    expect(HAND_PREVIEW_BOUNDS.x + HAND_PREVIEW_BOUNDS.width).toBeLessThanOrEqual(PANEL_BOUNDS.x - 12);
    expect(HAND_PREVIEW_BOUNDS.y + HAND_PREVIEW_BOUNDS.height).toBeLessThanOrEqual(616);
  });
});
