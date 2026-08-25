/**
 * 모든 밸런스 수치의 단일 소스. 기획안 4~8장의 초기값.
 * 수치 조정은 이 파일에서만 한다 (데이터 주도).
 */

// ── 진행 ──────────────────────────────────────────────
export const TICK_RATE = 30;          // 고정 틱/초
export const ROUNDS = 60;             // 총 라운드
export const WAVE_SIZE = 30;          // 라운드당 일반 적 수
export const BOSS_MINIONS = 10;       // 보스 라운드 수행원 수
export const SPAWN_INTERVAL = 0.6;    // 초
export const COMBAT_MAX_TIME = 40;    // 스폰 완료 후 최대 전투 시간(초)
export const FIELD_CAP = 80;          // 필드 적 누적 상한 (초과 = 패배)
export const UNIT_CAP = 30;           // 배치 상한
export const BOSS_EVERY = 10;

// ── 적 ────────────────────────────────────────────────
export const ENEMY_BASE_HP = 18;
export const ENEMY_HP_GROWTH = 1.14;
export const ENEMY_BASE_SPEED = 60;   // px/s
export const BOSS_HP_MULT = 40;

export function enemyHp(round: number): number {
  return ENEMY_BASE_HP * Math.pow(ENEMY_HP_GROWTH, round);
}

// ── 경제 ──────────────────────────────────────────────
export const START_GOLD = 30;
export const INTEREST_RATE = 0.1;
export const INTEREST_CAP = 50;

export function killGold(round: number): number {
  return 2 + Math.floor(round / 5);
}
export function bossGold(round: number): number {
  return 100 + 20 * (round / BOSS_EVERY);
}
export function clearBonus(round: number): number {
  return 20 + 2 * round;
}
export function interest(gold: number): number {
  return Math.min(Math.floor(gold * INTEREST_RATE), INTEREST_CAP);
}

/** exchangesUsed = 이번 라운드에 이미 쓴 교환 횟수. 첫 회 무료, 이후 10/25/50/100/200… (배가) */
export function exchangeCost(exchangesUsed: number): number {
  if (exchangesUsed === 0) return 0;
  const table = [10, 25, 50];
  if (exchangesUsed <= table.length) return table[exchangesUsed - 1];
  return 100 * Math.pow(2, exchangesUsed - 4);
}

// ── 전역 공격력 강화 ──────────────────────────────────
export function upgradeCost(level: number): number {
  return Math.round(50 * Math.pow(1.2, level));
}
export function upgradeMultiplier(level: number): number {
  return Math.pow(1.08, level);
}

/** HandRank 인덱스별 유닛 판매 환급 골드 */
export const SELL_REFUND: number[] = [2, 5, 10, 20, 40, 40, 80, 150, 300, 500];
