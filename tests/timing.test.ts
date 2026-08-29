import { describe, expect, test } from 'vitest';
import {
  MAX_FRAME_DELTA_SECONDS,
  pauseStateAfterFocus,
  safeFrameDelta,
  speedAfterFocus,
} from '../src/game/timing';

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

  test('창 전환으로 자동 정지된 전투는 포커스 복귀 시 재개한다', () => {
    expect(pauseStateAfterFocus(true, true)).toBe(false);
  });

  test('사용자가 직접 정지한 전투는 포커스 복귀 후에도 유지한다', () => {
    expect(pauseStateAfterFocus(true, false)).toBe(true);
  });

  test.each([1, 2, 4])('포커스 이벤트가 중복되어도 선택한 ×%i 배속을 보존한다', (speed) => {
    expect(speedAfterFocus(speed)).toBe(speed);
    expect(speedAfterFocus(speedAfterFocus(speed))).toBe(speed);
  });
});
