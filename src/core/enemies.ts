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

export type FormationId = 'escort-column' | 'cross-pressure' | 'relay-assault';
export type FormationRhythm = 'steady' | 'alternating' | 'pulse';

export interface EnemyFormation {
  id: FormationId;
  rhythm: FormationRhythm;
  composition: WaveGroup[];
}

export const FORMATION_COPY: Record<FormationId, { ko: string; en: string; hintKo: string; hintEn: string }> = {
  'escort-column': {
    ko: '호위 종대', en: 'ESCORT COLUMN',
    hintKo: '단단한 호위 사이의 빈틈을 노리세요', hintEn: 'PUNCTURE GAPS BETWEEN ESCORTS',
  },
  'cross-pressure': {
    ko: '교차 압박', en: 'CROSS PRESSURE',
    hintKo: '속도가 다른 두 전선을 함께 막으세요', hintEn: 'COVER BOTH SPEED LANES',
  },
  'relay-assault': {
    ko: '교대 돌격', en: 'RELAY ASSAULT',
    hintKo: '역할군이 맥박처럼 교대 진입합니다', hintEn: 'ROLES ENTER IN REPEATING PULSES',
  },
};

type RegularKind = Exclude<EnemyKindId, 'boss'>;
interface FormationTemplate {
  id: FormationId;
  rhythm: FormationRhythm;
  groups: readonly [RegularKind, number][];
}

/** 대표 단일 웨이브 대비 정적 유효 HP = hpMult / damageTakenMult. 재생의 시간 변수는 포함하지 않는다. */
export function waveEffectiveHpUnits(groups: readonly WaveGroup[]): number {
  return groups.reduce((total, group) => {
    const def = ENEMY_KINDS[group.kind];
    return total + group.count * def.hpMult / def.damageTakenMult;
  }, 0);
}

const MID_FORMATIONS: Record<'normal' | 'fast' | 'tank', readonly FormationTemplate[]> = {
  normal: [
    { id: 'cross-pressure', rhythm: 'alternating', groups: [['normal', 22], ['fast', 8]] },
    { id: 'escort-column', rhythm: 'steady', groups: [['normal', 22], ['tank', 8]] },
  ],
  fast: [
    { id: 'cross-pressure', rhythm: 'alternating', groups: [['fast', 24], ['normal', 6]] },
    { id: 'escort-column', rhythm: 'steady', groups: [['fast', 27], ['tank', 3]] },
  ],
  tank: [
    { id: 'escort-column', rhythm: 'steady', groups: [['tank', 21], ['normal', 9]] },
    { id: 'cross-pressure', rhythm: 'alternating', groups: [['tank', 25], ['fast', 5]] },
  ],
};

const LATE_FORMATIONS: Record<'normal' | 'fast' | 'tank' | 'regen', readonly FormationTemplate[]> = {
  normal: [
    { id: 'relay-assault', rhythm: 'pulse', groups: [['normal', 20], ['fast', 5], ['tank', 5]] },
    { id: 'cross-pressure', rhythm: 'alternating', groups: [['normal', 22], ['regen', 8]] },
  ],
  fast: [
    { id: 'relay-assault', rhythm: 'pulse', groups: [['fast', 24], ['normal', 3], ['regen', 3]] },
    { id: 'escort-column', rhythm: 'steady', groups: [['fast', 27], ['tank', 3]] },
  ],
  tank: [
    { id: 'relay-assault', rhythm: 'pulse', groups: [['tank', 22], ['fast', 4], ['regen', 4]] },
    { id: 'escort-column', rhythm: 'steady', groups: [['tank', 21], ['normal', 9]] },
  ],
  regen: [
    { id: 'relay-assault', rhythm: 'pulse', groups: [['regen', 20], ['fast', 5], ['tank', 5]] },
    { id: 'cross-pressure', rhythm: 'alternating', groups: [['regen', 22], ['normal', 8]] },
  ],
};

function formationSeed(seed: number, round: number): number {
  return (seed ^ Math.imul(round, 0x6d2b79f5) ^ 0x464f524d) >>> 0;
}

export function waveFormation(seed: number, round: number): EnemyFormation | null {
  if (round % BOSS_EVERY === 0 || round === 11 || round === 12 || round === 21) return null;
  const primary = waveKind(round);
  const pool = round >= 13 && round <= 19
    ? MID_FORMATIONS[primary as keyof typeof MID_FORMATIONS]
    : round >= 22 && round <= 29
      ? LATE_FORMATIONS[primary as keyof typeof LATE_FORMATIONS]
      : undefined;
  if (!pool) return null;
  const rng = mulberry32(formationSeed(seed, round));
  const template = pool[Math.floor(rng() * pool.length)];
  return {
    id: template.id,
    rhythm: template.rhythm,
    composition: template.groups.map(([kind, count]) => ({ kind, count })),
  };
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

export function waveComposition(round: number, seed = 0): WaveGroup[] {
  if (round % BOSS_EVERY === 0) return [
    { kind: 'boss', count: 1 },
    { kind: 'normal', count: BOSS_MINIONS },
  ];
  const early = EARLY_MIXED_WAVES[round];
  if (early) return [
    { kind: 'normal', count: early[0] },
    { kind: 'fast', count: early[1] },
  ];
  const formation = waveFormation(seed, round);
  if (formation) return formation.composition;
  return [{ kind: waveKind(round), count: WAVE_SIZE }];
}

function nearestFreeSlot(queue: Array<EnemyKindId | null>, ideal: number): number {
  for (let distance = 0; distance < queue.length; distance++) {
    for (const direction of distance === 0 ? [0] : [-1, 1]) {
      const slot = (ideal + distance * direction + queue.length) % queue.length;
      if (queue[slot] === null) return slot;
    }
  }
  return -1;
}

function formationSpawnOrder(seed: number, round: number, formation: EnemyFormation): EnemyKindId[] {
  const queue: Array<EnemyKindId | null> = Array(WAVE_SIZE).fill(null);
  const groups = [...formation.composition].sort((a, b) => a.count - b.count || a.kind.localeCompare(b.kind));
  const rng = mulberry32(formationSeed(seed ^ 0x53504157, round));
  groups.forEach((group, groupIndex) => {
    for (let index = 0; index < group.count; index++) {
      const base = (index + 0.5) * WAVE_SIZE / group.count;
      const rhythmShift = formation.rhythm === 'pulse'
        ? (index % 3) - 1
        : formation.rhythm === 'alternating' ? (index % 2 === 0 ? -0.75 : 0.75) : 0;
      const offset = groupIndex * WAVE_SIZE / Math.max(1, groups.length) + Math.floor(rng() * 3);
      const slot = nearestFreeSlot(queue, Math.floor(base + rhythmShift + offset) % WAVE_SIZE);
      if (slot >= 0) queue[slot] = group.kind;
    }
  });
  return queue as EnemyKindId[];
}

/** 카드 RNG를 소비하지 않는 seed+round 전용 순서. 소수 역할을 균등 간격으로 배치한다. */
export function waveSpawnOrder(seed: number, round: number): EnemyKindId[] {
  const formation = waveFormation(seed, round);
  if (formation) return formationSpawnOrder(seed, round, formation);
  const groups = waveComposition(round, seed);
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
