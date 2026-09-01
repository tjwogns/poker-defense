import { FINAL_BOSS_MAX_TIME } from '../core/balance';
import { HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { HandMasteryLevels, MASTERABLE_HANDS } from '../core/mastery';

export interface DefeatAnalysisInput {
  reason: 'field-cap' | 'life-depleted' | 'final-boss-timeout' | null;
  round: number;
  lives?: number;
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
  handMastery: HandMasteryLevels;
  handDamage: Readonly<Record<HandRank, number>>;
}

export interface DefeatAnalysis {
  cause: string;
  boss: string;
  build: string;
  mastery: string;
  tips: readonly string[];
  aliveEnemies: number;
  bossHpPercent: number | null;
  mainDamageRank: HandRank | null;
  mainDamagePercent: number;
}

export function analyzeDefeat(input: DefeatAnalysisInput): DefeatAnalysis {
  const alive = input.enemies.filter((enemy) => enemy.alive);
  const aliveBoss = alive
    .filter((enemy) => enemy.kind === 'boss')
    .sort((a, b) => b.round - a.round)[0];
  const bossHpPercent = aliveBoss
    ? Math.max(0, Math.min(100, Math.ceil((aliveBoss.hp / aliveBoss.maxHp) * 100)))
    : null;
  const tips: string[] = [];
  const addTip = (tip: string): void => {
    if (!tips.includes(tip)) tips.push(tip);
  };
  const damageEntries = Object.entries(input.handDamage)
    .map(([rank, damage]) => ({ rank: Number(rank) as HandRank, damage }))
    .filter((entry) => entry.damage > 0)
    .sort((a, b) => b.damage - a.damage);
  const totalDamage = damageEntries.reduce((sum, entry) => sum + entry.damage, 0);
  const mainDamageRank = damageEntries[0]?.rank ?? null;
  const mainDamagePercent = mainDamageRank === null || totalDamage <= 0
    ? 0
    : Math.round((damageEntries[0].damage / totalDamage) * 100);
  const trained = MASTERABLE_HANDS
    .filter((rank) => input.handMastery[rank] > 0)
    .sort((a, b) => input.handMastery[b] - input.handMastery[a]);
  const masteryText = mainDamageRank === null
    ? trained.length > 0
      ? `연마 ${trained.map((rank) => `${HAND_NAMES_KO[rank]} Lv${input.handMastery[rank]}`).join(' · ')} · 피해 기록 없음`
      : '연마 없음 · 피해 기록 없음'
    : `주력 ${HAND_NAMES_KO[mainDamageRank]} ${mainDamagePercent}% · Lv${input.handMastery[mainDamageRank] ?? 0}`;

  if (mainDamageRank !== null && (input.handMastery[mainDamageRank] ?? 0) === 0) {
    addTip(`피해 1위 ${HAND_NAMES_KO[mainDamageRank]}를 연마하면 현재 주력 화력이 바로 상승합니다.`);
  } else if (mainDamageRank !== null && trained.length > 0 && trained[0] !== mainDamageRank) {
    addTip(`${HAND_NAMES_KO[trained[0]]} 연마보다 피해 1위 ${HAND_NAMES_KO[mainDamageRank]} 유닛 확보에 집중해보세요.`);
  }

  if (input.reason === 'final-boss-timeout') {
    addTip('최종 보스에는 스페이드 대표 문양과 고등급 단일 화력 유닛을 집중해보세요.');
  }
  if (input.reason === 'life-depleted') {
    addTip('입구와 마지막 코너에 화력을 나눠 배치해 빠른 적의 탈출을 먼저 막아보세요.');
  }
  if (aliveBoss && input.reason === 'field-cap') {
    addTip(`R${aliveBoss.round} 보스가 이월 중입니다. 보스 집중 화력과 주력 족보 강화를 준비해보세요.`);
  } else if (input.reason === 'field-cap') {
    addTip('같은 등급 3기를 합성하고 주력 족보 연마로 필드 정리 속도를 높여보세요.');
  }
  if (input.bestHand <= HandRank.Pair && input.round >= 10) {
    addTip('같은 숫자와 무늬를 HOLD하고 리롤 확률을 확인해 투페어 이상을 노려보세요.');
  }
  if (tips.length === 0) {
    addTip('같은 등급 3기를 합성하고 경로가 겹치는 구간에 화력을 집중해보세요.');
  }

  const cause = input.reason === 'final-boss-timeout'
    ? `최종 보스 제한시간 ${FINAL_BOSS_MAX_TIME}초 종료`
    : input.reason === 'life-depleted'
      ? `왕국 라이프 ${input.lives ?? 0} · 적 탈출로 방어선 붕괴`
    : `필드 위협도 ${alive.length} / ${input.fieldCap} 도달`;
  const boss = aliveBoss
    ? `생존 보스 R${aliveBoss.round} · HP ${bossHpPercent}%`
    : '생존 보스 없음';

  return {
    cause,
    boss,
    build: `강화 Lv${input.upgradeLevel} · 유닛 ${input.unitTiers.length} · 유물 ${input.relicCount} · 최고 ${HAND_NAMES_KO[input.bestHand]}`,
    mastery: masteryText,
    tips: tips.slice(0, 2),
    aliveEnemies: alive.length,
    bossHpPercent,
    mainDamageRank,
    mainDamagePercent,
  };
}
