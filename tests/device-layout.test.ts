import { describe, expect, test } from 'vitest';
import { compactTouchLayout, layoutMode } from '../src/game/device';

describe('compact touch layout', () => {
  test('S26급 가로 터치 화면은 큰 터치 컨트롤을 사용한다', () => {
    expect(compactTouchLayout(780, 360, true)).toBe(true);
  });

  test('데스크톱과 마우스 환경은 기존 밀도를 유지한다', () => {
    expect(compactTouchLayout(1280, 720, false)).toBe(false);
    expect(compactTouchLayout(1280, 720, true)).toBe(false);
  });

  test('390×844 휴대폰은 세로 게임 레이아웃을 사용한다', () => {
    expect(layoutMode(390, 844)).toBe('portrait');
    expect(layoutMode(412, 915)).toBe('portrait');
  });

  test('지원 가능한 가로와 너무 작은 화면을 구분한다', () => {
    expect(layoutMode(844, 390)).toBe('landscape');
    expect(layoutMode(359, 780)).toBe('gate');
  });
});
