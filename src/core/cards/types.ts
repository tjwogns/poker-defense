export type Suit = 'S' | 'H' | 'D' | 'C';

/** rank: 2~14 (J=11, Q=12, K=13, A=14) */
export interface Card {
  rank: number;
  suit: Suit;
}

export enum HandRank {
  HighCard = 0,
  Pair,
  TwoPair,
  Trips,
  Straight,
  Flush,
  FullHouse,
  FourKind,
  StraightFlush,
  RoyalFlush,
}

export const HAND_NAMES_KO: Record<HandRank, string> = {
  [HandRank.HighCard]: '하이카드',
  [HandRank.Pair]: '원페어',
  [HandRank.TwoPair]: '투페어',
  [HandRank.Trips]: '트리플',
  [HandRank.Straight]: '스트레이트',
  [HandRank.Flush]: '플러시',
  [HandRank.FullHouse]: '풀하우스',
  [HandRank.FourKind]: '포카드',
  [HandRank.StraightFlush]: '스트레이트 플러시',
  [HandRank.RoyalFlush]: '로열 스트레이트 플러시',
};

export const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const SUIT_GLYPHS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
