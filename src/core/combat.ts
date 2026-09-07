import { HandRank } from './cards/types';
import { ENEMY_KINDS, EnemyKindId } from './enemies';
import { UNIT_DEFS, UnitDef, damagePerHit } from './units';
import { ENEMY_BASE_SPEED, enemyHp, killGold, bossGold } from './balance';
import { MapId, TILE, Pt, pointAt, tileCenter } from './map';
import { bossModifiers } from './bosses';
import type { RelicId } from './relics';
import { HandVariant, suitDamageMultiplier, suitPeriodMultiplier, variantDamageMultiplier, variantPeriodMultiplier } from './cards/handIdentity';
import type { Suit } from './cards/types';

export interface Enemy {
  id: number;
  kind: EnemyKindId;
  hp: number;
  maxHp: number;
  dist: number;      // 경로상 누적 px (pointAt이 순환 처리)
  slowUntil: number; // 전투 시간(초) 기준
  slowPct: number;
  stunUntil: number;
  bounty: number;
  round: number;     // 스폰된 라운드 (클리어 보너스 판정용)
  alive: boolean;
  escaped: boolean;  // 생명 모드에서 한 바퀴를 완주해 전장을 이탈했는지
  mapId: MapId;
  speedMultiplier?: number; // 왕관 난이도 등 런 단위 이동 속도 보정
}

export interface Unit {
  id: number;
  tier: HandRank;
  tx: number;
  ty: number;
  cooldown: number; // 남은 초 (0 이하 = 공격 가능)
  pristine: boolean; // 교환 없이 확정한 패에서 생성됐는지
  allIn: boolean; // 최후의 승부 5장 올인 교환으로 생성됐는지
  suit: Suit | null; // 확정 패의 대표 문양
  variant: HandVariant | null; // 마운틴·백스트레이트 등 명명 변형
}

export interface AttackEvent {
  unitId: number;
  targetId: number;
  /** 주 대상에 실제로 들어간 피해. 투사체 숫자 표시에 사용한다. */
  damage: number;
  /** 광역·연쇄를 포함해 이 공격이 실제로 가한 총 피해. */
  totalDamage: number;
  kills: number;
}

export interface TickResult {
  goldEarned: number;
  deaths: Enemy[];
  escaped: Enemy[];
  attacks: AttackEvent[];
  bossEvents: BossEvent[];
  relicTriggers: RelicId[];
  tacticEvents: TacticCombatEvent[];
}

export type TacticHitFeedback =
  | { type: 'focus-stack'; stage: number }
  | { type: 'fourth-strike'; hit: number };

export type TacticCombatEvent =
  | { type: 'focus-stack'; unitId: number; enemyId: number; stage: number; x: number; y: number }
  | { type: 'fourth-strike'; unitId: number; enemyId: number; hit: number; damage: number; x: number; y: number }
  | { type: 'overflow'; unitId: number; fromEnemyId: number; toEnemyId: number; damage: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'royal-bounty'; amount: number };

export interface CombatTacticHooks {
  damageMultiplier(unit: Unit, enemy: Enemy, primary: boolean): number;
  attackSpeedMultiplier(unit: Unit, enemy: Enemy): number;
  enemySpeedMultiplier(enemy: Enemy): number;
  overkillTransferRatio(unit: Unit, enemy: Enemy): number;
  hitFeedback?(unit: Unit, enemy: Enemy, primary: boolean): TacticHitFeedback | null;
}

const NO_TACTIC_HOOKS: CombatTacticHooks = {
  damageMultiplier: () => 1,
  attackSpeedMultiplier: () => 1,
  enemySpeedMultiplier: () => 1,
  overkillTransferRatio: () => 0,
  hitFeedback: () => null,
};

export type BossEvent =
  | { type: 'tax'; bossRound: 40; amount: number }
  | { type: 'summon'; bossRound: 50; count: number };

export interface Field {
  enemies: Enemy[];
  units: Unit[];
  time: number; // 누적 시뮬레이션 시간(초)
  nextId: number;
  mapId: MapId;
}

export function createField(mapId: MapId = 'classic-ring'): Field {
  return { enemies: [], units: [], time: 0, nextId: 1, mapId };
}

export interface SpawnOpts {
  dist?: number;
  hpOverride?: number;
  hpMultiplier?: number;
  speedMultiplier?: number;
  bounty?: number;
}

export function spawnEnemy(field: Field, kind: EnemyKindId, round: number, opts: SpawnOpts = {}): Enemy {
  const def = ENEMY_KINDS[kind];
  const hp = (opts.hpOverride ?? enemyHp(round) * def.hpMult) * (opts.hpMultiplier ?? 1);
  const enemy: Enemy = {
    id: field.nextId++,
    kind,
    hp,
    maxHp: hp,
    dist: opts.dist ?? 0,
    slowUntil: 0,
    slowPct: 0,
    stunUntil: 0,
    bounty: opts.bounty ?? (kind === 'boss' ? bossGold(round) : killGold(round)),
    round,
    alive: true,
    escaped: false,
    mapId: field.mapId,
    speedMultiplier: opts.speedMultiplier ?? 1,
  };
  field.enemies.push(enemy);
  return enemy;
}

export function addUnit(
  field: Field,
  tier: HandRank,
  tx: number,
  ty: number,
  pristine = false,
  suit: Suit | null = null,
  variant: HandVariant | null = null,
  allIn = false,
): Unit {
  const unit: Unit = { id: field.nextId++, tier, tx, ty, cooldown: 0, pristine, allIn, suit, variant };
  field.units.push(unit);
  return unit;
}

export function enemyPos(e: Enemy): Pt {
  return pointAt(e.dist, e.mapId);
}

export function unitPos(u: Unit): Pt {
  return tileCenter(u.tx, u.ty);
}

export function aliveEnemies(field: Field): Enemy[] {
  return field.enemies.filter((e) => e.alive);
}

function emptyResult(): TickResult {
  return { goldEarned: 0, deaths: [], escaped: [], attacks: [], bossEvents: [], relicTriggers: [], tacticEvents: [] };
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** first 타깃팅: 사거리 내에서 가장 오래 생존한(= 가장 먼저 스폰된) 적 */
function acquireTarget(field: Field, origin: Pt, rangePx: number): Enemy | null {
  const r2 = rangePx * rangePx;
  let best: Enemy | null = null;
  for (const e of field.enemies) {
    if (!e.alive) continue;
    if (dist2(origin, enemyPos(e)) > r2) continue;
    if (!best || e.id < best.id) best = e;
  }
  return best;
}

function die(field: Field, enemy: Enemy, result: TickResult): void {
  enemy.alive = false;
  enemy.escaped = false;
  result.goldEarned += enemy.bounty;
  result.deaths.push(enemy);
  if (ENEMY_KINDS[enemy.kind].splits) {
    // 분열: HP 30% 소형 2기 (재분열 없음)
    for (const offset of [-8, 8]) {
      spawnEnemy(field, 'normal', enemy.round, {
        dist: enemy.dist + offset,
        hpOverride: enemy.maxHp * 0.3,
        bounty: Math.max(1, Math.floor(enemy.bounty / 2)),
      });
    }
  }
}

interface DamageApplication { dealt: number; overkill: number; killed: boolean }

function applyDamage(field: Field, enemy: Enemy, amount: number, ignoreDefense: boolean, result: TickResult): DamageApplication {
  if (!enemy.alive) return { dealt: 0, overkill: 0, killed: false };
  let mult = ignoreDefense ? 1 : ENEMY_KINDS[enemy.kind].damageTakenMult;
  if (enemy.kind === 'boss' && !ignoreDefense) {
    mult *= bossModifiers(enemy.round, enemy.hp / enemy.maxHp).damageTakenMultiplier;
  }
  const hpBefore = Math.max(0, enemy.hp);
  const effectiveDamage = Math.max(0, amount * mult);
  const dealt = Math.min(hpBefore, effectiveDamage);
  const overkill = Math.max(0, effectiveDamage - hpBefore);
  enemy.hp -= effectiveDamage;
  const killed = enemy.hp <= 0;
  if (killed) die(field, enemy, result);
  return { dealt, overkill, killed };
}

/** 오라 보정: 반경 내 다른 성기사 유무 (비중첩 — 최대 1회) */
function auraMult(field: Field, unit: Unit): number {
  for (const other of field.units) {
    if (other.id === unit.id) continue;
    const aura = UNIT_DEFS[other.tier].traits.aura;
    if (!aura) continue;
    const dx = other.tx - unit.tx;
    const dy = other.ty - unit.ty;
    if (dx * dx + dy * dy <= aura.radius * aura.radius) return 1 + aura.dmgPct;
  }
  return 1;
}

function performAttack(
  field: Field,
  unit: Unit,
  def: UnitDef,
  globalMult: number,
  relicDamageMultiplier: (unit: Unit, enemy: Enemy, field: Field) => number,
  tacticHooks: CombatTacticHooks,
  result: TickResult,
): boolean {
  const origin = unitPos(unit);
  const target = acquireTarget(field, origin, def.range * TILE);
  if (!target) return false;

  let base = damagePerHit(def) * globalMult * auraMult(field, unit);
  const { execute, ignoreDefense = false, splash, chain, slow } = def.traits;

  if (execute) {
    const pct = target.kind === 'boss' ? execute.bossPct : execute.pct;
    base += Math.max(0, target.hp) * pct;
  }

  const targetPos = enemyPos(target);
  const deathsBefore = result.deaths.length;
  const damageAgainst = (enemy: Enemy, amount: number, primary: boolean) => {
    const tacticMultiplier = tacticHooks.damageMultiplier(unit, enemy, primary);
    return {
      amount: amount
        * relicDamageMultiplier(unit, enemy, field)
        * suitDamageMultiplier(unit.suit, enemy.kind === 'boss')
        * variantDamageMultiplier(unit.variant)
        * tacticMultiplier,
      feedback: tacticHooks.hitFeedback?.(unit, enemy, primary) ?? null,
    };
  };
  const targetDamage = damageAgainst(target, base, true);

  const applyHit = (
    enemy: Enemy,
    damage: ReturnType<typeof damageAgainst>,
    primary: boolean,
  ): { direct: number; total: number } => {
    const application = applyDamage(field, enemy, damage.amount, ignoreDefense, result);
    let total = application.dealt;
    if (application.dealt > 0 && damage.feedback) {
      const at = enemyPos(enemy);
      result.tacticEvents.push(damage.feedback.type === 'focus-stack'
        ? { ...damage.feedback, unitId: unit.id, enemyId: enemy.id, x: at.x, y: at.y }
        : { ...damage.feedback, unitId: unit.id, enemyId: enemy.id, damage: application.dealt, x: at.x, y: at.y });
    }
    const ratio = tacticHooks.overkillTransferRatio(unit, enemy);
    if (application.killed && application.overkill > 0 && ratio > 0) {
      // 배열 삽입 순서에 기대지 않고 계약대로 가장 낮은 ID의 유효 적에게 1회 전달한다.
      const next = field.enemies.reduce<Enemy | null>((best, candidate) => (
        candidate.alive
          && candidate.round === enemy.round
          && (!best || candidate.id < best.id)
          ? candidate
          : best
      ), null);
      if (next) {
        const transferred = applyDamage(field, next, application.overkill * ratio, true, result).dealt;
        total += transferred;
        if (transferred > 0) {
          const from = enemyPos(enemy);
          const to = enemyPos(next);
          result.tacticEvents.push({
            type: 'overflow', unitId: unit.id, fromEnemyId: enemy.id, toEnemyId: next.id,
            damage: transferred, x1: from.x, y1: from.y, x2: to.x, y2: to.y,
          });
        }
      }
    }
    return { direct: primary ? application.dealt : 0, total };
  };

  if (slow && target.alive) {
    target.slowUntil = field.time + slow.dur;
    target.slowPct = slow.pct;
  }

  const primary = applyHit(target, targetDamage, true);
  const primaryDamage = primary.direct;
  let totalDamage = primary.total;

  if (splash) {
    const r2 = splash * TILE * (splash * TILE);
    for (const e of field.enemies) {
      if (!e.alive || e.id === target.id) continue;
      if (dist2(targetPos, enemyPos(e)) <= r2) {
        totalDamage += applyHit(e, damageAgainst(e, base, false), false).total;
      }
    }
  }

  if (chain) {
    const hit = new Set([target.id]);
    let cur = target;
    let dmg = base;
    for (let i = 1; i < chain.count; i++) {
      const curPos = enemyPos(cur);
      const r2 = 2 * TILE * (2 * TILE); // 연쇄 탐색 반경 2타일
      let next: Enemy | null = null;
      let bestD = Infinity;
      for (const e of field.enemies) {
        if (!e.alive || hit.has(e.id)) continue;
        const d = dist2(curPos, enemyPos(e));
        if (d <= r2 && d < bestD) {
          bestD = d;
          next = e;
        }
      }
      if (!next) break;
      dmg *= chain.decay;
      totalDamage += applyHit(next, damageAgainst(next, dmg, false), false).total;
      hit.add(next.id);
      cur = next;
    }
  }

  result.attacks.push({
    unitId: unit.id,
    targetId: target.id,
    damage: primaryDamage,
    totalDamage,
    kills: result.deaths.length - deathsBefore,
  });

  return true;
}

/**
 * 고정 틱 시뮬레이션 한 스텝. 결정론 — 랜덤 없음.
 * 순서: 시간 → 이동/재생 → 유닛 공격.
 */
export function tick(
  field: Field,
  dt: number,
  globalDmgMult: number,
  relicDamageMultiplier: (unit: Unit, enemy: Enemy, field: Field) => number = () => 1,
  escapeDistance = Infinity,
  unitAttackSpeedMultiplier: (unit: Unit) => number = () => 1,
  tacticHooks: CombatTacticHooks = NO_TACTIC_HOOKS,
): TickResult {
  const result = emptyResult();
  field.time += dt;

  for (const e of field.enemies) {
    if (!e.alive) continue;
    const def = ENEMY_KINDS[e.kind];
    const boss = e.kind === 'boss'
      ? bossModifiers(e.round, e.hp / e.maxHp)
      : { damageTakenMultiplier: 1, speedMultiplier: 1, regenPctPerSec: 0 };
    const slowed = field.time < e.slowUntil;
    const stunned = field.time < e.stunUntil;
    const speed = stunned ? 0 : ENEMY_BASE_SPEED * def.speedMult * (e.speedMultiplier ?? 1) * boss.speedMultiplier
      * tacticHooks.enemySpeedMultiplier(e) * (slowed ? 1 - e.slowPct : 1);
    e.dist += speed * dt;
    if (e.dist >= escapeDistance) {
      e.alive = false;
      e.escaped = true;
      result.escaped.push(e);
      continue;
    }
    const regenPct = def.regenPctPerSec + boss.regenPctPerSec;
    if (regenPct > 0) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * regenPct * dt);
    }
  }

  for (const unit of field.units) {
    const def = UNIT_DEFS[unit.tier];
    unit.cooldown -= dt;
    while (unit.cooldown <= 0) {
      const target = acquireTarget(field, unitPos(unit), def.range * TILE);
      if (!target || !performAttack(field, unit, def, globalDmgMult, relicDamageMultiplier, tacticHooks, result)) {
        unit.cooldown = 0;
        break;
      }
      unit.cooldown += def.period
        * suitPeriodMultiplier(unit.suit)
        * variantPeriodMultiplier(unit.variant)
        / Math.max(0.01, unitAttackSpeedMultiplier(unit) * tacticHooks.attackSpeedMultiplier(unit, target));
    }
  }

  return result;
}
