import { BOSS_EVERY } from './balance';

export type EnemyKindId = 'normal' | 'fast' | 'tank' | 'regen' | 'splitter' | 'boss';

export interface EnemyKindDef {
  id: EnemyKindId;
  name: string;
  unlockRound: number;      // 이 라운드에 데뷔 (boss는 별도 규칙)
  hpMult: number;
  speedMult: number;
  damageTakenMult: number;  // 방어형 = 0.75
  regenPctPerSec: number;   // 초당 최대 HP 회복 비율
  splits: boolean;          // 사망 시 분열
  color: number;            // 렌더용
}

export const ENEMY_KINDS: Record<EnemyKindId, EnemyKindDef> = {
  normal:   { id: 'normal',   name: '일반',   unlockRound: 1,  hpMult: 1,    speedMult: 1,   damageTakenMult: 1,    regenPctPerSec: 0,     splits: false, color: 0xc75b5b },
  fast:     { id: 'fast',     name: '고속형', unlockRound: 5,  hpMult: 0.7,  speedMult: 1.6, damageTakenMult: 1,    regenPctPerSec: 0,     splits: false, color: 0xe0a33c },
  tank:     { id: 'tank',     name: '방어형', unlockRound: 12, hpMult: 1,    speedMult: 0.8, damageTakenMult: 0.75, regenPctPerSec: 0,     splits: false, color: 0x8a8f9e },
  // 주의: 해금 라운드는 10의 배수(보스 라운드)를 피해야 한다 — 기획안의 R20을 R21로 보정
  regen:    { id: 'regen',    name: '재생형', unlockRound: 21, hpMult: 1,    speedMult: 1,   damageTakenMult: 1,    regenPctPerSec: 0.015, splits: false, color: 0x6fbf7a },
  splitter: { id: 'splitter', name: '분열형', unlockRound: 32, hpMult: 1,    speedMult: 1,   damageTakenMult: 1,    regenPctPerSec: 0,     splits: true,  color: 0xba6fd0 },
  boss:     { id: 'boss',     name: '보스',   unlockRound: 0,  hpMult: 40,   speedMult: 0.7, damageTakenMult: 1,    regenPctPerSec: 0,     splits: false, color: 0x7a2f2f },
};

const ROTATION: EnemyKindId[] = ['normal', 'fast', 'tank', 'regen', 'splitter'];

/**
 * 라운드별 웨이브 타입 (단일 타입 웨이브).
 * 10의 배수 = 보스. 신규 타입은 해금 라운드에 반드시 데뷔, 이외에는 해금된 타입 순환.
 */
export function waveKind(round: number): EnemyKindId {
  if (round % BOSS_EVERY === 0) return 'boss';
  const debut = ROTATION.find((id) => ENEMY_KINDS[id].unlockRound === round);
  if (debut) return debut;
  const unlocked = ROTATION.filter((id) => ENEMY_KINDS[id].unlockRound <= round);
  return unlocked[round % unlocked.length];
}
