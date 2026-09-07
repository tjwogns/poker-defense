import { describe, expect, test } from 'vitest';
import {
  attackFxBudget, canCreateTacticFeedback, tacticFeedbackBudget, totalFxBudget,
} from '../src/game/fxBudget';

describe('전투 이펙트 예산', () => {
  test('작은 터치 화면은 동시 이펙트를 줄여 프레임을 보호한다', () => {
    expect(attackFxBudget(true)).toBeLessThan(attackFxBudget(false));
    expect(totalFxBudget(true)).toBeLessThan(totalFxBudget(false));
    expect(tacticFeedbackBudget(true)).toBe(1);
    expect(tacticFeedbackBudget(false)).toBe(2);
  });

  test('전술 라벨은 프레임별이 아니라 현재 살아 있는 tween 수로 동시 상한을 지킨다', () => {
    expect(canCreateTacticFeedback(0, true)).toBe(true);
    expect(canCreateTacticFeedback(1, true)).toBe(false);
    expect(canCreateTacticFeedback(1, false)).toBe(true);
    expect(canCreateTacticFeedback(2, false)).toBe(false);
  });

  test('처치 효과를 포함한 전체 예산은 공격 예산보다 크다', () => {
    expect(totalFxBudget(true)).toBeGreaterThan(attackFxBudget(true));
    expect(totalFxBudget(false)).toBeGreaterThan(attackFxBudget(false));
  });
});
