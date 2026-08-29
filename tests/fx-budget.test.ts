import { describe, expect, test } from 'vitest';
import { attackFxBudget, totalFxBudget } from '../src/game/fxBudget';

describe('전투 이펙트 예산', () => {
  test('작은 터치 화면은 동시 이펙트를 줄여 프레임을 보호한다', () => {
    expect(attackFxBudget(true)).toBeLessThan(attackFxBudget(false));
    expect(totalFxBudget(true)).toBeLessThan(totalFxBudget(false));
  });

  test('처치 효과를 포함한 전체 예산은 공격 예산보다 크다', () => {
    expect(totalFxBudget(true)).toBeGreaterThan(attackFxBudget(true));
    expect(totalFxBudget(false)).toBeGreaterThan(attackFxBudget(false));
  });
});
