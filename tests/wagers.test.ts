import { describe, expect, test } from 'vitest';
import { Card, HandRank, Suit } from '../src/core/cards/types';
import {
  createRoyalWagerState,
  recordRoyalWagerConfirmation,
  resolveRoyalWager,
  royalWagerOutcome,
  ROYAL_WAGER_IDS,
  ROYAL_WAGERS,
  royalWagerOffers,
  RoyalWagerState,
} from '../src/core/wagers';

const mixed: Card[] = [
  { rank: 2, suit: 'S' }, { rank: 2, suit: 'H' }, { rank: 5, suit: 'D' },
  { rank: 9, suit: 'C' }, { rank: 13, suit: 'S' },
];

describe('royal wagers', () => {
  test('같은 시드는 중복 없는 동일 후보 3개를 만든다', () => {
    const first = royalWagerOffers(719).map(({ id }) => id);
    expect(royalWagerOffers(719).map(({ id }) => id)).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(first.every((id) => ROYAL_WAGER_IDS.includes(id))).toBe(true);
  });

  test('무결한 패는 교환 0회만 세고 R1~R9 및 라운드 중복 경계를 지킨다', () => {
    let state = createRoyalWagerState('pristine_three');
    state = record(state, 0, HandRank.Pair, mixed, 0);
    state = record(state, 1, HandRank.Pair, mixed, 0);
    state = record(state, 1, HandRank.Pair, mixed, 0);
    state = record(state, 2, HandRank.Pair, mixed, 1);
    state = record(state, 9, HandRank.Pair, mixed, 0);
    state = record(state, 10, HandRank.Pair, mixed, 0);
    expect(state.progress).toBe(2);
    expect(state.recordedRounds).toEqual([1, 2, 9]);
  });

  test('페어 수집가는 정확한 원페어만 센다', () => {
    let state = createRoyalWagerState('pair_three');
    state = record(state, 1, HandRank.Pair);
    state = record(state, 2, HandRank.TwoPair);
    state = record(state, 3, HandRank.Pair);
    state = record(state, 4, HandRank.Pair);
    expect(state.progress).toBe(3);
  });

  test('문양의 충성은 첫 유효 대표 문양을 고정하고 같은 문양만 센다', () => {
    const spades = suitedPair('S');
    const hearts = suitedPair('H');
    let state = createRoyalWagerState('suit_four');
    state = record(state, 1, HandRank.Pair, spades, 0, 'S');
    state = record(state, 2, HandRank.Pair, hearts, 0, 'H');
    state = record(state, 3, HandRank.Pair, spades, 0, 'S');
    expect(state.lockedSuit).toBe('S');
    expect(state.progress).toBe(2);
  });

  test('투페어 이상은 하한을 포함하고 상위 족보도 센다', () => {
    let state = createRoyalWagerState('two_pair_two');
    state = record(state, 1, HandRank.Pair);
    state = record(state, 2, HandRank.TwoPair);
    state = record(state, 3, HandRank.FlushFive);
    expect(state.progress).toBe(2);
  });

  test('네 문양은 패에 S/H/D/C가 모두 있어야 한다', () => {
    let state = createRoyalWagerState('four_suits_one');
    state = record(state, 1, HandRank.Pair, mixed);
    expect(state.progress).toBe(1);
  });

  test('스트레이트 이상은 하한을 포함하지만 그 아래 족보는 세지 않는다', () => {
    let state = createRoyalWagerState('straight_one');
    state = record(state, 1, HandRank.Trips);
    state = record(state, 2, HandRank.Straight);
    expect(state.progress).toBe(1);
  });

  test('R10에서 성공 보상을 한 번만 반환하고 실패·미선택은 효과가 없다', () => {
    let success = createRoyalWagerState('pristine_three');
    success = record(success, 1, HandRank.Pair);
    success = record(success, 2, HandRank.Pair);
    success = record(success, 3, HandRank.Pair);
    expect(resolveRoyalWager(success, 9)).toEqual({ state: success, reward: null });

    const first = resolveRoyalWager(success, 10);
    expect(first.reward).toEqual({ kind: 'gold', amount: 35 });
    expect(first.state).toMatchObject({ resolved: true, succeeded: true });
    expect(resolveRoyalWager(first.state, 10).reward).toBeNull();

    const debugJump = resolveRoyalWager(success, 14);
    expect(debugJump).toMatchObject({ reward: { kind: 'gold', amount: 35 }, state: { resolved: true } });

    const failure = resolveRoyalWager(createRoyalWagerState('straight_one'), 10);
    expect(failure).toMatchObject({ reward: null, state: { resolved: true, succeeded: false } });

    const unselected = createRoyalWagerState(null);
    expect(record(unselected, 1, HandRank.RoyalFlush)).toBe(unselected);
    expect(resolveRoyalWager(unselected, 10)).toEqual({ state: unselected, reward: null });
  });

  test('고정 보상과 KO/EN 문구 계약을 노출한다', () => {
    expect(ROYAL_WAGERS.suit_four.reward).toEqual({ kind: 'gold', amount: 40 });
    expect(ROYAL_WAGERS.four_suits_one.reward).toEqual({ kind: 'deck-seal', id: 'duplicate', amount: 1 });
    expect(ROYAL_WAGERS.straight_one.reward).toEqual({ kind: 'deck-seal', id: 'banish', amount: 1 });
    expect(ROYAL_WAGER_IDS.every((id) => ROYAL_WAGERS[id].ko.name && ROYAL_WAGERS[id].en.name)).toBe(true);
  });

  test('R10 이전 종료는 달성 대기와 미완료를 실패로 오표기하지 않는다', () => {
    const unfinished = record(createRoyalWagerState('pristine_three'), 1, HandRank.Pair);
    let achieved = unfinished;
    achieved = record(achieved, 2, HandRank.Pair);
    achieved = record(achieved, 3, HandRank.Pair);
    expect(royalWagerOutcome(createRoyalWagerState(null))).toBe('unselected');
    expect(royalWagerOutcome(unfinished)).toBe('unfinished');
    expect(royalWagerOutcome(achieved)).toBe('achieved-pending');
    expect(royalWagerOutcome(resolveRoyalWager(achieved, 10).state)).toBe('succeeded');
    expect(royalWagerOutcome(resolveRoyalWager(unfinished, 10).state)).toBe('failed');
  });
});

function record(
  state: RoyalWagerState,
  round: number,
  rank: HandRank,
  hand: readonly Card[] = mixed,
  exchangesUsed = 0,
  dominantSuit?: Suit,
): RoyalWagerState {
  return recordRoyalWagerConfirmation(state, { round, rank, hand, exchangesUsed, dominantSuit });
}

function suitedPair(suit: Suit): Card[] {
  const other: Suit[] = (['S', 'H', 'D', 'C'] as Suit[]).filter((candidate) => candidate !== suit);
  return [
    { rank: 7, suit }, { rank: 7, suit }, { rank: 9, suit: other[0] },
    { rank: 11, suit: other[1] }, { rank: 13, suit: other[2] },
  ];
}
