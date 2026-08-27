import { Card, Suit, SUIT_GLYPHS } from './cards/types';

export interface SuitPowerDef {
  suit: Suit;
  name: string;
  description: string;
  glyph: string;
  color: number;
  key: string;
}

export const SUIT_POWER_DEFS: Record<Suit, SuitPowerDef> = {
  S: { suit: 'S', name: '사신의 칼날', description: '일반 적 현재 HP 22% · 보스 6% 피해', glyph: SUIT_GLYPHS.S, color: 0xb9c2d0, key: 'Q' },
  H: { suit: 'H', name: '여왕의 자비', description: '최근 일반 적 최대 6기 퇴장', glyph: SUIT_GLYPHS.H, color: 0xe56b72, key: 'W' },
  D: { suit: 'D', name: '황금비', description: '25 + 라운드×3 골드 즉시 획득', glyph: SUIT_GLYPHS.D, color: 0xe6c84f, key: 'R' },
  C: { suit: 'C', name: '정지 명령', description: '모든 적 3초 기절', glyph: SUIT_GLYPHS.C, color: 0x69c98f, key: 'T' },
};

export interface SuitPowerResult {
  suit: Suit;
  affected: number;
  goldEarned: number;
}

/** 가장 많은 무늬. 동률이면 동률 후보 중 가장 높은 카드의 무늬. */
export function dominantSuit(cards: readonly Card[]): Suit {
  if (cards.length === 0) throw new Error('cards must not be empty');
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of cards) counts[card.suit]++;
  const max = Math.max(...Object.values(counts));
  const candidates = new Set(
    (Object.keys(counts) as Suit[]).filter((suit) => counts[suit] === max),
  );
  return [...cards]
    .sort((a, b) => b.rank - a.rank)
    .find((card) => candidates.has(card.suit))!.suit;
}
