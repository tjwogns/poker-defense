import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import {
  scoreForHand,
  scoreForKills,
  scoreForRoundClear,
  VICTORY_SCORE,
} from '../src/core/scoring';
import { h } from './helpers';

describe('score rules', () => {
  test('처치 점수는 처치 수 × 라운드 × 10이다', () => {
    expect(scoreForKills(7, 3)).toBe(210);
  });

  test('라운드 클리어와 승리는 별도 점수를 지급한다', () => {
    expect(scoreForRoundClear(12)).toBe(1200);
    expect(VICTORY_SCORE).toBe(50_000);
  });

  test('높은 족보일수록 더 큰 확정 점수를 지급한다', () => {
    expect(scoreForHand(HandRank.HighCard)).toBe(20);
    expect(scoreForHand(HandRank.FullHouse)).toBe(1000);
    expect(scoreForHand(HandRank.RoyalFlush)).toBe(10_000);
  });

  test('Game은 족보 점수를 기록하고 요약에 최고 족보를 포함한다', () => {
    const game = new Game(101);
    game.hand = h('KS KH KD 2S 2H');
    game.confirmHand();

    expect(game.score).toBe(1000);
    expect(game.summary()).toMatchObject({
      seed: 101,
      score: 1000,
      bestHand: HandRank.FullHouse,
      round: 1,
      result: 'active',
    });
  });
});
