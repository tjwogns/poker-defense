import { dominantSuitChoices } from './cards/handIdentity';
import { Card, HandRank, Suit } from './cards/types';
import type { DeckSealId } from './game';
import { mulberry32, shuffle } from './rng';

export const ROYAL_WAGER_IDS = [
  'pristine_three',
  'pair_three',
  'suit_four',
  'two_pair_two',
  'four_suits_one',
  'straight_one',
] as const;

export type RoyalWagerId = typeof ROYAL_WAGER_IDS[number];

export type RoyalWagerReward =
  | { kind: 'gold'; amount: 30 | 35 | 40 }
  | { kind: 'deck-seal'; id: DeckSealId; amount: 1 };

export interface RoyalWagerCopy {
  name: string;
  description: string;
}

export interface RoyalWagerDefinition {
  id: RoyalWagerId;
  target: number;
  reward: RoyalWagerReward;
  ko: RoyalWagerCopy;
  en: RoyalWagerCopy;
}

export const ROYAL_WAGERS: Record<RoyalWagerId, RoyalWagerDefinition> = {
  pristine_three: {
    id: 'pristine_three', target: 3, reward: { kind: 'gold', amount: 35 },
    ko: { name: '무결한 패', description: '교환 없이 패를 3회 확정' },
    en: { name: 'Pristine Hands', description: 'Confirm 3 hands without exchanging' },
  },
  pair_three: {
    id: 'pair_three', target: 3, reward: { kind: 'gold', amount: 35 },
    ko: { name: '페어 수집가', description: '원페어를 정확히 3회 확정' },
    en: { name: 'Pair Collector', description: 'Confirm exactly One Pair 3 times' },
  },
  suit_four: {
    id: 'suit_four', target: 4, reward: { kind: 'gold', amount: 40 },
    ko: { name: '문양의 충성', description: '처음 정한 대표 문양으로 패를 4회 확정' },
    en: { name: 'Suit Allegiance', description: 'Confirm 4 hands with the first locked dominant suit' },
  },
  two_pair_two: {
    id: 'two_pair_two', target: 2, reward: { kind: 'gold', amount: 30 },
    ko: { name: '쌍의 행진', description: '투페어 이상을 2회 확정' },
    en: { name: 'March of Pairs', description: 'Confirm Two Pair or better twice' },
  },
  four_suits_one: {
    id: 'four_suits_one', target: 1, reward: { kind: 'deck-seal', id: 'duplicate', amount: 1 },
    ko: { name: '네 문양', description: '네 문양이 모두 든 패를 1회 확정' },
    en: { name: 'Four Suits', description: 'Confirm a hand containing all four suits' },
  },
  straight_one: {
    id: 'straight_one', target: 1, reward: { kind: 'deck-seal', id: 'banish', amount: 1 },
    ko: { name: '왕도', description: '스트레이트 이상을 1회 확정' },
    en: { name: 'The Royal Road', description: 'Confirm a Straight or better' },
  },
};

export interface RoyalWagerState {
  selectedId: RoyalWagerId | null;
  progress: number;
  lockedSuit: Suit | null;
  recordedRounds: readonly number[];
  resolved: boolean;
  succeeded: boolean;
}

export interface RoyalWagerConfirmation {
  round: number;
  hand: readonly Card[];
  rank: HandRank;
  exchangesUsed: number;
  /** 대표 문양 동률일 때 플레이어가 선택한 문양. */
  dominantSuit?: Suit | null;
}

export interface RoyalWagerResolution {
  state: RoyalWagerState;
  reward: RoyalWagerReward | null;
}

export type RoyalWagerOutcome = 'unselected' | 'unfinished' | 'achieved-pending' | 'succeeded' | 'failed';

export function royalWagerOutcome(state: RoyalWagerState): RoyalWagerOutcome {
  if (state.selectedId === null) return 'unselected';
  if (state.resolved) return state.succeeded ? 'succeeded' : 'failed';
  return state.progress >= ROYAL_WAGERS[state.selectedId].target ? 'achieved-pending' : 'unfinished';
}

/** 같은 런 시드는 언제나 중복 없는 동일한 3개 후보를 만든다. */
export function royalWagerOffers(seed: number): RoyalWagerDefinition[] {
  const rng = mulberry32((seed ^ 0x524f594c) >>> 0);
  return shuffle([...ROYAL_WAGER_IDS], rng).slice(0, 3).map((id) => ROYAL_WAGERS[id]);
}

export function createRoyalWagerState(selectedId: RoyalWagerId | null): RoyalWagerState {
  return {
    selectedId,
    progress: 0,
    lockedSuit: null,
    recordedRounds: [],
    resolved: false,
    succeeded: false,
  };
}

/** R1~R9의 패 확정만 기록하며, 같은 라운드는 한 번만 집계한다. */
export function recordRoyalWagerConfirmation(
  state: RoyalWagerState,
  input: RoyalWagerConfirmation,
): RoyalWagerState {
  if (
    state.selectedId === null
    || state.resolved
    || !Number.isInteger(input.round)
    || input.round < 1
    || input.round > 9
    || state.recordedRounds.includes(input.round)
    || input.hand.length !== 5
  ) return state;

  const definition = ROYAL_WAGERS[state.selectedId];
  let lockedSuit = state.lockedSuit;
  let qualifies = false;

  switch (state.selectedId) {
    case 'pristine_three':
      qualifies = input.exchangesUsed === 0;
      break;
    case 'pair_three':
      qualifies = input.rank === HandRank.Pair;
      break;
    case 'suit_four': {
      const dominantSuit = validDominantSuit(input);
      if (dominantSuit && lockedSuit === null) lockedSuit = dominantSuit;
      qualifies = dominantSuit !== null && dominantSuit === lockedSuit;
      break;
    }
    case 'two_pair_two':
      qualifies = input.rank >= HandRank.TwoPair;
      break;
    case 'four_suits_one':
      qualifies = new Set(input.hand.map((card) => card.suit)).size === 4;
      break;
    case 'straight_one':
      qualifies = input.rank >= HandRank.Straight;
      break;
  }

  return {
    ...state,
    progress: qualifies ? Math.min(definition.target, state.progress + 1) : state.progress,
    lockedSuit,
    recordedRounds: [...state.recordedRounds, input.round],
  };
}

/** R10 이상 최초 진입 시 딱 한 번 정산한다. 디버그 점프도 놓치지 않는다. */
export function resolveRoyalWager(state: RoyalWagerState, enteringRound: number): RoyalWagerResolution {
  if (state.selectedId === null || state.resolved || enteringRound < 10) {
    return { state, reward: null };
  }
  const definition = ROYAL_WAGERS[state.selectedId];
  const succeeded = state.progress >= definition.target;
  const resolved = { ...state, resolved: true, succeeded };
  return { state: resolved, reward: succeeded ? definition.reward : null };
}

function validDominantSuit(input: RoyalWagerConfirmation): Suit | null {
  const choices = dominantSuitChoices(input.hand, input.rank);
  if (input.dominantSuit && choices.includes(input.dominantSuit)) return input.dominantSuit;
  return choices.length === 1 ? choices[0] : null;
}
