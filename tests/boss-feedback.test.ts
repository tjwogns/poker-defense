import { describe, expect, test } from 'vitest';
import { bossMechanicStatus } from '../src/game/bossFeedback';

describe('보스 능력 피드백', () => {
  test('황금 폭군과 군단왕은 발동 직전 긴급 경고를 표시한다', () => {
    expect(bossMechanicStatus(40, 1, 1.4)).toMatchObject({ urgent: true });
    expect(bossMechanicStatus(40, 1, 1.4).text).toContain('1.4초');
    expect(bossMechanicStatus(50, 1, 2).urgent).toBe(false);
  });

  test('로열 조커는 HP 절반부터 광폭화 상태를 표시한다', () => {
    expect(bossMechanicStatus(60, 0.51, null).urgent).toBe(false);
    expect(bossMechanicStatus(60, 0.5, null)).toEqual({
      text: '광폭화! · 속도 증가 · 받는 피해 감소', urgent: true,
    });
  });
});
