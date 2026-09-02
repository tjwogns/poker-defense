import { FINAL_BOSS_MAX_TIME } from '../core/balance';
import { HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { HandMasteryLevels, MASTERABLE_HANDS } from '../core/mastery';
import { ENEMY_KINDS, EnemyKindId } from '../core/enemies';
import type { LifeRoundRecord } from '../core/game';

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
  lifeRoundHistory?: readonly LifeRoundRecord[];
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
  lifeDetails: readonly string[];
  topEscapedKind: EnemyKindId | null;
  worstLifeRound: number | null;
  worstLifeDamage: number;
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
  const lifeHistory = input.lifeRoundHistory ?? [];
  const totalEscapedByKind = lifeHistory.reduce((totals, record) => {
    for (const kind of Object.keys(totals) as EnemyKindId[]) totals[kind] += record.escapedByKind[kind];
    return totals;
  }, { normal: 0, fast: 0, tank: 0, regen: 0, splitter: 0, boss: 0 } satisfies Record<EnemyKindId, number>);
  const topEscaped = (Object.entries(totalEscapedByKind) as Array<[EnemyKindId, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0];
  const worstLifeRound = [...lifeHistory].sort((a, b) => b.lifeDamage - a.lifeDamage || b.escaped - a.escaped)[0];
  const escapedBoss = [...lifeHistory].reverse().find((record) => record.escapedBossHpPercent !== null);
  const recentLife = lifeHistory.slice(-5).map((record) => `R${record.round} −${record.lifeDamage}`).join(' · ');
  const lifeDetails: string[] = [];
  if (topEscaped) lifeDetails.push(`최다 탈출 ${ENEMY_KINDS[topEscaped[0]].name} ${topEscaped[1]}기`);
  if (worstLifeRound) lifeDetails.push(`최대 피해 R${worstLifeRound.round} · ${worstLifeRound.escaped}기 / ♥−${worstLifeRound.lifeDamage}`);
  if (escapedBoss) lifeDetails.push(`탈출 보스 HP ${escapedBoss.escapedBossHpPercent}%`);
  if (recentLife) lifeDetails.push(`최근 피해 ${recentLife}`);

  if (mainDamageRank !== null && (input.handMastery[mainDamageRank] ?? 0) === 0) {
    addTip(`피해 1위 ${HAND_NAMES_KO[mainDamageRank]}를 연마하면 현재 주력 화력이 바로 상승합니다.`);
  } else if (mainDamageRank !== null && trained.length > 0 && trained[0] !== mainDamageRank) {
    addTip(`${HAND_NAMES_KO[trained[0]]} 연마보다 피해 1위 ${HAND_NAMES_KO[mainDamageRank]} 유닛 확보에 집중해보세요.`);
  }

  if (input.reason === 'final-boss-timeout') {
    addTip('최종 보스에는 스페이드 대표 문양과 고등급 단일 화력 유닛을 집중해보세요.');
  }
  if (input.reason === 'life-depleted') {
    if (topEscaped?.[0] === 'fast') {
      addTip('고속형 탈출이 가장 많습니다. 출구 직전과 첫 교차 지점에 즉시 대응 화력을 보강하세요.');
    } else if (topEscaped?.[0] === 'tank' || topEscaped?.[0] === 'regen') {
      addTip('튼튼한 적의 탈출이 많습니다. 단일 화력·방어 무시 유닛을 교차로에 집중하세요.');
    } else {
      addTip('입구와 마지막 코너에 화력을 나눠 배치해 빠른 적의 탈출을 먼저 막아보세요.');
    }
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
    lifeDetails,
    topEscapedKind: topEscaped?.[0] ?? null,
    worstLifeRound: worstLifeRound?.round ?? null,
    worstLifeDamage: worstLifeRound?.lifeDamage ?? 0,
  };
}
