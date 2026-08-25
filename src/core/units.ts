import { HandRank } from './cards/types';

export interface UnitTraits {
  /** 스플래시 반경 (타일) */
  splash?: number;
  /** 체인 라이트닝: 연쇄 수와 연쇄당 감쇠 배율 */
  chain?: { count: number; decay: number };
  /** 명중 시 슬로우: 감소율(0~1)과 지속(초) */
  slow?: { pct: number; dur: number };
  /** 오라: 반경(타일) 내 다른 아군 공격력 증가율 */
  aura?: { radius: number; dmgPct: number };
  /** 대상 현재 HP 비례 추가 피해 (보스는 별도 비율) */
  execute?: { pct: number; bossPct: number };
  /** 방어형의 피해 감소 무시 */
  ignoreDefense?: boolean;
}

export interface UnitDef {
  tier: HandRank;
  name: string;
  dps: number;
  period: number; // 공격 주기(초)
  range: number;  // 사거리(타일)
  glyph: string;  // 렌더용 글리프 (에셋 대체)
  color: number;  // 렌더용 색 (Phaser hex)
  traits: UnitTraits;
}

/** 기획안 5장 표의 초기값 그대로 */
export const UNIT_DEFS: Record<HandRank, UnitDef> = {
  [HandRank.HighCard]: {
    tier: HandRank.HighCard, name: '견습병', dps: 8, period: 1.0, range: 1.5,
    glyph: '견', color: 0x9aa5b1, traits: {},
  },
  [HandRank.Pair]: {
    tier: HandRank.Pair, name: '궁수', dps: 14, period: 0.8, range: 3.5,
    glyph: '궁', color: 0x7dba6a, traits: {},
  },
  [HandRank.TwoPair]: {
    tier: HandRank.TwoPair, name: '쌍석궁병', dps: 30, period: 0.35, range: 3.0,
    glyph: '쌍', color: 0x4f9e5c, traits: {},
  },
  [HandRank.Trips]: {
    tier: HandRank.Trips, name: '화염술사', dps: 60, period: 1.2, range: 3.0,
    glyph: '화', color: 0xe08a3c, traits: { splash: 0.8 },
  },
  [HandRank.Straight]: {
    tier: HandRank.Straight, name: '저격수', dps: 110, period: 2.5, range: 6.0,
    glyph: '저', color: 0x5a7fd6, traits: { ignoreDefense: true },
  },
  [HandRank.Flush]: {
    tier: HandRank.Flush, name: '빙결술사', dps: 70, period: 1.0, range: 3.5,
    glyph: '빙', color: 0x64c7d8, traits: { slow: { pct: 0.3, dur: 2 } },
  },
  [HandRank.FullHouse]: {
    tier: HandRank.FullHouse, name: '성기사', dps: 160, period: 1.0, range: 2.5,
    glyph: '성', color: 0xe6c84f, traits: { aura: { radius: 2, dmgPct: 0.15 } },
  },
  [HandRank.FourKind]: {
    tier: HandRank.FourKind, name: '드래곤 기수', dps: 350, period: 1.5, range: 4.0,
    glyph: '용', color: 0xd06258, traits: { splash: 1.5 },
  },
  [HandRank.StraightFlush]: {
    tier: HandRank.StraightFlush, name: '대마법사', dps: 800, period: 1.8, range: 5.0,
    glyph: '마', color: 0x9a6ade, traits: { chain: { count: 4, decay: 0.7 } },
  },
  [HandRank.RoyalFlush]: {
    tier: HandRank.RoyalFlush, name: '신룡', dps: 1800, period: 2.0, range: 6.0,
    glyph: '神', color: 0xf2f0e4, traits: { execute: { pct: 0.05, bossPct: 0.02 } },
  },
};

export function damagePerHit(def: UnitDef): number {
  return def.dps * def.period;
}
