import { mulberry32, shuffle } from './rng';

export type RelicId =
  | 'royal_seal'
  | 'war_chest'
  | 'compound_ledger'
  | 'fortified_table'
  | 'swift_shuffle'
  | 'ace_up_sleeve'
  | 'greedy_ledger'
  | 'glass_crown'
  | 'frozen_clover'
  | 'blood_contract';

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
  glyph: string;
  color: number;
}

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  royal_seal: {
    id: 'royal_seal', name: '왕가의 인장', description: '모든 유닛 피해 +12%', glyph: '♛', color: 0xe6c84f,
  },
  war_chest: {
    id: 'war_chest', name: '전쟁 금고', description: '처치 골드 +25%', glyph: '◆', color: 0xd8894a,
  },
  compound_ledger: {
    id: 'compound_ledger', name: '복리 장부', description: '이자 +50%, 상한 +20G', glyph: '₩', color: 0x69c98f,
  },
  fortified_table: {
    id: 'fortified_table', name: '증축 허가증', description: '필드 적 상한 +10', glyph: '▦', color: 0x6ca4d9,
  },
  swift_shuffle: {
    id: 'swift_shuffle', name: '재빠른 손놀림', description: '매 라운드 교환 2회 무료', glyph: '↻', color: 0xb781dc,
  },
  ace_up_sleeve: {
    id: 'ace_up_sleeve', name: '소매 속 에이스', description: '보스 라운드 족보 +1등급', glyph: 'A', color: 0xe86c78,
  },
  greedy_ledger: {
    id: 'greedy_ledger', name: '탐욕의 장부', description: '이자 ×2 · 유료 교환 비용 +50%', glyph: '₲', color: 0xc69a45,
  },
  glass_crown: {
    id: 'glass_crown', name: '유리 왕관', description: '모든 피해 +35% · 적 상한 −15', glyph: '♕', color: 0xe57b77,
  },
  frozen_clover: {
    id: 'frozen_clover', name: '얼어붙은 클로버', description: '♣ 기절 +1.5초 · ♣ 충전 상한 2', glyph: '♣', color: 0x78cde0,
  },
  blood_contract: {
    id: 'blood_contract', name: '피의 계약', description: '♥ 퇴장 대신 전체 현재 HP 피해', glyph: '♥', color: 0xd85c68,
  },
};

export const RELIC_IDS = Object.keys(RELIC_DEFS) as RelicId[];
export const RELIC_SLOT_CAP = 5;

export interface RelicModifiers {
  damageMultiplier: number;
  bountyMultiplier: number;
  interestMultiplier: number;
  interestCapBonus: number;
  fieldCapBonus: number;
  freeExchanges: number;
  bossRankBonus: number;
  exchangeCostMultiplier: number;
  clubStunDuration: number;
  clubChargeCap: number;
  heartStrike: boolean;
}

export function relicChoices(
  seed: number,
  milestone: number,
  owned: readonly RelicId[],
  count = 3,
): RelicId[] {
  const ownedSet = new Set(owned);
  const pool = RELIC_IDS.filter((id) => !ownedSet.has(id));
  const mixedSeed = (seed ^ Math.imul(milestone, 0x9e3779b1)) >>> 0;
  return shuffle(pool, mulberry32(mixedSeed)).slice(0, count);
}

export function relicModifiers(owned: readonly RelicId[]): RelicModifiers {
  const has = (id: RelicId) => owned.includes(id);
  return {
    damageMultiplier: (has('royal_seal') ? 1.12 : 1) * (has('glass_crown') ? 1.35 : 1),
    bountyMultiplier: has('war_chest') ? 1.25 : 1,
    interestMultiplier: (has('compound_ledger') ? 1.5 : 1) * (has('greedy_ledger') ? 2 : 1),
    interestCapBonus: has('compound_ledger') ? 20 : 0,
    fieldCapBonus: (has('fortified_table') ? 10 : 0) - (has('glass_crown') ? 15 : 0),
    freeExchanges: has('swift_shuffle') ? 2 : 1,
    bossRankBonus: has('ace_up_sleeve') ? 1 : 0,
    exchangeCostMultiplier: has('greedy_ledger') ? 1.5 : 1,
    clubStunDuration: has('frozen_clover') ? 4.5 : 3,
    clubChargeCap: has('frozen_clover') ? 2 : 3,
    heartStrike: has('blood_contract'),
  };
}
