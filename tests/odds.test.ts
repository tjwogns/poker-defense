import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { newDeck } from '../src/core/cards/deck';
import { deckEditOdds, deckOdds, rerollOdds } from '../src/core/cards/odds';
import { h } from './helpers';

describe('exact reroll odds', () => {
  test('모두 홀드하면 현재 족보를 100% 유지한다', () => {
    const odds = rerollOdds(h('AS AH 7C 5D 2S'), [true, true, true, true, true]);
    expect(odds.drawCount).toBe(0);
    expect(odds.totalCombinations).toBe(1);
    expect(odds.probabilities[HandRank.Pair]).toBe(1);
    expect(odds.improveProbability).toBe(0);
  });

  test('스페이드 로열 드로우는 에이스 1장으로 1/47 확률이다', () => {
    const odds = rerollOdds(h('TS JS QS KS 2H'), [true, true, true, true, false]);
    expect(odds.drawCount).toBe(1);
    expect(odds.totalCombinations).toBe(47);
    expect(odds.outcomes[HandRank.RoyalFlush]).toBe(1);
    expect(odds.probabilities[HandRank.RoyalFlush]).toBeCloseTo(1 / 47);
  });

  test('아무 카드도 홀드하지 않으면 47장 중 5장 조합을 전부 계산한다', () => {
    const odds = rerollOdds(h('AS KH 9C 5D 2S'), [false, false, false, false, false]);
    expect(odds.totalCombinations).toBe(1_533_939);
    expect(odds.outcomes.reduce((sum, count) => sum + count, 0)).toBe(odds.totalCombinations);
    expect(odds.probabilities.reduce((sum, probability) => sum + probability, 0)).toBeCloseTo(1);
  });

  test('원페어를 홀드하고 3장을 뽑는 분포는 상승 가능성을 포함한다', () => {
    const odds = rerollOdds(h('8S 8H KC 5D 2S'), [true, true, false, false, false]);
    expect(odds.totalCombinations).toBe(16_215);
    expect(odds.improveProbability).toBeGreaterThan(0);
    expect(odds.outcomes[HandRank.TwoPair]).toBeGreaterThan(0);
    expect(odds.outcomes[HandRank.Trips]).toBeGreaterThan(0);
  });

  test('복제된 실제 카드 장수를 확률 조합에 반영한다', () => {
    const deck = newDeck();
    deck.push({ rank: 14, suit: 'S' });
    const odds = rerollOdds(h('TS JS QS KS 2H'), [true, true, true, true, false], deck);
    expect(odds.totalCombinations).toBe(48);
    expect(odds.outcomes[HandRank.RoyalFlush]).toBe(2);
    expect(odds.probabilities[HandRank.RoyalFlush]).toBeCloseTo(2 / 48);
  });

  test('같은 카드가 손에 여러 장 잡혀도 실제 런 덱 기준으로 계산한다', () => {
    const deck = newDeck();
    deck.push(
      { rank: 14, suit: 'S' },
      { rank: 14, suit: 'S' },
      { rank: 14, suit: 'S' },
      { rank: 14, suit: 'S' },
    );
    const odds = rerollOdds(
      h('AS AS AS AS 4H'),
      [true, true, true, true, false],
      deck,
    );

    expect(odds.drawCount).toBe(1);
    expect(odds.totalCombinations).toBe(51);
    expect(odds.outcomes.reduce((sum, count) => sum + count, 0)).toBe(51);
    expect(odds.outcomes[HandRank.FlushFive]).toBe(1);
  });

  test('복제 덱의 히든 족보를 전체 분포에 포함한다', () => {
    const deck = newDeck();
    deck.push({ rank: 14, suit: 'S' }, { rank: 14, suit: 'S' }, { rank: 14, suit: 'S' }, { rank: 14, suit: 'S' });
    const odds = deckOdds(deck);
    expect(odds.outcomes[HandRank.FlushFive]).toBe(1);
    expect(odds.outcomes[HandRank.FiveKind]).toBeGreaterThan(0);
  });

  test('추방된 카드는 리롤 결과에 등장하지 않는다', () => {
    const deck = newDeck().filter((card) => !(card.rank === 14 && card.suit === 'S'));
    const odds = rerollOdds(h('TS JS QS KS 2H'), [true, true, true, true, false], deck);
    expect(odds.totalCombinations).toBe(46);
    expect(odds.outcomes[HandRank.RoyalFlush]).toBe(0);
  });

  test('런 덱의 전체 5장 족보 분포를 정확히 계산한다', () => {
    const odds = deckOdds(newDeck());
    expect(odds.totalCombinations).toBe(2_598_960);
    expect(odds.outcomes.reduce((sum, count) => sum + count, 0)).toBe(odds.totalCombinations);
    expect(odds.probabilities.reduce((sum, probability) => sum + probability, 0)).toBeCloseTo(1);
  });

  test('추방 미리보기는 실제 재계산 결과와 일치한다', () => {
    const deck = newDeck();
    const card = { rank: 2, suit: 'S' as const };
    const preview = deckEditOdds(deck, 'banish', card);
    const actual = deckOdds(deck.filter((candidate) => (
      candidate.rank !== card.rank || candidate.suit !== card.suit
    )));
    expect(preview.after.totalCombinations).toBe(2_349_060);
    expect(preview.after.outcomes).toEqual(actual.outcomes);
  });

  test('복제 미리보기는 실제 재계산 결과와 일치한다', () => {
    const deck = newDeck();
    const card = { rank: 14, suit: 'S' as const };
    const preview = deckEditOdds(deck, 'duplicate', card);
    const actual = deckOdds([...deck, card]);
    expect(preview.after.totalCombinations).toBe(2_869_685);
    expect(preview.after.outcomes).toEqual(actual.outcomes);
  });
});
