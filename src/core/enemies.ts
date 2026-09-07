import { BOSS_EVERY, BOSS_HP_MULT, BOSS_MINIONS, WAVE_SIZE } from './balance';
import { mulberry32 } from './rng';

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
  normal:   { id: 'normal',   name: '찢긴 카드병', hpMult: 1,    unlockRound: 1,  speedMult: 1,   damageTakenMult: 1,    regenPctPerSec: 0,     splits: false, color: 0xc75b5b },
  fast:     { id: 'fast',     name: '칩 도둑',     hpMult: 0.7,  unlockRound: 5,  speedMult: 1.6, damageTakenMult: 1,    regenPctPerSec: 0,     splits: false, color: 0xe0a33c },
  tank:     { id: 'tank',     name: '금고 골렘',   hpMult: 1,    unlockRound: 12, speedMult: 0.8, damageTakenMult: 0.75, regenPctPerSec: 0,     splits: false, color: 0x8a8f9e },
  // 주의: 해금 라운드는 10의 배수(보스 라운드)를 피해야 한다 — 기획안의 R20을 R21로 보정
  regen:    { id: 'regen',    name: '꿰맨 하트',   unlockRound: 21, hpMult: 1, speedMult: 1, damageTakenMult: 1, regenPctPerSec: 0.015, splits: false, color: 0x6fbf7a },
  splitter: { id: 'splitter', name: '카드 미믹',   unlockRound: 32, hpMult: 1, speedMult: 1, damageTakenMult: 1, regenPctPerSec: 0, splits: true, color: 0xba6fd0 },
  boss:     { id: 'boss',     name: '보스',   unlockRound: 0,  hpMult: BOSS_HP_MULT, speedMult: 0.7, damageTakenMult: 1, regenPctPerSec: 0, splits: false, color: 0x7a2f2f },
};

const ROTATION: EnemyKindId[] = ['normal', 'fast', 'tank', 'regen', 'splitter'];

export interface WaveGroup {
  kind: EnemyKindId;
  count: number;
}

/**
 * R5~R9는 기존 단일 웨이브의 주 역할을 유지하면서 반대 역할을 소량 섞는다.
 * fast 중심 라운드는 기존 대비 총 HP +5.7~11.4%, normal 중심 라운드는 −4~6%다.
 */
const EARLY_MIXED_WAVES: Readonly<Record<number, readonly [number, number]>> = {
  5: [4, 26],
  6: [26, 4],
  7: [6, 24],
  8: [24, 6],
  9: [8, 22],
};

/**
 * 라운드별 대표 웨이브 타입. 혼합 편성에서도 기존 라운드의 주 역할을 보존한다.
 * 10의 배수 = 보스. 신규 타입은 해금 라운드에 반드시 데뷔, 이외에는 해금된 타입 순환.
 */
export function waveKind(round: number): EnemyKindId {
  if (round % BOSS_EVERY === 0) return 'boss';
  const debut = ROTATION.find((id) => ENEMY_KINDS[id].unlockRound === round);
  if (debut) return debut;
  const unlocked = ROTATION.filter((id) => ENEMY_KINDS[id].unlockRound <= round);
  return unlocked[round % unlocked.length];
}

export function waveComposition(round: number): WaveGroup[] {
  if (round % BOSS_EVERY === 0) return [
    { kind: 'boss', count: 1 },
    { kind: 'normal', count: BOSS_MINIONS },
  ];
  const early = EARLY_MIXED_WAVES[round];
  if (early) return [
    { kind: 'normal', count: early[0] },
    { kind: 'fast', count: early[1] },
  ];
  return [{ kind: waveKind(round), count: WAVE_SIZE }];
}

/** 카드 RNG를 소비하지 않는 seed+round 전용 순서. 소수 역할을 균등 간격으로 배치한다. */
export function waveSpawnOrder(seed: number, round: number): EnemyKindId[] {
  const groups = waveComposition(round);
  if (groups.length === 1 || groups[0].kind === 'boss') {
    return groups.flatMap(({ kind, count }) => Array<EnemyKindId>(count).fill(kind));
  }
  const [first, second] = groups;
  const dominant = first.count >= second.count ? first : second;
  const minority = dominant === first ? second : first;
  const queue = Array<EnemyKindId>(WAVE_SIZE).fill(dominant.kind);
  const rng = mulberry32((seed ^ Math.imul(round, 0x9e3779b1) ^ 0x4d495845) >>> 0);
  const offset = Math.floor(rng() * WAVE_SIZE);
  for (let index = 0; index < minority.count; index++) {
    const slot = (offset + Math.floor((index + 0.5) * WAVE_SIZE / minority.count)) % WAVE_SIZE;
    queue[slot] = minority.kind;
  }
  return queue;
}

/** 한 바퀴를 완주한 일반 적이 누적시키는 침투 게이지. */
export function enemyBreachPoints(kind: EnemyKindId): number {
  if (kind === 'boss') return 0;
  if (kind === 'tank' || kind === 'regen' || kind === 'splitter') return 2;
  return 1;
}
