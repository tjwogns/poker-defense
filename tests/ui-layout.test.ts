import { describe, expect, test } from 'vitest';
import {
  BOSS_HUD_BOUNDS,
  HAND_ACTION_BOUNDS,
  HAND_ODDS_BUTTON_BOUNDS,
  HAND_PREVIEW_BOUNDS,
  PANEL_BOUNDS,
  PANEL_SECTIONS,
  PORTRAIT_HEADER_TOAST_LANE,
  getActivePortraitHeight,
  portraitLogicalHeight,
  portraitCoachLayout,
  portraitToastFontSize,
  portraitY,
  rectsOverlap,
  setActivePortraitHeight,
} from '../src/game/layout';
import { HANDBOOK_ROWS } from '../src/game/guideData';
import { HandRank } from '../src/core/cards/types';
import { readFileSync } from 'node:fs';

describe('play UI layout', () => {
  test('기종별 세로 비율을 논리 캔버스 높이에 반영한다', () => {
    expect(portraitLogicalHeight(375, 667)).toBe(720);
    expect(portraitLogicalHeight(360, 740)).toBe(802);
    expect(portraitLogicalHeight(390, 844)).toBe(844);
    expect(portraitLogicalHeight(412, 915)).toBe(866);
    expect(portraitLogicalHeight(430, 932)).toBe(845);
    expect(portraitLogicalHeight(360, 1000)).toBe(920);
  });

  test('기준 세로 좌표가 짧고 긴 화면에 비례해 이동한다', () => {
    expect(portraitY(844, 702)).toBe(702);
    expect(portraitY(720, 702)).toBe(599);
    expect(portraitY(920, 702)).toBe(765);
  });

  test('실행 중 주소창 크기가 바뀌어도 게임 좌표계 높이는 고정한다', () => {
    setActivePortraitHeight(802);
    expect(getActivePortraitHeight()).toBe(802);
    setActivePortraitHeight(1000);
    expect(getActivePortraitHeight()).toBe(920);
    setActivePortraitHeight(844);
  });

  test.each([720, 802, 844, 866, 920])('높이 %i에서 전장·손패·행동 버튼이 겹치지 않는다', (height) => {
    const density = Math.min(1, height / 844);
    const fieldBottom = portraitY(height, 106) + 22 * density * 12;
    const waveTop = portraitY(height, 382);
    const waveBottom = waveTop + 58;
    const cardTop = portraitY(height, 524) - (92 * density) / 2;
    const actionBottom = portraitY(height, 702) + 28;
    const utilityTop = portraitY(height, 769) - 25;
    expect(fieldBottom).toBeLessThanOrEqual(waveTop);
    expect(waveBottom).toBeLessThanOrEqual(cardTop);
    expect(actionBottom).toBeLessThanOrEqual(utilityTop);
  });

  test.each([720, 802, 844, 866, 920])('높이 %i의 상태/토스트 레인은 전장 밖 헤더에 머문다', (height) => {
    const fieldTop = portraitY(height, 106);
    expect(PORTRAIT_HEADER_TOAST_LANE.y).toBeGreaterThanOrEqual(0);
    expect(PORTRAIT_HEADER_TOAST_LANE.y + PORTRAIT_HEADER_TOAST_LANE.height).toBeLessThanOrEqual(48);
    expect(PORTRAIT_HEADER_TOAST_LANE.y + PORTRAIT_HEADER_TOAST_LANE.height).toBeLessThan(fieldTop);
  });

  test.each([720, 802, 844, 866, 920])('높이 %i의 첫 실행 coach는 wave card만 대체한다', (height) => {
    const layout = portraitCoachLayout(height);
    const density = Math.min(1, height / 844);
    const fieldBottom = portraitY(height, 106) + 22 * density * 12;
    const cardTop = portraitY(height, 524) - (92 * density) / 2;
    expect(layout.panel).toEqual({ x: 8, y: portraitY(height, 382), width: 374, height: 58 });
    expect(fieldBottom).toBeLessThanOrEqual(layout.panel.y);
    expect(layout.panel.y + layout.panel.height).toBeLessThanOrEqual(cardTop);
    expect(layout.body.y + layout.body.height).toBeLessThanOrEqual(layout.panel.y + layout.panel.height);
  });

  test('긴 KO/EN toast는 헤더 2줄에 맞는 작은 글꼴을 선택한다', () => {
    expect(portraitToastFontSize('짧은 알림')).toBe(12);
    expect(portraitToastFontSize('ROYAL DECREE · ALL DAMAGE +20% · KILL GOLD +10%')).toBe(10);
    expect(portraitToastFontSize('VERY LONG ENGLISH PORTRAIT TOAST THAT MUST WRAP WITHIN THE SAFE HEADER LANE')).toBe(9);
  });

  test('scene restart는 portrait toast queue를 초기화하고 상태 칩은 의도한 visibility로 복원한다', () => {
    const play = readFileSync(new URL('../src/game/PlayScene.ts', import.meta.url), 'utf8');
    expect(play).toContain('this.portraitToastActive = false;');
    expect(play).toContain('this.portraitToastQueue = [];');
    const panel = readFileSync(new URL('../src/game/SidePanel.ts', import.meta.url), 'utf8');
    expect(panel).toContain('!suppressed && this.wagerStatusVisible');
    expect(panel).toContain('!suppressed && this.tacticStatusVisible');
  });

  test('우측 패널의 모든 섹션은 패널 안에 머문다', () => {
    for (const section of Object.values(PANEL_SECTIONS)) {
      expect(section.x).toBeGreaterThanOrEqual(PANEL_BOUNDS.x);
      expect(section.y).toBeGreaterThanOrEqual(PANEL_BOUNDS.y);
      expect(section.x + section.width).toBeLessThanOrEqual(PANEL_BOUNDS.x + PANEL_BOUNDS.width);
      expect(section.y + section.height).toBeLessThanOrEqual(PANEL_BOUNDS.y + PANEL_BOUNDS.height);
    }
  });

  test('웨이브·지시·경제·빌드·유틸리티 영역은 서로 겹치지 않는다', () => {
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

  test('보스 HUD는 현재 상태 영역 안에 포함되어 필드와 겹치지 않는다', () => {
    const status = PANEL_SECTIONS.status;
    expect(BOSS_HUD_BOUNDS.x).toBeGreaterThanOrEqual(status.x);
    expect(BOSS_HUD_BOUNDS.y).toBeGreaterThanOrEqual(status.y);
    expect(BOSS_HUD_BOUNDS.x + BOSS_HUD_BOUNDS.width).toBeLessThanOrEqual(status.x + status.width);
    expect(BOSS_HUD_BOUNDS.y + BOSS_HUD_BOUNDS.height).toBeLessThanOrEqual(status.y + status.height);
  });

  test('가로 카드 결과 안내는 우측 패널 내부에 머문다', () => {
    expect(HAND_PREVIEW_BOUNDS.x).toBeGreaterThanOrEqual(PANEL_BOUNDS.x);
    expect(HAND_PREVIEW_BOUNDS.x + HAND_PREVIEW_BOUNDS.width).toBeLessThanOrEqual(PANEL_BOUNDS.x + PANEL_BOUNDS.width);
    expect(HAND_PREVIEW_BOUNDS.y).toBeGreaterThanOrEqual(310);
    expect(HAND_PREVIEW_BOUNDS.y + HAND_PREVIEW_BOUNDS.height).toBeLessThanOrEqual(344);
  });

  test('전체 확률 버튼·행동 버튼은 서로 겹치지 않는다', () => {
    expect(rectsOverlap(HAND_ODDS_BUTTON_BOUNDS, HAND_ACTION_BOUNDS)).toBe(false);
    expect(HAND_ODDS_BUTTON_BOUNDS.x).toBeGreaterThanOrEqual(PANEL_BOUNDS.x);
    expect(HAND_ODDS_BUTTON_BOUNDS.x + HAND_ODDS_BUTTON_BOUNDS.width).toBeLessThanOrEqual(PANEL_BOUNDS.x + PANEL_BOUNDS.width);
  });
});

describe('족보·유닛 도감', () => {
  test('모든 족보를 낮은 등급부터 빠짐없이 표시한다', () => {
    expect(HANDBOOK_ROWS).toHaveLength(13);
    expect(HANDBOOK_ROWS.map((row) => row.rank)).toEqual([
      HandRank.HighCard,
      HandRank.Pair,
      HandRank.TwoPair,
      HandRank.Trips,
      HandRank.Straight,
      HandRank.Flush,
      HandRank.FullHouse,
      HandRank.FourKind,
      HandRank.StraightFlush,
      HandRank.RoyalFlush,
      HandRank.FiveKind,
      HandRank.FlushHouse,
      HandRank.FlushFive,
    ]);
    for (const row of HANDBOOK_ROWS) {
      expect(row.hand).not.toBe('');
      expect(row.rule).not.toBe('');
      expect(row.unit).not.toBe('');
      expect(row.trait).not.toBe('');
    }
  });
});
