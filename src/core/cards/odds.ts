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

export interface DeckOdds {
  totalCombinations: number;
  outcomes: readonly number[];
  probabilities: readonly number[];
}

export interface DeckEditOdds {
  action: 'banish' | 'duplicate';
  before: DeckOdds;
  after: DeckOdds;
  deltas: readonly number[];
}

export interface DeckEditOddsPair {
  banish: DeckEditOdds;
  duplicate: DeckEditOdds;
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
  const outcomes = Array.from({ length: HandRank.FlushFive + 1 }, () => 0);

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

/** 현재 런 덱에서 뽑는 모든 5장 조합의 정확한 족보 분포. */
export function deckOdds(deck: readonly Card[]): DeckOdds {
  if (deck.length < 5) throw new Error('deck must contain at least 5 cards');
  return countHands(deck, 5);
}

/**
 * 한 장 추방·복제 후 분포를 다시 전수 계산하지 않고, 해당 물리 카드가 포함된
 * 4장 조합만 더하거나 빼서 정확한 변화량을 구한다.
 */
export function deckEditOdds(
  deck: readonly Card[],
  action: 'banish' | 'duplicate',
  card: Card,
  before: DeckOdds = deckOdds(deck),
): DeckEditOdds {
  return deckEditOddsPair(deck, card, before)[action];
}

/** 같은 선택 카드의 추방·복제 예측을 공유 조합으로 한 번에 계산한다. */
export function deckEditOddsPair(
  deck: readonly Card[],
  card: Card,
  before: DeckOdds = deckOdds(deck),
): DeckEditOddsPair {
  const selectedIndex = deck.findIndex(
    (candidate) => candidate.rank === card.rank && candidate.suit === card.suit,
  );
  if (selectedIndex < 0) throw new Error('selected card is missing from deck');

  const pool = [...deck.slice(0, selectedIndex), ...deck.slice(selectedIndex + 1)];
  const removedCardHands = countHands(pool, 4, [card]);
  const doubleCardHands = countHands(pool, 3, [card, card]);
  const addedCardHands = distribution(
    removedCardHands.outcomes.map((count, rank) => count + doubleCardHands.outcomes[rank]),
    removedCardHands.totalCombinations + doubleCardHands.totalCombinations,
  );
  return {
    banish: editDistribution('banish', before, removedCardHands, -1),
    duplicate: editDistribution('duplicate', before, addedCardHands, 1),
  };
}

function result(drawCount: number, currentRank: HandRank, outcomes: number[], total: number): RerollOdds {
  const probabilities = outcomes.map((count) => count / total);
  const improveProbability = probabilities
    .slice(currentRank + 1)
    .reduce((sum, probability) => sum + probability, 0);
  return { drawCount, totalCombinations: total, currentRank, outcomes, probabilities, improveProbability };
}

function countHands(deck: readonly Card[], choose: number, required: readonly Card[] = []): DeckOdds {
  const outcomes = Array.from({ length: HandRank.FlushFive + 1 }, () => 0);
  const rankCounts = new Uint8Array(15);
  const suitCounts = new Uint8Array(4);
  for (const card of required) {
    rankCounts[card.rank]++;
    suitCounts[SUIT_INDEX[card.suit]]++;
  }

  let total = 0;
  const visit = (start: number, depth: number): void => {
    if (depth === choose) {
      outcomes[evaluateCounts(rankCounts, suitCounts)]++;
      total++;
      return;
    }
    const remaining = choose - depth;
    for (let index = start; index <= deck.length - remaining; index++) {
      const card = deck[index];
      rankCounts[card.rank]++;
      suitCounts[SUIT_INDEX[card.suit]]++;
      visit(index + 1, depth + 1);
      rankCounts[card.rank]--;
      suitCounts[SUIT_INDEX[card.suit]]--;
    }
  };
  visit(0, 0);
  return distribution(outcomes, total);
}

function editDistribution(
  action: 'banish' | 'duplicate',
  before: DeckOdds,
  affected: DeckOdds,
  sign: -1 | 1,
): DeckEditOdds {
  const outcomes = before.outcomes.map((count, rank) => count + sign * affected.outcomes[rank]);
  const after = distribution(outcomes, before.totalCombinations + sign * affected.totalCombinations);
  return {
    action,
    before,
    after,
    deltas: after.probabilities.map((probability, rank) => probability - before.probabilities[rank]),
  };
}

function distribution(outcomes: readonly number[], totalCombinations: number): DeckOdds {
  return {
    totalCombinations,
    outcomes: [...outcomes],
    probabilities: outcomes.map((count) => count / totalCombinations),
  };
}

function evaluateCounts(rankCounts: Uint8Array, suitCounts: Uint8Array): HandRank {
  let unique = 0;
  let min = 15;
  let max = 0;
  let pairs = 0;
  let trips = false;
  let four = false;
  let five = false;
  for (let rank = 2; rank <= 14; rank++) {
    const count = rankCounts[rank];
    if (count === 0) continue;
    unique++;
    min = Math.min(min, rank);
    max = Math.max(max, rank);
    if (count === 2) pairs++;
    else if (count === 3) trips = true;
    else if (count === 4) four = true;
    else if (count === 5) five = true;
  }
  const flush = suitCounts.some((count) => count === 5);
  const wheel = unique === 5
    && rankCounts[14] === 1
    && rankCounts[2] === 1
    && rankCounts[3] === 1
    && rankCounts[4] === 1
    && rankCounts[5] === 1;
  const straight = unique === 5 && (max - min === 4 || wheel);
  if (five && flush) return HandRank.FlushFive;
  if (trips && pairs === 1 && flush) return HandRank.FlushHouse;
  if (five) return HandRank.FiveKind;
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
