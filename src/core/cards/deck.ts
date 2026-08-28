import { Card, Suit } from './types';
import { Rng, shuffle } from '../rng';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const MIN_RUN_DECK_SIZE = 40;
export const MAX_RUN_DECK_SIZE = 60;

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  return deck;
}

/** 새로 섞은 풀덱에서 5장을 뽑는다 (라운드마다 덱 리셋 = 복원 추출). */
export function drawHand(rng: Rng, deck: readonly Card[] = newDeck()): Card[] {
  if (deck.length < 5) throw new Error('deck must contain at least 5 cards');
  return shuffle(deck.map(copyCard), rng).slice(0, 5);
}

/**
 * 비디오 포커식 교환: 홀드하지 않은 카드를 새 카드로 교체.
 * 현재 핸드의 5장(버린 카드 포함)은 같은 교환에서 다시 나오지 않는다.
 */
export function exchange(
  hand: Card[],
  holds: boolean[],
  rng: Rng,
  deck: readonly Card[] = newDeck(),
): Card[] {
  if (hand.length !== 5 || holds.length !== 5) throw new Error('hand and holds must contain 5 items');
  const pool = shuffle(remainingCards(deck, hand), rng);
  const drawCount = holds.filter((held) => !held).length;
  if (pool.length < drawCount) throw new Error('deck does not contain enough exchange cards');
  return hand.map((c, i) => (holds[i] ? c : pool.pop()!));
}

/** 실제 카드 장수 기준으로 hand의 각 사본을 덱에서 한 장씩 제외한다. */
export function remainingCards(deck: readonly Card[], hand: readonly Card[]): Card[] {
  const remaining = deck.map(copyCard);
  for (const used of hand) {
    const index = remaining.findIndex((card) => sameCard(card, used));
    if (index < 0) throw new Error(`hand card is missing from deck: ${used.rank}${used.suit}`);
    remaining.splice(index, 1);
  }
  return remaining;
}

/** v2 런 동안 유지되는 덱 원본. 매 라운드에는 이 구성에서 복원 추출한다. */
export class RunDeck {
  private cards: Card[];

  constructor(cards: readonly Card[] = newDeck()) {
    if (cards.length < MIN_RUN_DECK_SIZE || cards.length > MAX_RUN_DECK_SIZE) {
      throw new Error(`run deck size must be ${MIN_RUN_DECK_SIZE}..${MAX_RUN_DECK_SIZE}`);
    }
    this.cards = cards.map(copyCard);
  }

  get size(): number {
    return this.cards.length;
  }

  snapshot(): Card[] {
    return this.cards.map(copyCard);
  }

  count(card: Card): number {
    return this.cards.filter((candidate) => sameCard(candidate, card)).length;
  }

  draw(rng: Rng): Card[] {
    return drawHand(rng, this.cards);
  }

  exchange(hand: Card[], holds: boolean[], rng: Rng): Card[] {
    return exchange(hand, holds, rng, this.cards);
  }

  banish(card: Card): boolean {
    if (this.cards.length <= MIN_RUN_DECK_SIZE) return false;
    const index = this.cards.findIndex((candidate) => sameCard(candidate, card));
    if (index < 0) return false;
    this.cards.splice(index, 1);
    return true;
  }

  duplicate(card: Card): boolean {
    if (this.cards.length >= MAX_RUN_DECK_SIZE || this.count(card) === 0) return false;
    this.cards.push(copyCard(card));
    return true;
  }
}

function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

function copyCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}
