import { Card, Suit } from './types';
import { Rng, shuffle } from '../rng';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  return deck;
}

/** 새로 섞은 풀덱에서 5장을 뽑는다 (라운드마다 덱 리셋 = 복원 추출). */
export function drawHand(rng: Rng): Card[] {
  return shuffle(newDeck(), rng).slice(0, 5);
}

/**
 * 비디오 포커식 교환: 홀드하지 않은 카드를 새 카드로 교체.
 * 현재 핸드의 5장(버린 카드 포함)은 같은 교환에서 다시 나오지 않는다.
 */
export function exchange(hand: Card[], holds: boolean[], rng: Rng): Card[] {
  const used = new Set(hand.map((c) => `${c.rank}${c.suit}`));
  const pool = shuffle(newDeck().filter((c) => !used.has(`${c.rank}${c.suit}`)), rng);
  return hand.map((c, i) => (holds[i] ? c : pool.pop()!));
}
