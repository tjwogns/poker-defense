import { HandRank } from '../core/cards/types';

export function unitSpriteExtent(tier: HandRank): number {
  if (tier >= HandRank.FiveKind) return 54;
  return tier >= HandRank.FullHouse ? 50 : 46;
}

export function unitIntroDuration(tier: HandRank): number {
  if (tier >= HandRank.FiveKind) return 560;
  return tier >= HandRank.FullHouse ? 420 : 0;
}
