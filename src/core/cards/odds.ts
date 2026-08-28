import { newDeck, remainingCards } from './deck';
import { evaluateHand } from './evaluator';
import { Card, HandRank, Suit } from './types';

export interface RerollOdds {
  drawCount: number;
  totalCombinations: number;
  currentRank: HandRank;
  outcomes: readonly number[];
  probabilities: readonly number[];
  improveProbability: number;
}

const SUIT_INDEX: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

/** 현재 패 5장을 제외한 47장에서 비홀드 카드를 다시 뽑는 정확한 족보 분포. */
export function rerollOdds(
  hand: readonly Card[],
  holds: readonly boolean[],
  deck: readonly Card[] = newDeck(),
): RerollOdds {
  if (hand.length !== 5 || holds.length !== 5) throw new Error('hand and holds must contain 5 items');
  const drawCount = holds.filter((held) => !held).length;
  const currentRank = evaluateHand([...hand]);
  const outcomes = Array.from({ length: HandRank.RoyalFlush + 1 }, () => 0);

  if (drawCount === 0) {
    outcomes[currentRank] = 1;
    return result(drawCount, currentRank, outcomes, 1);
  }

  const pool = remainingCards(deck, hand);
  const rankCounts = new Uint8Array(15);
  const suitCounts = new Uint8Array(4);
  for (let index = 0; index < hand.length; index++) {
    if (!holds[index]) continue;
    rankCounts[hand[index].rank]++;
    suitCounts[SUIT_INDEX[hand[index].suit]]++;
  }

  let total = 0;
  const visit = (start: number, depth: number): void => {
    if (depth === drawCount) {
      outcomes[evaluateCounts(rankCounts, suitCounts)]++;
      total++;
      return;
    }
    const remaining = drawCount - depth;
    for (let index = start; index <= pool.length - remaining; index++) {
      const card = pool[index];
      rankCounts[card.rank]++;
      suitCounts[SUIT_INDEX[card.suit]]++;
      visit(index + 1, depth + 1);
      rankCounts[card.rank]--;
      suitCounts[SUIT_INDEX[card.suit]]--;
    }
  };
  visit(0, 0);
  return result(drawCount, currentRank, outcomes, total);
}

function result(drawCount: number, currentRank: HandRank, outcomes: number[], total: number): RerollOdds {
  const probabilities = outcomes.map((count) => count / total);
  const improveProbability = probabilities
    .slice(currentRank + 1)
    .reduce((sum, probability) => sum + probability, 0);
  return { drawCount, totalCombinations: total, currentRank, outcomes, probabilities, improveProbability };
}

function evaluateCounts(rankCounts: Uint8Array, suitCounts: Uint8Array): HandRank {
  let unique = 0;
  let min = 15;
  let max = 0;
  let pairs = 0;
  let trips = false;
  let four = false;
  for (let rank = 2; rank <= 14; rank++) {
    const count = rankCounts[rank];
    if (count === 0) continue;
    unique++;
    min = Math.min(min, rank);
    max = Math.max(max, rank);
    if (count === 2) pairs++;
    else if (count === 3) trips = true;
    else if (count === 4) four = true;
  }
  const flush = suitCounts.some((count) => count === 5);
  const wheel = unique === 5
    && rankCounts[14] === 1
    && rankCounts[2] === 1
    && rankCounts[3] === 1
    && rankCounts[4] === 1
    && rankCounts[5] === 1;
  const straight = unique === 5 && (max - min === 4 || wheel);
  if (straight && flush) return min === 10 ? HandRank.RoyalFlush : HandRank.StraightFlush;
  if (four) return HandRank.FourKind;
  if (trips && pairs === 1) return HandRank.FullHouse;
  if (flush) return HandRank.Flush;
  if (straight) return HandRank.Straight;
  if (trips) return HandRank.Trips;
  if (pairs === 2) return HandRank.TwoPair;
  if (pairs === 1) return HandRank.Pair;
  return HandRank.HighCard;
}
