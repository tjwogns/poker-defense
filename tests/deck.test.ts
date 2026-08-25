import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { newDeck, drawHand, exchange } from '../src/core/cards/deck';

const key = (c: { rank: number; suit: string }) => `${c.rank}${c.suit}`;

describe('rng', () => {
  test('같은 시드는 같은 수열을 만든다', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  test('값은 [0, 1) 범위', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('deck', () => {
  test('새 덱은 52장이고 중복이 없다', () => {
    const deck = newDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck.map(key)).size).toBe(52);
  });

  test('drawHand는 서로 다른 5장을 준다', () => {
    const hand = drawHand(mulberry32(1));
    expect(hand.length).toBe(5);
    expect(new Set(hand.map(key)).size).toBe(5);
  });

  test('같은 시드는 같은 핸드를 준다 (결정론)', () => {
    const a = drawHand(mulberry32(123));
    const b = drawHand(mulberry32(123));
    expect(a.map(key)).toEqual(b.map(key));
  });

  test('exchange는 홀드한 카드를 보존한다', () => {
    const rng = mulberry32(5);
    const hand = drawHand(rng);
    const after = exchange(hand, [true, false, true, false, false], rng);
    expect(key(after[0])).toBe(key(hand[0]));
    expect(key(after[2])).toBe(key(hand[2]));
  });

  test('exchange 결과에 중복 카드가 없고, 버린 카드는 다시 나오지 않는다', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed);
      const hand = drawHand(rng);
      const before = new Set(hand.map(key));
      const after = exchange(hand, [false, false, true, true, true], rng);
      expect(new Set(after.map(key)).size).toBe(5);
      // 교환된 자리(0, 1)의 새 카드는 원래 핸드에 없던 카드여야 한다
      expect(before.has(key(after[0]))).toBe(false);
      expect(before.has(key(after[1]))).toBe(false);
    }
  });
});
