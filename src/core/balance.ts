/**
 * 모든 밸런스 수치의 단일 소스. 기획안 4~8장의 초기값.
 * 수치 조정은 이 파일에서만 한다 (데이터 주도).
 */

// ── 진행 ──────────────────────────────────────────────
export const TICK_RATE = 30;          // 고정 틱/초
export const ROUNDS = 60;             // 총 라운드
export const WAVE_SIZE = 30;          // 라운드당 일반 적 수
export const BOSS_MINIONS = 10;       // 보스 라운드 수행원 수
export const SPAWN_INTERVAL = 0.45;   // 초 — 초반 대기감을 줄인 기본 템포
export const COMBAT_MAX_TIME = 32;    // 스폰 완료 후 최대 전투 시간(초)
export const FINAL_BOSS_MAX_TIME = 50; // 최종 보스전: 스폰 완료 후 처치 제한 시간(초)
export const FIELD_CAP = 80;          // 필드 적 누적 상한 (초과 = 패배)
export const BOSS_EVERY = 10;
export const DECK_SEAL_COSTS = { banish: 25, duplicate: 40 } as const;

// ── v2.2 생명·경제 실험 모드 ─────────────────────────
export const LIFE_MODE_STARTING_LIVES = 20;
export const LIFE_MODE_FIELD_CAP = 120; // 렌더링·성능 보호용 비상 상한
export const LIFE_MODE_BASE_EXCHANGES = 3;
export const LIFE_MODE_BREACH_THRESHOLD = 5;
export const LIFE_MODE_BOSS_ESCAPE_DAMAGE = 3;

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
export function interest(gold: number, rate = INTEREST_RATE, cap = INTEREST_CAP): number {
  return Math.min(Math.floor(gold * rate), cap);
}

/** exchangesUsed = 이번 라운드에 이미 쓴 교환 횟수. 첫 회 무료, 이후 10/25/50/100/200… (배가) */
export function exchangeCost(exchangesUsed: number): number {
  if (exchangesUsed === 0) return 0;
  const table = [10, 25, 50];
  if (exchangesUsed <= table.length) return table[exchangesUsed - 1];
  return 100 * Math.pow(2, exchangesUsed - 4);
}

// ── 전역 공격력 강화 ──────────────────────────────────
export const UPGRADE_BASE_COST = 35;
export const UPGRADE_COST_GROWTH = 1.18;

export function upgradeCost(level: number): number {
  return Math.round(UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_GROWTH, level));
}
export function upgradeMultiplier(level: number): number {
  return Math.pow(1.08, level);
}

/** HandRank 인덱스별 유닛 판매 환급 골드 */
export const SELL_REFUND: number[] = [2, 5, 10, 20, 40, 40, 80, 150, 300, 500, 800, 1000, 1500];
