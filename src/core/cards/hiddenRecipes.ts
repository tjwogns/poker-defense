import { Card, HAND_NAMES_KO, HandRank, Suit } from './types';

export interface HiddenRecipeProgress {
  rank: HandRank.FiveKind | HandRank.FlushHouse | HandRank.FlushFive;
  progress: number;
  missing: number;
  target: Card;
}

const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

/** 현재 런 덱에서 히든 족보별 완성도와 다음 복제 추천을 계산한다. */
export function hiddenRecipeProgress(deck: readonly Card[]): HiddenRecipeProgress[] {
  if (deck.length === 0) return [];
  return [fiveKindProgress(deck), flushHouseProgress(deck), flushFiveProgress(deck)];
}

export function closestHiddenRecipe(deck: readonly Card[]): HiddenRecipeProgress | null {
  return hiddenRecipeProgress(deck)
    .sort((a, b) => a.missing - b.missing || b.progress - a.progress || a.rank - b.rank)[0] ?? null;
}

export function hiddenRecipeLabel(recipe: HiddenRecipeProgress): string {
  return `${HAND_NAMES_KO[recipe.rank]} ${recipe.progress}/5`;
}

function fiveKindProgress(deck: readonly Card[]): HiddenRecipeProgress {
  const counts = new Map<number, number>();
  for (const card of deck) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  const targetRank = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const candidates = deck.filter((card) => card.rank === targetRank).sort(cardPriority);
  const progress = Math.min(5, counts.get(targetRank) ?? 0);
  return {
    rank: HandRank.FiveKind,
    progress,
    missing: 5 - progress,
    target: copyCard(candidates[0]),
  };
}

function flushHouseProgress(deck: readonly Card[]): HiddenRecipeProgress {
  let best: HiddenRecipeProgress | null = null;
  for (const suit of ['S', 'H', 'D', 'C'] as Suit[]) {
    const counts = new Map<number, number>();
    for (const card of deck) {
      if (card.suit === suit) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
    }
    const ranks = [...counts.keys()].sort((a, b) => b - a);
    for (const tripleRank of ranks) {
      for (const pairRank of ranks) {
        if (pairRank === tripleRank) continue;
        const tripleCount = Math.min(3, counts.get(tripleRank) ?? 0);
        const pairCount = Math.min(2, counts.get(pairRank) ?? 0);
        const progress = tripleCount + pairCount;
        const targetRank = tripleCount < 3 ? tripleRank : pairRank;
        const candidate: HiddenRecipeProgress = {
          rank: HandRank.FlushHouse,
          progress,
          missing: 5 - progress,
          target: { rank: targetRank, suit },
        };
        if (!best || betterRecipeCandidate(candidate, best)) best = candidate;
      }
    }
  }
  return best!;
}

function flushFiveProgress(deck: readonly Card[]): HiddenRecipeProgress {
  const counts = new Map<string, { card: Card; count: number }>();
  for (const card of deck) {
    const key = `${card.rank}${card.suit}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { card: copyCard(card), count: 1 });
  }
  const best = [...counts.values()].sort((a, b) => b.count - a.count || cardPriority(a.card, b.card))[0];
  const progress = Math.min(5, best.count);
  return {
    rank: HandRank.FlushFive,
    progress,
    missing: 5 - progress,
    target: copyCard(best.card),
  };
}

function betterRecipeCandidate(candidate: HiddenRecipeProgress, current: HiddenRecipeProgress): boolean {
  if (candidate.progress !== current.progress) return candidate.progress > current.progress;
  return cardPriority(candidate.target, current.target) < 0;
}

function cardPriority(a: Card, b: Card): number {
  return b.rank - a.rank || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
}

function copyCard(card: Card): Card {
  return { rank: card.rank, suit: card.suit };
}
