import { describe, expect, test } from 'vitest';
import { Card } from '../src/core/cards/types';
import { Game } from '../src/core/game';

function key(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function cardOutsideHand(game: Game): Card {
  const hand = new Set(game.hand.map(key));
  return game.deckSnapshot().find((card) => !hand.has(key(card)))!;
}

describe('덱 개조 인장', () => {
  test('새 런은 52장 덱과 인장 0개로 시작한다', () => {
    const game = new Game(101);
    expect(game.deckSize).toBe(52);
    expect(game.deckSnapshot()).toHaveLength(52);
    expect(game.deckSeals).toEqual({ banish: 0, duplicate: 0 });
  });

  test('현재 패 밖의 카드를 추방하면 덱과 인장이 각각 1 줄어든다', () => {
    const game = new Game(102);
    const card = cardOutsideHand(game);
    game.grantDeckSeal('banish');

    expect(game.deckEditStatus('banish', card)).toBe('ready');
    expect(game.applyDeckSeal('banish', card)).toBe(true);
    expect(game.deckSize).toBe(51);
    expect(game.deckCardCount(card)).toBe(0);
    expect(game.deckSeals.banish).toBe(0);
  });

  test('현재 패의 유일한 사본은 추방할 수 없고 인장도 유지된다', () => {
    const game = new Game(103);
    const card = game.hand[0];
    game.grantDeckSeal('banish');

    expect(game.deckEditStatus('banish', card)).toBe('hand_copy_protected');
    expect(game.applyDeckSeal('banish', card)).toBe(false);
    expect(game.deckSize).toBe(52);
    expect(game.deckSeals.banish).toBe(1);
  });

  test('카드를 복제하면 실제 사본 수가 늘고 인장을 소비한다', () => {
    const game = new Game(104);
    const card = game.hand[0];
    game.grantDeckSeal('duplicate');

    expect(game.applyDeckSeal('duplicate', card)).toBe(true);
    expect(game.deckSize).toBe(53);
    expect(game.deckCardCount(card)).toBe(2);
    expect(game.deckSeals.duplicate).toBe(0);
  });

  test('교환 시작·패 확정·전투 중에는 덱을 바꿀 수 없다', () => {
    const exchanged = new Game(105);
    exchanged.grantDeckSeal('duplicate', 3);
    expect(exchanged.doExchange()).toBe(true);
    expect(exchanged.deckEditStatus('duplicate', exchanged.hand[0])).toBe('exchange_started');

    const confirmed = new Game(106);
    confirmed.grantDeckSeal('duplicate');
    confirmed.confirmHand();
    expect(confirmed.deckEditStatus('duplicate', confirmed.hand[0])).toBe('hand_locked');

    const combat = new Game(107);
    combat.grantDeckSeal('duplicate');
    combat.phase = 'combat';
    expect(combat.deckEditStatus('duplicate', combat.hand[0])).toBe('wrong_phase');
  });

  test('인장은 양의 정수만 지급할 수 있다', () => {
    const game = new Game(108);
    expect(() => game.grantDeckSeal('banish', 0)).toThrow('positive integer');
    expect(() => game.grantDeckSeal('banish', 1.5)).toThrow('positive integer');
  });
});
