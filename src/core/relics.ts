import { HandRank } from './cards/types';
import type { Enemy, Field, Unit } from './combat';
import { distanceToPathTiles } from './map';
import { mulberry32, shuffle } from './rng';

export type RelicRarity = 'common' | 'rare' | 'legendary';

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
  | 'blood_contract'
  | 'underdog_banner'
  | 'royal_bloodline'
  | 'rear_position'
  | 'pristine_oath'
  | 'pair_broker'
  | 'four_suit_crest'
  | 'delay_tactics'
  | 'compression_enthusiast';

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
  glyph: string;
  color: number;
  rarity: RelicRarity;
}

export const RELIC_RARITY_LABELS: Record<RelicRarity, string> = {
  common: '일반', rare: '희귀', legendary: '전설',
};
export const RELIC_RARITY_COLORS: Record<RelicRarity, number> = {
  common: 0x7f9b8a, rare: 0x9f74cf, legendary: 0xe6c84f,
};
export const RELIC_BUY_PRICES: Record<RelicRarity, number> = {
  common: 45, rare: 90, legendary: 160,
};
export const RELIC_SELL_PRICES: Record<RelicRarity, number> = {
  common: 20, rare: 45, legendary: 80,
};

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  royal_seal: {
    id: 'royal_seal', name: '왕가의 인장', description: '모든 유닛 피해 +12%', glyph: '♛', color: 0xe6c84f, rarity: 'common',
  },
  war_chest: {
    id: 'war_chest', name: '전쟁 금고', description: '처치 골드 +25%', glyph: '◆', color: 0xd8894a, rarity: 'common',
  },
  compound_ledger: {
    id: 'compound_ledger', name: '복리 장부', description: '이자 +50%, 상한 +20G', glyph: '₩', color: 0x69c98f, rarity: 'rare',
  },
  fortified_table: {
    id: 'fortified_table', name: '증축 허가증', description: '필드 적 상한 +10', glyph: '▦', color: 0x6ca4d9, rarity: 'common',
  },
  swift_shuffle: {
    id: 'swift_shuffle', name: '재빠른 손놀림', description: '매 라운드 교환 2회 무료', glyph: '↻', color: 0xb781dc, rarity: 'common',
  },
  ace_up_sleeve: {
    id: 'ace_up_sleeve', name: '소매 속 에이스', description: '보스 라운드 족보 +1등급', glyph: 'A', color: 0xe86c78, rarity: 'rare',
  },
  greedy_ledger: {
    id: 'greedy_ledger', name: '탐욕의 장부', description: '이자 ×2 · 유료 교환 비용 +50%', glyph: '₲', color: 0xc69a45, rarity: 'rare',
  },
  glass_crown: {
    id: 'glass_crown', name: '유리 왕관', description: '모든 피해 +35% · 적 상한 −15', glyph: '♕', color: 0xe57b77, rarity: 'legendary',
  },
  frozen_clover: {
    id: 'frozen_clover', name: '얼어붙은 클로버', description: '♣ 기절 +1.5초 · ♣ 충전 상한 2', glyph: '♣', color: 0x78cde0, rarity: 'rare',
  },
  blood_contract: {
    id: 'blood_contract', name: '피의 계약', description: '♥ 퇴장 대신 전체 현재 HP 피해', glyph: '♥', color: 0xd85c68, rarity: 'rare',
  },
  underdog_banner: {
    id: 'underdog_banner', name: '언더독 깃발', description: '하이카드·원페어 유닛 피해 ×1.75', glyph: '⚑', color: 0xd8894a, rarity: 'rare',
  },
  royal_bloodline: {
    id: 'royal_bloodline', name: '왕실 혈통', description: '풀하우스+ 피해 +50% · 그 미만 −20%', glyph: '♜', color: 0xc86b86, rarity: 'rare',
  },
  rear_position: {
    id: 'rear_position', name: '후방 진지', description: '경로에서 2타일 이상 먼 유닛 피해 +25%', glyph: '⌂', color: 0x6ca4d9, rarity: 'common',
  },
  pristine_oath: {
    id: 'pristine_oath', name: '무교환 서약', description: '교환 없이 만든 유닛 피해 +60%', glyph: '◇', color: 0xe8d7a7, rarity: 'rare',
  },
  pair_broker: {
    id: 'pair_broker', name: '페어 중개인', description: '원페어 확정 시 같은 유닛 1기 추가', glyph: 'Ⅱ', color: 0xe6c84f, rarity: 'legendary',
  },
  four_suit_crest: {
    id: 'four_suit_crest', name: '4색 문장', description: '확정 패에 무늬 4종이면 +15G', glyph: '✥', color: 0x69c98f, rarity: 'common',
  },
  delay_tactics: {
    id: 'delay_tactics', name: '지연 전술', description: '이미 느리거나 기절한 적에게 피해 +25%', glyph: '◷', color: 0x78cde0, rarity: 'common',
  },
  compression_enthusiast: {
    id: 'compression_enthusiast', name: '압축 애호가', description: '덱 45장 이하일 때 무료 교환 +1', glyph: '▣', color: 0xb781dc, rarity: 'rare',
  },
};

export const RELIC_IDS = Object.keys(RELIC_DEFS) as RelicId[];
export const RELIC_SLOT_CAP = 5;
export const RELIC_CONDITIONAL_DAMAGE_CAP = 3;

export interface RelicDamageResult {
  multiplier: number;
  active: RelicId[];
}

const RARITY_WEIGHTS: Record<RelicRarity, number> = { common: 6, rare: 3, legendary: 1 };

export function relicBuyPrice(id: RelicId): number {
  return RELIC_BUY_PRICES[RELIC_DEFS[id].rarity];
}

export function relicSellPrice(id: RelicId): number {
  return RELIC_SELL_PRICES[RELIC_DEFS[id].rarity];
}

/** 등급을 먼저 뽑고 그 등급 안에서 균등 추첨하는 중복 없는 결정론적 선택. */
export function relicChoices(
  seed: number,
  milestone: number,
  owned: readonly RelicId[],
  count = 3,
): RelicId[] {
  const ownedSet = new Set(owned);
  const pool = RELIC_IDS.filter((id) => !ownedSet.has(id));
  const mixedSeed = (seed ^ Math.imul(milestone, 0x9e3779b1) ^ 0x7f4a7c15) >>> 0;
  return weightedChoices(pool, count, mulberry32(mixedSeed));
}

/** 보스 보상과 별도 네임스페이스를 사용해 전투/보상 RNG 소비와 독립적이다. */
export function relicShopChoice(seed: number, round: number, owned: readonly RelicId[]): RelicId | null {
  const pool = RELIC_IDS.filter((id) => !owned.includes(id));
  const mixedSeed = (seed ^ Math.imul(round, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0;
  return weightedChoices(pool, 1, mulberry32(mixedSeed))[0] ?? null;
}

function weightedChoices(pool: RelicId[], count: number, rng: () => number): RelicId[] {
  const available = [...pool];
  const result: RelicId[] = [];
  while (available.length > 0 && result.length < count) {
    const rarities = (Object.keys(RARITY_WEIGHTS) as RelicRarity[])
      .filter((rarity) => available.some((id) => RELIC_DEFS[id].rarity === rarity));
    const totalWeight = rarities.reduce((sum, rarity) => sum + RARITY_WEIGHTS[rarity], 0);
    let roll = rng() * totalWeight;
    let selectedRarity = rarities[rarities.length - 1];
    for (const rarity of rarities) {
      roll -= RARITY_WEIGHTS[rarity];
      if (roll < 0) {
        selectedRarity = rarity;
        break;
      }
    }
    const candidates = available.filter((id) => RELIC_DEFS[id].rarity === selectedRarity);
    const selected = shuffle(candidates, rng)[0];
    result.push(selected);
    available.splice(available.indexOf(selected), 1);
  }
  return result;
}

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
  fourSuitGoldBonus: number;
  pairBonusUnit: boolean;
}

export function relicModifiers(owned: readonly RelicId[], deckSize = 52): RelicModifiers {
  const has = (id: RelicId) => owned.includes(id);
  return {
    damageMultiplier: (has('royal_seal') ? 1.12 : 1) * (has('glass_crown') ? 1.35 : 1),
    bountyMultiplier: has('war_chest') ? 1.25 : 1,
    interestMultiplier: (has('compound_ledger') ? 1.5 : 1) * (has('greedy_ledger') ? 2 : 1),
    interestCapBonus: has('compound_ledger') ? 20 : 0,
    fieldCapBonus: (has('fortified_table') ? 10 : 0) - (has('glass_crown') ? 15 : 0),
    freeExchanges: (has('swift_shuffle') ? 2 : 1)
      + (has('compression_enthusiast') && deckSize <= 45 ? 1 : 0),
    bossRankBonus: has('ace_up_sleeve') ? 1 : 0,
    exchangeCostMultiplier: has('greedy_ledger') ? 1.5 : 1,
    clubStunDuration: has('frozen_clover') ? 4.5 : 3,
    clubChargeCap: has('frozen_clover') ? 2 : 3,
    heartStrike: has('blood_contract'),
    fourSuitGoldBonus: has('four_suit_crest') ? 15 : 0,
    pairBonusUnit: has('pair_broker'),
  };
}

export function relicUnitDamageMultiplier(
  owned: readonly RelicId[],
  unit: Unit,
  enemy: Enemy,
  field: Field,
): number {
  return relicUnitDamageResult(owned, unit, enemy, field).multiplier;
}

/** 이번 공격에서 이득 조건을 실제로 만족한 유물과 최종 배수를 함께 반환한다. */
export function relicUnitDamageResult(
  owned: readonly RelicId[],
  unit: Unit,
  enemy: Enemy,
  field: Field,
): RelicDamageResult {
  let multiplier = 1;
  const active: RelicId[] = [];
  if (owned.includes('underdog_banner') && unit.tier <= HandRank.Pair) {
    multiplier *= 1.75;
    active.push('underdog_banner');
  }
  if (owned.includes('royal_bloodline')) {
    const royalTier = unit.tier >= HandRank.FullHouse;
    multiplier *= royalTier ? 1.5 : 0.8;
    if (royalTier) active.push('royal_bloodline');
  }
  if (owned.includes('rear_position') && distanceToPathTiles(unit.tx, unit.ty) >= 2) {
    multiplier *= 1.25;
    active.push('rear_position');
  }
  if (owned.includes('pristine_oath') && unit.pristine) {
    multiplier *= 1.6;
    active.push('pristine_oath');
  }
  const alreadyControlled = field.time < enemy.slowUntil || field.time < enemy.stunUntil;
  if (owned.includes('delay_tactics') && alreadyControlled) {
    multiplier *= 1.25;
    active.push('delay_tactics');
  }
  return { multiplier: Math.min(RELIC_CONDITIONAL_DAMAGE_CAP, multiplier), active };
}
