import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { rerollOdds } from '../src/core/cards/odds';
import { h } from './helpers';

describe('exact reroll odds', () => {
  test('모두 홀드하면 현재 족보를 100% 유지한다', () => {
    const odds = rerollOdds(h('AS AH 7C 5D 2S'), [true, true, true, true, true]);
    expect(odds.drawCount).toBe(0);
    expect(odds.totalCombinations).toBe(1);
    expect(odds.probabilities[HandRank.Pair]).toBe(1);
    expect(odds.improveProbability).toBe(0);
  });

  test('스페이드 로열 드로우는 에이스 1장으로 1/47 확률이다', () => {
    const odds = rerollOdds(h('TS JS QS KS 2H'), [true, true, true, true, false]);
    expect(odds.drawCount).toBe(1);
    expect(odds.totalCombinations).toBe(47);
    expect(odds.outcomes[HandRank.RoyalFlush]).toBe(1);
    expect(odds.probabilities[HandRank.RoyalFlush]).toBeCloseTo(1 / 47);
  });

  test('아무 카드도 홀드하지 않으면 47장 중 5장 조합을 전부 계산한다', () => {
    const odds = rerollOdds(h('AS KH 9C 5D 2S'), [false, false, false, false, false]);
    expect(odds.totalCombinations).toBe(1_533_939);
    expect(odds.outcomes.reduce((sum, count) => sum + count, 0)).toBe(odds.totalCombinations);
    expect(odds.probabilities.reduce((sum, probability) => sum + probability, 0)).toBeCloseTo(1);
  });

  test('원페어를 홀드하고 3장을 뽑는 분포는 상승 가능성을 포함한다', () => {
    const odds = rerollOdds(h('8S 8H KC 5D 2S'), [true, true, false, false, false]);
    expect(odds.totalCombinations).toBe(16_215);
    expect(odds.improveProbability).toBeGreaterThan(0);
    expect(odds.outcomes[HandRank.TwoPair]).toBeGreaterThan(0);
    expect(odds.outcomes[HandRank.Trips]).toBeGreaterThan(0);
  });
});
