import { HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { UNIT_DEFS, UnitDef } from '../core/units';
import { guideRule, handName, tr, unitName } from '../i18n';

const HAND_RULES: Record<HandRank, string> = {
  [HandRank.HighCard]: '어떤 조합도 완성되지 않은 패',
  [HandRank.Pair]: '같은 숫자 2장',
  [HandRank.TwoPair]: '서로 다른 페어 2개',
  [HandRank.Trips]: '같은 숫자 3장',
  [HandRank.Straight]: '연속 숫자 5장 · 마운틴/백스트레이트 포함',
  [HandRank.Flush]: '같은 무늬 5장',
  [HandRank.FullHouse]: '트리플 1개 + 페어 1개',
  [HandRank.FourKind]: '같은 숫자 4장',
  [HandRank.StraightFlush]: '같은 무늬의 연속 숫자 5장',
  [HandRank.RoyalFlush]: '같은 무늬의 10-J-Q-K-A',
  [HandRank.FiveKind]: '같은 숫자 5장 · 복제 필요',
  [HandRank.FlushHouse]: '같은 무늬의 트리플 + 페어',
  [HandRank.FlushFive]: '완전히 같은 카드 5장',
};

export function traitLabel(def: UnitDef): string {
  const trait = def.traits;
  if (trait.splash) return tr(`범위 피해 · 반경 ${trait.splash}칸`, `Area damage · ${trait.splash}-tile radius`);
  if (trait.chain) return tr(`연쇄 공격 · 최대 ${trait.chain.count}기`, `Chain attack · up to ${trait.chain.count} targets`);
  if (trait.slow) return tr(`감속 ${trait.slow.pct * 100}% · ${trait.slow.dur}초`, `Slow ${trait.slow.pct * 100}% · ${trait.slow.dur}s`);
  if (trait.aura) return tr(`주변 아군 공격력 +${trait.aura.dmgPct * 100}%`, `Nearby allies damage +${trait.aura.dmgPct * 100}%`);
  if (trait.execute) return tr('현재 HP 비례 추가 피해', 'Bonus damage based on current HP');
  if (trait.ignoreDefense) return tr('방어력 무시', 'Ignores defense');
  return tr('단일 대상 공격', 'Single-target attack');
}

export interface HandbookRow {
  rank: HandRank;
  hand: string;
  rule: string;
  unit: string;
  trait: string;
}

const HANDBOOK_RANKS = Object.values(HandRank)
  .filter((value): value is HandRank => typeof value === 'number');

export function handbookRows(): HandbookRow[] {
  return HANDBOOK_RANKS.map((rank) => ({
    rank,
    hand: handName(rank, HAND_NAMES_KO[rank]),
    rule: guideRule(rank, HAND_RULES[rank]),
    unit: unitName(rank, UNIT_DEFS[rank].name),
    trait: traitLabel(UNIT_DEFS[rank]),
  }));
}

/** @deprecated Prefer handbookRows() so locale is resolved at render time. */
export const HANDBOOK_ROWS: HandbookRow[] = HANDBOOK_RANKS.map((rank) => ({
  rank,
  get hand() { return handName(rank, HAND_NAMES_KO[rank]); },
  get rule() { return guideRule(rank, HAND_RULES[rank]); },
  get unit() { return unitName(rank, UNIT_DEFS[rank].name); },
  get trait() { return traitLabel(UNIT_DEFS[rank]); },
}));
