import { describe, expect, test } from 'vitest';
import {
  BOSS_HUD_BOUNDS,
  HAND_ACTION_BOUNDS,
  HAND_ODDS_BUTTON_BOUNDS,
  HAND_ODDS_SUMMARY_BOUNDS,
  HAND_PREVIEW_BOUNDS,
  PANEL_BOUNDS,
  PANEL_SECTIONS,
  getActivePortraitHeight,
  portraitLogicalHeight,
  portraitY,
  rectsOverlap,
  setActivePortraitHeight,
} from '../src/game/layout';
import { HANDBOOK_ROWS } from '../src/game/guideData';
import { HandRank } from '../src/core/cards/types';

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

  test('보스 HUD는 다음 웨이브 영역 안에 포함되어 필드와 겹치지 않는다', () => {
    const nextWave = PANEL_SECTIONS.nextWave;
    expect(BOSS_HUD_BOUNDS.x).toBeGreaterThanOrEqual(nextWave.x);
    expect(BOSS_HUD_BOUNDS.y).toBeGreaterThanOrEqual(nextWave.y);
    expect(BOSS_HUD_BOUNDS.x + BOSS_HUD_BOUNDS.width).toBeLessThanOrEqual(nextWave.x + nextWave.width);
    expect(BOSS_HUD_BOUNDS.y + BOSS_HUD_BOUNDS.height).toBeLessThanOrEqual(nextWave.y + nextWave.height);
  });

  test('카드 결과 안내는 우측 패널 경계를 침범하지 않는다', () => {
    expect(HAND_PREVIEW_BOUNDS.x + HAND_PREVIEW_BOUNDS.width).toBeLessThanOrEqual(PANEL_BOUNDS.x - 12);
    expect(HAND_PREVIEW_BOUNDS.y).toBeGreaterThanOrEqual(582);
    expect(HAND_PREVIEW_BOUNDS.y + HAND_PREVIEW_BOUNDS.height).toBeLessThanOrEqual(708);
  });

  test('리롤 요약·전체 확률 버튼·행동 버튼은 서로 겹치지 않는다', () => {
    expect(rectsOverlap(HAND_ODDS_SUMMARY_BOUNDS, HAND_ODDS_BUTTON_BOUNDS)).toBe(false);
    expect(rectsOverlap(HAND_ODDS_SUMMARY_BOUNDS, HAND_ACTION_BOUNDS)).toBe(false);
    expect(rectsOverlap(HAND_ODDS_BUTTON_BOUNDS, HAND_ACTION_BOUNDS)).toBe(false);
    expect(HAND_ODDS_BUTTON_BOUNDS.x + HAND_ODDS_BUTTON_BOUNDS.width).toBeLessThan(PANEL_BOUNDS.x);
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
