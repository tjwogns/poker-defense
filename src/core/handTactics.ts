import { HandRank, Suit } from './cards/types';
import type { Enemy, TacticHitFeedback, Unit } from './combat';
import { GRID_H, GRID_W } from './map';

export type HandTacticId = 'volley' | 'focus-fire' | 'roadblock' | 'suit-command'
  | 'stronghold' | 'fourth-strike' | 'overflow' | 'royal-decree';
export type TacticZone = 0 | 1 | 2 | 3;

export interface HandTacticState {
  id: HandTacticId;
  sourceRank: HandRank;
  round: number;
  suit: Suit | null;
  lockedZone: TacticZone | null;
  consecutiveByUnit: Record<number, { enemyId: number; hits: number }>;
  hitsByEnemy: Record<number, number>;
}

export const HAND_TACTIC_COPY: Record<HandTacticId, { ko: string; en: string }> = {
  volley: { ko: '연사 · 전체 공속 +8%', en: 'VOLLEY · ALL ATTACK SPEED +8%' },
  'focus-fire': { ko: '집중 사격 · 같은 적 연속 공격 최대 +20%', en: 'FOCUS FIRE · REPEAT TARGET DAMAGE UP TO +20%' },
  roadblock: { ko: '봉쇄선 · 이번 라운드 적 속도 -10%', en: 'ROADBLOCK · THIS ROUND ENEMY SPEED -10%' },
  'suit-command': { ko: '문양 지휘 · 대표 문양 유닛 피해 +15%', en: 'SUIT COMMAND · LEAD SUIT UNIT DAMAGE +15%' },
  stronghold: { ko: '거점 · 최다 배치 구역 피해 +15%', en: 'STRONGHOLD · BUSIEST ZONE DAMAGE +15%' },
  'fourth-strike': { ko: '네 번째 일격 · 적의 매 4번째 피격 +40%', en: 'FOURTH STRIKE · EVERY 4TH HIT +40%' },
  overflow: { ko: '마력 전이 · 초과 피해 50% 전달', en: 'OVERFLOW · TRANSFER 50% OVERKILL' },
  'royal-decree': { ko: '왕명 · 전체 피해 +20% · 처치 골드 +10%', en: 'ROYAL DECREE · ALL DAMAGE +20% · KILL GOLD +10%' },
};

export const HAND_TACTIC_COMPACT_COPY: Record<HandTacticId, { ko: string; en: string }> = {
  volley: { ko: '연사 · 공속 +8%', en: 'VOLLEY · AS +8%' },
  'focus-fire': { ko: '집중 · 연타 최대 +20%', en: 'FOCUS · REPEAT +20% MAX' },
  roadblock: { ko: '봉쇄 · 적 속도 -10%', en: 'ROADBLOCK · ENEMY SPD -10%' },
  'suit-command': { ko: '문양 · 해당 피해 +15%', en: 'SUIT · MATCH DMG +15%' },
  stronghold: { ko: '거점 · 구역 피해 +15%', en: 'ZONE · DMG +15%' },
  'fourth-strike': { ko: '4타 · 매 4타 +40%', en: '4TH HIT · +40%' },
  overflow: { ko: '전이 · 초과 50%', en: 'OVERFLOW · 50% OVERKILL' },
  'royal-decree': { ko: '왕명 · 피해 +20% · 골드 +10%', en: 'ROYAL · DMG +20% · GOLD +10%' },
};

export function tacticIdForRank(rank: HandRank): HandTacticId | null {
  if (rank < HandRank.TwoPair) return null;
  if (rank >= HandRank.RoyalFlush) return 'royal-decree';
  return ({
    [HandRank.TwoPair]: 'volley',
    [HandRank.Trips]: 'focus-fire',
    [HandRank.Straight]: 'roadblock',
    [HandRank.Flush]: 'suit-command',
    [HandRank.FullHouse]: 'stronghold',
    [HandRank.FourKind]: 'fourth-strike',
    [HandRank.StraightFlush]: 'overflow',
  } as Partial<Record<HandRank, HandTacticId>>)[rank] ?? null;
}

export function createHandTactic(rank: HandRank, round: number, suit: Suit | null): HandTacticState | null {
  const id = tacticIdForRank(rank);
  return id ? {
    id, sourceRank: rank, round, suit, lockedZone: null,
    consecutiveByUnit: {}, hitsByEnemy: {},
  } : null;
}

export function unitZone(unit: Pick<Unit, 'tx' | 'ty'>): TacticZone {
  const right = unit.tx >= Math.floor(GRID_W / 2);
  const bottom = unit.ty >= Math.floor(GRID_H / 2);
  return (bottom ? (right ? 3 : 2) : (right ? 1 : 0)) as TacticZone;
}

/** 최다 동률은 TL→TR→BL→BR 순서로 고정한다. */
export function lockHandTacticForCombat(state: HandTacticState | null, units: readonly Unit[]): HandTacticState | null {
  if (!state) return null;
  const counts = [0, 0, 0, 0];
  for (const unit of units) counts[unitZone(unit)]++;
  const max = Math.max(...counts);
  return {
    ...state,
    lockedZone: state.id === 'stronghold' ? counts.indexOf(max) as TacticZone : null,
    consecutiveByUnit: {},
    hitsByEnemy: {},
  };
}

export function tacticApplies(state: HandTacticState | null, enemy: Pick<Enemy, 'round'>): boolean {
  return state !== null && enemy.round === state.round;
}

/** 호출 1회가 실제 피격 1회를 뜻한다. Quads 카운터는 attacker와 무관하게 적별로 누적한다. */
export function handTacticDamageMultiplier(
  state: HandTacticState | null,
  unit: Unit,
  enemy: Enemy,
  primary: boolean,
): number {
  if (!state) return 1;
  if (state.id === 'focus-fire' && primary) {
    // 비적용(이월) 적을 공격한 경우도 "대상 변경"이다. 연속 기록은 모든 주 공격을
    // 따라가되, 보너스 자체는 현재 라운드 출신 적에게만 준다.
    const previous = state.consecutiveByUnit[unit.id];
    const hits = previous?.enemyId === enemy.id ? previous.hits + 1 : 1;
    state.consecutiveByUnit[unit.id] = { enemyId: enemy.id, hits };
    if (!tacticApplies(state, enemy)) return 1;
    return 1 + Math.min(0.2, Math.max(0, hits - 1) * 0.05);
  }
  if (!tacticApplies(state, enemy)) return 1;
  if (state.id === 'royal-decree') return 1.2;
  if (state.id === 'suit-command') return unit.suit !== null && unit.suit === state.suit ? 1.15 : 1;
  if (state.id === 'stronghold') return state.lockedZone !== null && unitZone(unit) === state.lockedZone ? 1.15 : 1;
  if (state.id === 'fourth-strike') {
    const hits = (state.hitsByEnemy[enemy.id] ?? 0) + 1;
    state.hitsByEnemy[enemy.id] = hits;
    return hits % 4 === 0 ? 1.4 : 1;
  }
  return 1;
}

export function handTacticAttackSpeedMultiplier(state: HandTacticState | null, enemy: Enemy): number {
  return tacticApplies(state, enemy) && state?.id === 'volley' ? 1.08 : 1;
}

export function handTacticEnemySpeedMultiplier(state: HandTacticState | null, enemy: Enemy): number {
  return tacticApplies(state, enemy) && state?.id === 'roadblock' ? 0.9 : 1;
}

export function handTacticOverkillRatio(state: HandTacticState | null, enemy: Enemy): number {
  return tacticApplies(state, enemy) && state?.id === 'overflow' ? 0.5 : 0;
}

export function handTacticBountyMultiplier(state: HandTacticState | null, enemy: Enemy): number {
  return tacticApplies(state, enemy) && state?.id === 'royal-decree' ? 1.1 : 1;
}

/** damageMultiplier 호출 직후의 실제 코어 카운터를 시각 이벤트로만 노출한다. */
export function handTacticHitFeedback(
  state: HandTacticState | null,
  unit: Unit,
  enemy: Enemy,
  primary: boolean,
): TacticHitFeedback | null {
  if (!state || !tacticApplies(state, enemy)) return null;
  if (state.id === 'focus-fire' && primary) {
    const stage = state.consecutiveByUnit[unit.id]?.hits ?? 0;
    return stage >= 2 && stage <= 5 ? { type: 'focus-stack', stage } : null;
  }
  if (state.id === 'fourth-strike') {
    const hit = state.hitsByEnemy[enemy.id] ?? 0;
    return hit > 0 && hit % 4 === 0 ? { type: 'fourth-strike', hit } : null;
  }
  return null;
}
