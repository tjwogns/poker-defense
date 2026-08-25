import type { Card, Suit } from '../src/core/cards/types';

const RANK_MAP: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

/** 'AS KH TD' 형태의 문자열을 Card[]로 변환 (T=10) */
export function h(spec: string): Card[] {
  return spec.split(/\s+/).map((s) => ({
    rank: RANK_MAP[s[0]],
    suit: s[1] as Suit,
  }));
}
