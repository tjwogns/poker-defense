import { HandRank } from './cards/types';
import { RelicId } from './relics';

const HAND_SCORES: Record<HandRank, number> = {
  [HandRank.HighCard]: 20,
  [HandRank.Pair]: 50,
  [HandRank.TwoPair]: 100,
  [HandRank.Trips]: 200,
  [HandRank.Straight]: 400,
  [HandRank.Flush]: 600,
  [HandRank.FullHouse]: 1000,
  [HandRank.FourKind]: 2000,
  [HandRank.StraightFlush]: 5000,
  [HandRank.RoyalFlush]: 10_000,
  [HandRank.FiveKind]: 15_000,
  [HandRank.FlushHouse]: 20_000,
  [HandRank.FlushFive]: 30_000,
};

export const VICTORY_SCORE = 50_000;

export function scoreForHand(rank: HandRank): number {
  return HAND_SCORES[rank];
}

export function scoreForKills(round: number, count: number): number {
  return round * count * 10;
}

export function scoreForRoundClear(round: number): number {
  return round * 100;
}

export interface RunSummary {
  seed: number;
  result: 'active' | 'victory' | 'defeat';
  score: number;
  round: number;
  kills: number;
  bestHand: HandRank;
  upgradeLevel: number;
  relics: readonly RelicId[];
}
