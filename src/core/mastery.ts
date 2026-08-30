import { HAND_NAMES_KO, HandRank } from './cards/types';
import { mulberry32 } from './rng';

export const HAND_MASTERY_MAX_LEVEL = 5;
export const HAND_MASTERY_DAMAGE_PER_LEVEL = 0.15;

export const MASTERABLE_HANDS = [
  HandRank.HighCard,
  HandRank.Pair,
  HandRank.TwoPair,
  HandRank.Trips,
  HandRank.Straight,
  HandRank.Flush,
  HandRank.FullHouse,
  HandRank.FourKind,
  HandRank.StraightFlush,
  HandRank.RoyalFlush,
] as const;

export type MasterableHandRank = typeof MASTERABLE_HANDS[number];
export type HandMasteryLevels = Record<HandRank, number>;

export const HAND_MASTERY_COSTS: Record<MasterableHandRank, number> = {
  [HandRank.HighCard]: 25,
  [HandRank.Pair]: 30,
  [HandRank.TwoPair]: 40,
  [HandRank.Trips]: 50,
  [HandRank.Straight]: 60,
  [HandRank.Flush]: 70,
  [HandRank.FullHouse]: 80,
  [HandRank.FourKind]: 95,
  [HandRank.StraightFlush]: 115,
  [HandRank.RoyalFlush]: 140,
};

const OFFER_WEIGHTS: Record<MasterableHandRank, number> = {
  [HandRank.HighCard]: 7,
  [HandRank.Pair]: 8,
  [HandRank.TwoPair]: 7,
  [HandRank.Trips]: 6,
  [HandRank.Straight]: 5,
  [HandRank.Flush]: 5,
  [HandRank.FullHouse]: 4,
  [HandRank.FourKind]: 3,
  [HandRank.StraightFlush]: 2,
  [HandRank.RoyalFlush]: 1,
};

export function createHandMasteryLevels(): HandMasteryLevels {
  return Object.fromEntries(
    Array.from({ length: HandRank.FlushFive + 1 }, (_, rank) => [rank, 0]),
  ) as HandMasteryLevels;
}

export function handMasteryCost(rank: MasterableHandRank): number {
  return HAND_MASTERY_COSTS[rank];
}

export function handMasteryMultiplier(levels: HandMasteryLevels, rank: HandRank): number {
  return Math.pow(1 + HAND_MASTERY_DAMAGE_PER_LEVEL, levels[rank] ?? 0);
}

/** 같은 시드와 정비 라운드는 항상 같은 미완성 족보를 진열한다. */
export function handMasteryOffer(
  seed: number,
  round: number,
  levels: HandMasteryLevels,
): MasterableHandRank | null {
  const pool = MASTERABLE_HANDS.filter((rank) => levels[rank] < HAND_MASTERY_MAX_LEVEL);
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, rank) => sum + OFFER_WEIGHTS[rank], 0);
  const rng = mulberry32((seed ^ Math.imul(round, 0x27d4eb2d) ^ 0x165667b1) >>> 0);
  let roll = rng() * total;
  for (const rank of pool) {
    roll -= OFFER_WEIGHTS[rank];
    if (roll < 0) return rank;
  }
  return pool[pool.length - 1];
}

export function handMasteryLabel(rank: HandRank, level: number): string {
  return `${HAND_NAMES_KO[rank]} Lv${level}`;
}
