import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { evaluateHand } from '../src/core/cards/evaluator';
import { h } from './helpers';

describe('evaluateHand', () => {
  test('로열 스트레이트 플러시', () => {
    expect(evaluateHand(h('AS KS QS JS TS'))).toBe(HandRank.RoyalFlush);
  });

  test('스트레이트 플러시', () => {
    expect(evaluateHand(h('9H 8H 7H 6H 5H'))).toBe(HandRank.StraightFlush);
  });

  test('백스트레이트 플러시(A-2-3-4-5 같은 무늬)는 로열이 아니라 스트레이트 플러시', () => {
    expect(evaluateHand(h('AC 2C 3C 4C 5C'))).toBe(HandRank.StraightFlush);
  });

  test('포카드', () => {
    expect(evaluateHand(h('9S 9H 9D 9C 2S'))).toBe(HandRank.FourKind);
  });

  test('풀하우스', () => {
    expect(evaluateHand(h('KS KH KD 2S 2H'))).toBe(HandRank.FullHouse);
  });

  test('플러시 (스트레이트 아님)', () => {
    expect(evaluateHand(h('AS 8S 6S 4S 2S'))).toBe(HandRank.Flush);
  });

  test('스트레이트 (무늬 섞임)', () => {
    expect(evaluateHand(h('6S 5H 4D 3C 2S'))).toBe(HandRank.Straight);
  });

  test('백스트레이트 (A-2-3-4-5)는 스트레이트로 인정', () => {
    expect(evaluateHand(h('AS 2H 3D 4C 5S'))).toBe(HandRank.Straight);
  });

  test('K-A-2-3-4 랩어라운드는 스트레이트가 아님', () => {
    expect(evaluateHand(h('KS AH 2D 3C 4S'))).toBe(HandRank.HighCard);
  });

  test('트리플', () => {
    expect(evaluateHand(h('QS QH QD 7S 2H'))).toBe(HandRank.Trips);
  });

  test('투페어', () => {
    expect(evaluateHand(h('JS JH 4D 4C 9S'))).toBe(HandRank.TwoPair);
  });

  test('원페어', () => {
    expect(evaluateHand(h('8S 8H KD 5C 2S'))).toBe(HandRank.Pair);
  });

  test('하이카드', () => {
    expect(evaluateHand(h('AS KH 9D 5C 2S'))).toBe(HandRank.HighCard);
  });

  test('A-2-3-4-6은 스트레이트가 아님', () => {
    expect(evaluateHand(h('AS 2H 3D 4C 6S'))).toBe(HandRank.HighCard);
  });
});
