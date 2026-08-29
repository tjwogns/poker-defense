import { RerollOdds } from '../core/cards/odds';
import { HAND_NAMES_KO, HandRank } from '../core/cards/types';

export interface RerollGuidance {
  title: string;
  decision: string;
  targets: string;
}

export function rerollGuidance(
  odds: RerollOdds,
  formatProbability: (probability: number) => string,
): RerollGuidance {
  const draw = odds.drawCount === 0 ? '교환할 카드 없음' : `${odds.drawCount}장 교환`;
  const improve = formatProbability(odds.improveProbability);
  const recommendation = odds.drawCount === 0
    ? 'HOLD를 풀어 교환 후보 선택'
    : odds.improveProbability >= 0.3
      ? '교환 추천'
      : odds.improveProbability >= 0.12
        ? '골드 여유 시 교환'
        : '지금 확정 추천';
  const targets = odds.probabilities
    .map((probability, rank) => ({ probability, rank: rank as HandRank }))
    .filter((item) => item.rank > odds.currentRank && item.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 2)
    .map((item) => `${HAND_NAMES_KO[item.rank]} ${formatProbability(item.probability)}`)
    .join(' · ');

  return {
    title: `리롤 판단 · ${draw}`,
    decision: `상향 ${improve} → ${recommendation}`,
    targets: targets ? `노림수: ${targets}` : '노림수: 상위 족보 가능성 낮음',
  };
}
