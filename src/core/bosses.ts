export type BossId = 'iron_dealer' | 'blood_queen' | 'time_thief' | 'gold_tyrant' | 'legion_king' | 'royal_joker';

export interface BossDef {
  id: BossId;
  round: number;
  name: string;
  mechanic: string;
  color: number;
}

const BOSSES: Record<number, BossDef> = {
  10: { id: 'iron_dealer', round: 10, name: '철갑 딜러', mechanic: '받는 피해 35% 감소', color: 0x8e9aaa },
  20: { id: 'blood_queen', round: 20, name: '혈월 여왕', mechanic: '초당 최대 HP 2% 재생', color: 0xb8445a },
  30: { id: 'time_thief', round: 30, name: '시간 도둑', mechanic: '이동 속도 60% 증가', color: 0x5e8ed8 },
  40: { id: 'gold_tyrant', round: 40, name: '황금 폭군', mechanic: '5초마다 골드 5 강탈', color: 0xd4a62a },
  50: { id: 'legion_king', round: 50, name: '군단왕', mechanic: '8초마다 부하 2기 소환', color: 0x8a58b5 },
  60: { id: 'royal_joker', round: 60, name: '로열 조커', mechanic: 'HP 50% 아래에서 광폭화', color: 0xe24b77 },
};

export function bossDef(round: number): BossDef {
  const milestone = Math.min(60, Math.max(10, Math.floor(round / 10) * 10));
  return BOSSES[milestone];
}

export interface BossModifiers {
  damageTakenMultiplier: number;
  speedMultiplier: number;
  regenPctPerSec: number;
}

export interface BossCandidate {
  id: number;
  kind: string;
  round: number;
  alive: boolean;
}

/** 현재 보스를 우선하고, 동률이면 더 최근에 생성된 보스를 HUD 대상으로 고른다. */
export function featuredBoss<T extends BossCandidate>(enemies: readonly T[]): T | undefined {
  return enemies
    .filter((enemy) => enemy.alive && enemy.kind === 'boss')
    .sort((a, b) => b.round - a.round || b.id - a.id)[0];
}

export function bossModifiers(round: number, hpRatio: number): BossModifiers {
  if (round === 10) return { damageTakenMultiplier: 0.65, speedMultiplier: 1, regenPctPerSec: 0 };
  if (round === 20) return { damageTakenMultiplier: 1, speedMultiplier: 1, regenPctPerSec: 0.02 };
  if (round === 30) return { damageTakenMultiplier: 1, speedMultiplier: 1.6, regenPctPerSec: 0 };
  if (round === 60 && hpRatio <= 0.5) {
    return { damageTakenMultiplier: 0.8, speedMultiplier: 1.7, regenPctPerSec: 0 };
  }
  return { damageTakenMultiplier: 1, speedMultiplier: 1, regenPctPerSec: 0 };
}
