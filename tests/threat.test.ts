import { describe, expect, test } from 'vitest';
import { threatBand, threatLabel } from '../src/game/threat';

describe('필드 위험도 표시', () => {
  test('60%와 80% 임계치를 구분한다', () => {
    expect(threatBand(47, 80)).toBe('safe');
    expect(threatBand(48, 80)).toBe('warning');
    expect(threatBand(64, 80)).toBe('critical');
  });

  test('경고 단계에서는 의미가 분명한 한글 라벨을 표시한다', () => {
    expect(threatLabel(26, 80)).toBe('필드 적 26 / 80');
    expect(threatLabel(64, 80)).toBe('⚠ 필드 적 64 / 80');
  });
});
