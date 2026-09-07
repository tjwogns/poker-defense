import { RerollOdds } from '../core/cards/odds';
import { HAND_NAMES_KO, HandRank } from '../core/cards/types';
import { handName, tr } from '../i18n';

export interface RerollGuidance {
  title: string;
  decision: string;
  targets: string;
}

export function rerollGuidance(
  odds: RerollOdds,
  formatProbability: (probability: number) => string,
): RerollGuidance {
  const draw = odds.drawCount === 0 ? tr('교환할 카드 없음', 'No cards to exchange') : tr(`${odds.drawCount}장 교환`, `Exchange ${odds.drawCount}`);
  const improve = formatProbability(odds.improveProbability);
  const recommendation = odds.drawCount === 0
    ? tr('HOLD를 풀어 교환 후보 선택', 'Release HOLD to choose exchange cards')
    : odds.improveProbability >= 0.3
      ? tr('교환 추천', 'Exchange recommended')
      : odds.improveProbability >= 0.12
        ? tr('골드 여유 시 교환', 'Exchange if you can spare the gold')
        : tr('지금 확정 추천', 'Confirm now');
  const targets = odds.probabilities
    .map((probability, rank) => ({ probability, rank: rank as HandRank }))
    .filter((item) => item.rank > odds.currentRank && item.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 2)
    .map((item) => `${handName(item.rank, HAND_NAMES_KO[item.rank])} ${formatProbability(item.probability)}`)
    .join(' · ');

  return {
    title: tr(`리롤 판단 · ${draw}`, `Reroll advice · ${draw}`),
    decision: tr(`상향 ${improve} → ${recommendation}`, `Improve ${improve} → ${recommendation}`),
    targets: targets ? tr(`노림수: ${targets}`, `Targets: ${targets}`) : tr('노림수: 상위 족보 가능성 낮음', 'Targets: low chance of a higher hand'),
  };
}
