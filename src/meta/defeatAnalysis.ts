import { FINAL_BOSS_MAX_TIME } from '../core/balance';
import { HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { SYNERGY_DEFS, synergyStatuses } from '../core/synergies';

export interface DefeatAnalysisInput {
  reason: 'field-cap' | 'final-boss-timeout' | null;
  round: number;
  fieldCap: number;
  enemies: readonly {
    kind: string;
    round: number;
    hp: number;
    maxHp: number;
    alive: boolean;
  }[];
  unitTiers: readonly HandRank[];
  upgradeLevel: number;
  bestHand: HandRank;
  relicCount: number;
}

export interface DefeatAnalysis {
  cause: string;
  boss: string;
  build: string;
  synergies: string;
  tips: readonly string[];
  aliveEnemies: number;
  bossHpPercent: number | null;
  activeSynergyIds: readonly string[];
}

export function analyzeDefeat(input: DefeatAnalysisInput): DefeatAnalysis {
  const alive = input.enemies.filter((enemy) => enemy.alive);
  const aliveBoss = alive
    .filter((enemy) => enemy.kind === 'boss')
    .sort((a, b) => b.round - a.round)[0];
  const bossHpPercent = aliveBoss
    ? Math.max(0, Math.min(100, Math.ceil((aliveBoss.hp / aliveBoss.maxHp) * 100)))
    : null;
  const statuses = synergyStatuses(input.unitTiers.map((tier) => ({ tier })));
  const activeStatuses = statuses.filter((status) => status.level > 0);
  const activeSynergyIds = activeStatuses.map((status) => status.id);
  const synergyText = activeStatuses.length > 0
    ? activeStatuses.map((status) => `${SYNERGY_DEFS[status.id].name} ${status.level}단계`).join(' · ')
    : '활성 시너지 없음';
  const tips: string[] = [];
  const addTip = (tip: string): void => {
    if (!tips.includes(tip)) tips.push(tip);
  };

  if (input.reason === 'final-boss-timeout' && !activeSynergyIds.includes('dragon')) {
    addTip('용족 2종 시너지는 용족 유닛의 보스 피해를 50% 높입니다.');
  }
  if (input.reason === 'field-cap' && activeStatuses.length === 0) {
    addTip('서로 다른 같은 계열 유닛 2종부터 모아 첫 시너지를 활성화해보세요.');
  }
  if (aliveBoss && input.reason === 'field-cap' && !activeSynergyIds.includes('dragon')) {
    addTip(`R${aliveBoss.round} 보스가 이월 중입니다. 용족 시너지와 보스 집중 화력을 준비해보세요.`);
  }
  if (input.bestHand <= HandRank.Pair && input.round >= 10) {
    addTip('같은 숫자와 무늬를 HOLD하고 리롤 확률을 확인해 투페어 이상을 노려보세요.');
  }
  if (tips.length === 0) {
    addTip('같은 등급 3기를 합성하고 경로가 겹치는 구간에 화력을 집중해보세요.');
  }

  const cause = input.reason === 'final-boss-timeout'
    ? `최종 보스 제한시간 ${FINAL_BOSS_MAX_TIME}초 종료`
    : `필드 위협도 ${alive.length} / ${input.fieldCap} 도달`;
  const boss = aliveBoss
    ? `생존 보스 R${aliveBoss.round} · HP ${bossHpPercent}%`
    : '생존 보스 없음';

  return {
    cause,
    boss,
    build: `강화 Lv${input.upgradeLevel} · 유닛 ${input.unitTiers.length} · 유물 ${input.relicCount} · 최고 ${HAND_NAMES_KO[input.bestHand]}`,
    synergies: synergyText,
    tips: tips.slice(0, 2),
    aliveEnemies: alive.length,
    bossHpPercent,
    activeSynergyIds,
  };
}
