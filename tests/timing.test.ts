import { describe, expect, test } from 'vitest';
import { MAX_FRAME_DELTA_SECONDS, safeFrameDelta } from '../src/game/timing';

describe('frame timing', () => {
  test('일반 프레임 시간은 초 단위로 변환한다', () => {
    expect(safeFrameDelta(16.67)).toBeCloseTo(0.01667, 5);
  });

  test('알트탭 복귀처럼 큰 델타는 제한한다', () => {
    expect(safeFrameDelta(30_000)).toBe(MAX_FRAME_DELTA_SECONDS);
  });

  test('잘못된 델타는 무시한다', () => {
    expect(safeFrameDelta(-1)).toBe(0);
    expect(safeFrameDelta(Number.NaN)).toBe(0);
  });
});
