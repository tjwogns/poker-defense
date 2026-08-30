import { HandRank } from '../core/cards/types';

export function unitSpriteExtent(tier: HandRank): number {
  return tier >= HandRank.FullHouse ? 50 : 46;
}

export function unitIntroDuration(tier: HandRank): number {
  return tier >= HandRank.FullHouse ? 420 : 0;
}
