import { describe, expect, test } from 'vitest';
import { compactTouchLayout } from '../src/game/device';

describe('compact touch layout', () => {
  test('S26급 가로 터치 화면은 큰 터치 컨트롤을 사용한다', () => {
    expect(compactTouchLayout(780, 360, true)).toBe(true);
  });

  test('데스크톱과 마우스 환경은 기존 밀도를 유지한다', () => {
    expect(compactTouchLayout(1280, 720, false)).toBe(false);
    expect(compactTouchLayout(1280, 720, true)).toBe(false);
  });
});
