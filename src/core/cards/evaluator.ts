import { Card, HandRank } from './types';

/**
 * 5장의 카드에서 포커 족보를 판정한다.
 * 백스트레이트(A-2-3-4-5)는 스트레이트로 인정, K-A-2-3-4 랩어라운드는 불인정.
 */
export function evaluateHand(cards: Card[]): HandRank {
  if (cards.length !== 5) throw new Error(`hand must be 5 cards, got ${cards.length}`);

  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);

  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const ranks = [...counts.keys()].sort((a, b) => a - b);
  let isStraight = false;
  let isRoyal = false;
  if (ranks.length === 5) {
    if (ranks[4] - ranks[0] === 4) {
      isStraight = true;
      isRoyal = ranks[0] === 10; // 10-J-Q-K-A
    } else if (ranks[0] === 2 && ranks[3] === 5 && ranks[4] === 14) {
      isStraight = true; // 백스트레이트 (A-2-3-4-5)
    }
  }

  const sizes = [...counts.values()].sort((a, b) => b - a);

  if (isStraight && isFlush) return isRoyal ? HandRank.RoyalFlush : HandRank.StraightFlush;
  if (sizes[0] === 4) return HandRank.FourKind;
  if (sizes[0] === 3 && sizes[1] === 2) return HandRank.FullHouse;
  if (isFlush) return HandRank.Flush;
  if (isStraight) return HandRank.Straight;
  if (sizes[0] === 3) return HandRank.Trips;
  if (sizes[0] === 2 && sizes[1] === 2) return HandRank.TwoPair;
  if (sizes[0] === 2) return HandRank.Pair;
  return HandRank.HighCard;
}
