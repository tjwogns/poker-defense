import { HandRank } from './cards/types';

export type UnitFamily = 'legion' | 'precision' | 'arcane' | 'royal' | 'dragon';

export interface SynergyTier {
  count: number;
  description: string;
}

export interface SynergyDef {
  id: UnitFamily;
  name: string;
  glyph: string;
  color: number;
  tiers: readonly SynergyTier[];
}

export interface SynergyStatus {
  id: UnitFamily;
  count: number;
  level: number;
  activeTier: SynergyTier | null;
  nextTier: SynergyTier | null;
}

export const UNIT_FAMILIES: Record<HandRank, readonly UnitFamily[]> = {
  [HandRank.HighCard]: ['legion'],
  [HandRank.Pair]: ['legion'],
  [HandRank.TwoPair]: ['precision'],
  [HandRank.Trips]: ['arcane'],
  [HandRank.Straight]: ['precision'],
  [HandRank.Flush]: ['arcane'],
  [HandRank.FullHouse]: ['legion', 'royal'],
  [HandRank.FourKind]: ['legion', 'dragon'],
  [HandRank.StraightFlush]: ['arcane', 'royal'],
  [HandRank.RoyalFlush]: ['dragon', 'royal'],
  [HandRank.FiveKind]: ['legion', 'dragon'],
  [HandRank.FlushHouse]: ['arcane', 'royal'],
  [HandRank.FlushFive]: ['arcane', 'royal', 'dragon'],
};

export const SYNERGY_DEFS: Record<UnitFamily, SynergyDef> = {
  legion: {
    id: 'legion', name: '군단', glyph: '⚔', color: 0x78b878,
    tiers: [
      { count: 2, description: '모든 피해 +8%' },
      { count: 4, description: '모든 피해 +20%' },
    ],
  },
  precision: {
    id: 'precision', name: '정밀', glyph: '◎', color: 0x6ca4d9,
    tiers: [{ count: 2, description: '정밀 피해 +35%' }],
  },
  arcane: {
    id: 'arcane', name: '마도', glyph: '✦', color: 0xb781dc,
    tiers: [
      { count: 2, description: '마도 피해 +18%' },
      { count: 3, description: '마도 피해 +40%' },
    ],
  },
  royal: {
    id: 'royal', name: '왕실', glyph: '♛', color: 0xe6c84f,
    tiers: [
      { count: 2, description: '모든 피해 +12%' },
      { count: 3, description: '모든 피해 +28%' },
    ],
  },
  dragon: {
    id: 'dragon', name: '용족', glyph: '◆', color: 0xd06258,
    tiers: [{ count: 2, description: '용족 보스 피해 +50%' }],
  },
};

export const SYNERGY_IDS = Object.keys(SYNERGY_DEFS) as UnitFamily[];

/** 같은 등급을 여러 기 배치해도 계열 종류 수는 한 번만 센다. */
export function synergyStatuses(units: readonly { tier: HandRank }[]): SynergyStatus[] {
  const uniqueTiers = new Set(units.map((unit) => unit.tier));
  return SYNERGY_IDS.map((id) => {
    let count = 0;
    for (const tier of uniqueTiers) {
      if (UNIT_FAMILIES[tier].includes(id)) count++;
    }
    const tiers = SYNERGY_DEFS[id].tiers;
    let level = 0;
    for (let index = 0; index < tiers.length; index++) {
      if (count >= tiers[index].count) level = index + 1;
    }
    return {
      id,
      count,
      level,
      activeTier: level > 0 ? tiers[level - 1] : null,
      nextTier: level < tiers.length ? tiers[level] : null,
    };
  });
}

export function unitSynergyDamageMultiplier(
  tier: HandRank,
  statuses: readonly SynergyStatus[],
  targetIsBoss = false,
): number {
  const level = (id: UnitFamily) => statuses.find((status) => status.id === id)?.level ?? 0;
  let multiplier = 1;
  const legion = level('legion');
  const royal = level('royal');
  if (legion === 1) multiplier *= 1.08;
  if (legion >= 2) multiplier *= 1.2;
  if (royal === 1) multiplier *= 1.12;
  if (royal >= 2) multiplier *= 1.28;

  const families = UNIT_FAMILIES[tier];
  const precision = level('precision');
  const arcane = level('arcane');
  if (families.includes('precision') && precision > 0) multiplier *= 1.35;
  if (families.includes('arcane') && arcane === 1) multiplier *= 1.18;
  if (families.includes('arcane') && arcane >= 2) multiplier *= 1.4;
  if (targetIsBoss && families.includes('dragon') && level('dragon') > 0) multiplier *= 1.5;
  return multiplier;
}

export function familyLabel(tier: HandRank): string {
  return UNIT_FAMILIES[tier].map((id) => SYNERGY_DEFS[id].name).join(' · ');
}
