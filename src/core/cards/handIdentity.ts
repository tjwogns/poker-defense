import { Card, HandRank, Suit, SUIT_GLYPHS } from './types';
import { evaluateHand } from './evaluator';

export type HandVariant = 'mountain' | 'back-straight';

export const SUIT_NAMES_KO: Record<Suit, string> = {
  S: '스페이드',
  H: '하트',
  D: '다이아',
  C: '클로버',
};

export const SUIT_TRAIT_LABELS: Record<Suit, string> = {
  S: '보스 피해 +12%',
  H: '공격 속도 +11%',
  D: '처치 시 +1G · 라운드 최대 3G',
  C: '일반 적 피해 +10%',
};

export const SUIT_COLORS: Record<Suit, number> = {
  S: 0x86a9d4,
  H: 0xe06f87,
  D: 0xe3bd55,
  C: 0x6fbd7d,
};

export const HAND_VARIANT_LABELS: Record<HandVariant, string> = {
  mountain: '마운틴',
  'back-straight': '백스트레이트',
};

/** 족보를 실제로 구성하는 카드만 반환한다. 키커는 대표 문양 판정에서 제외한다. */
export function cardsUsedForHand(cards: readonly Card[], rank = evaluateHand([...cards])): Card[] {
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  if (rank === HandRank.HighCard) {
    const highest = Math.max(...cards.map((card) => card.rank));
    return cards.filter((card) => card.rank === highest).slice(0, 1);
  }
  if (rank === HandRank.Pair) return cards.filter((card) => counts.get(card.rank) === 2);
  if (rank === HandRank.TwoPair) return cards.filter((card) => counts.get(card.rank) === 2);
  if (rank === HandRank.Trips) return cards.filter((card) => counts.get(card.rank) === 3);
  if (rank === HandRank.FourKind) return cards.filter((card) => (counts.get(card.rank) ?? 0) >= 4);
  return [...cards];
}

/** 족보 구성 카드에서 가장 많은 문양이 대표 후보가 된다. 동률이면 플레이어가 선택한다. */
export function dominantSuitChoices(cards: readonly Card[], rank = evaluateHand([...cards])): Suit[] {
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of cardsUsedForHand(cards, rank)) counts[card.suit]++;
  const max = Math.max(...Object.values(counts));
  return (Object.keys(counts) as Suit[]).filter((suit) => counts[suit] === max);
}

/** 한국식 명명 변형. 로열 플러시는 기존 독립 족보를 유지한다. */
export function handVariant(cards: readonly Card[], rank: HandRank): HandVariant | null {
  const ranks = [...new Set(cards.map((card) => card.rank))].sort((a, b) => a - b);
  if (ranks.length !== 5) return null;
  if (ranks.join(',') === '2,3,4,5,14') return 'back-straight';
  if (rank === HandRank.Straight && ranks.join(',') === '10,11,12,13,14') return 'mountain';
  return null;
}

export function suitIdentityLabel(suit: Suit | null): string {
  return suit ? `${SUIT_GLYPHS[suit]} ${SUIT_NAMES_KO[suit]}` : '문양 없음';
}

export function variantUnitName(baseName: string, variant: HandVariant | null): string {
  if (variant === 'mountain') return `왕실 ${baseName}`;
  if (variant === 'back-straight') return `선봉 ${baseName}`;
  return baseName;
}

export function suitDamageMultiplier(suit: Suit | null, targetIsBoss: boolean): number {
  if (suit === 'S' && targetIsBoss) return 1.12;
  if (suit === 'C' && !targetIsBoss) return 1.10;
  return 1;
}

export function suitPeriodMultiplier(suit: Suit | null): number {
  return suit === 'H' ? 0.9 : 1;
}

export function variantDamageMultiplier(variant: HandVariant | null): number {
  return variant === 'mountain' ? 1.25 : 1;
}

export function variantPeriodMultiplier(variant: HandVariant | null): number {
  return variant === 'back-straight' ? 0.85 : 1;
}
