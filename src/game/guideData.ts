import { HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { UNIT_DEFS, UnitDef } from '../core/units';

const HAND_RULES: Record<HandRank, string> = {
  [HandRank.HighCard]: '어떤 조합도 완성되지 않은 패',
  [HandRank.Pair]: '같은 숫자 2장',
  [HandRank.TwoPair]: '서로 다른 페어 2개',
  [HandRank.Trips]: '같은 숫자 3장',
  [HandRank.Straight]: '연속 숫자 5장 (A-2-3-4-5 포함)',
  [HandRank.Flush]: '같은 무늬 5장',
  [HandRank.FullHouse]: '트리플 1개 + 페어 1개',
  [HandRank.FourKind]: '같은 숫자 4장',
  [HandRank.StraightFlush]: '같은 무늬의 연속 숫자 5장',
  [HandRank.RoyalFlush]: '같은 무늬의 10-J-Q-K-A',
};

function traitLabel(def: UnitDef): string {
  const trait = def.traits;
  if (trait.splash) return `범위 피해 · 반경 ${trait.splash}칸`;
  if (trait.chain) return `연쇄 공격 · 최대 ${trait.chain.count}기`;
  if (trait.slow) return `감속 ${trait.slow.pct * 100}% · ${trait.slow.dur}초`;
  if (trait.aura) return `주변 아군 공격력 +${trait.aura.dmgPct * 100}%`;
  if (trait.execute) return '현재 HP 비례 추가 피해';
  if (trait.ignoreDefense) return '방어력 무시';
  return '단일 대상 공격';
}

export interface HandbookRow {
  rank: HandRank;
  hand: string;
  rule: string;
  unit: string;
  trait: string;
}

export const HANDBOOK_ROWS: HandbookRow[] = Object.values(HandRank)
  .filter((value): value is HandRank => typeof value === 'number')
  .map((rank) => ({
    rank,
    hand: HAND_NAMES_KO[rank],
    rule: HAND_RULES[rank],
    unit: UNIT_DEFS[rank].name,
    trait: traitLabel(UNIT_DEFS[rank]),
  }));
