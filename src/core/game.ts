import { Card, HandRank } from './cards/types';
import { drawHand, exchange } from './cards/deck';
import { evaluateHand } from './cards/evaluator';
import { Rng, mulberry32 } from './rng';
import {
  START_GOLD, ROUNDS, WAVE_SIZE, BOSS_MINIONS, SPAWN_INTERVAL, COMBAT_MAX_TIME,
  FIELD_CAP, UNIT_CAP, SELL_REFUND,
  exchangeCost, interest, upgradeCost, upgradeMultiplier, clearBonus,
} from './balance';
import { EnemyKindId, ENEMY_KINDS, waveKind } from './enemies';
import {
  Field, TickResult, Unit, addUnit, aliveEnemies, createField, spawnEnemy, tick,
} from './combat';
import { isPlaceable } from './map';

export type Phase = 'prep' | 'combat' | 'victory' | 'defeat';

/**
 * 게임 상태 머신: prep(카드/배치/경제) ⇄ combat(고정 틱) → victory/defeat.
 * 렌더링 의존성 없음 — 헤드리스 시뮬레이터와 Phaser UI가 공유한다.
 */
export class Game {
  phase: Phase = 'prep';
  round = 1;
  gold = START_GOLD;
  upgradeLevel = 0;

  hand: Card[];
  holds: boolean[] = [false, false, false, false, false];
  exchangesUsed = 0;
  handConfirmed = false;
  lastHandRank: HandRank | null = null;

  /** 배치 대기 중인 유닛 (족보 확정 시 추가) */
  pendingUnits: HandRank[] = [];
  field: Field = createField();

  readonly seed: number;
  private rng: Rng;
  private spawnQueue: EnemyKindId[] = [];
  private spawnTimer = 0;
  private combatTimer = 0;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.hand = drawHand(this.rng);
  }

  // ── 준비 페이즈: 카드 ──────────────────────────────

  toggleHold(i: number): void {
    if (this.phase !== 'prep' || this.handConfirmed) return;
    this.holds[i] = !this.holds[i];
  }

  get exchangeCostNow(): number {
    return exchangeCost(this.exchangesUsed);
  }

  doExchange(): boolean {
    if (this.phase !== 'prep' || this.handConfirmed) return false;
    const cost = this.exchangeCostNow;
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.hand = exchange(this.hand, this.holds, this.rng);
    this.exchangesUsed++;
    return true;
  }

  /** 족보 확정 → 해당 등급 유닛 1기 획득 (배치 대기). 하이카드도 유닛 지급. */
  confirmHand(): HandRank | null {
    if (this.phase !== 'prep' || this.handConfirmed) return null;
    this.handConfirmed = true;
    const rank = evaluateHand(this.hand);
    this.lastHandRank = rank;
    this.pendingUnits.push(rank);
    return rank;
  }

  // ── 준비 페이즈: 유닛 ──────────────────────────────

  unitAt(tx: number, ty: number): Unit | undefined {
    return this.field.units.find((u) => u.tx === tx && u.ty === ty);
  }

  placeUnit(tx: number, ty: number): boolean {
    if (this.phase !== 'prep') return false;
    if (this.pendingUnits.length === 0) return false;
    if (this.field.units.length >= UNIT_CAP) return false;
    if (!isPlaceable(tx, ty) || this.unitAt(tx, ty)) return false;
    addUnit(this.field, this.pendingUnits.shift()!, tx, ty);
    return true;
  }

  moveUnit(unitId: number, tx: number, ty: number): boolean {
    if (this.phase !== 'prep') return false;
    if (!isPlaceable(tx, ty) || this.unitAt(tx, ty)) return false;
    const unit = this.field.units.find((u) => u.id === unitId);
    if (!unit) return false;
    unit.tx = tx;
    unit.ty = ty;
    return true;
  }

  sellUnit(unitId: number): boolean {
    const idx = this.field.units.findIndex((u) => u.id === unitId);
    if (idx < 0) return false;
    this.gold += SELL_REFUND[this.field.units[idx].tier];
    this.field.units.splice(idx, 1);
    return true;
  }

  // ── 경제 ──────────────────────────────────────────

  get upgradeCostNow(): number {
    return upgradeCost(this.upgradeLevel);
  }

  get dmgMult(): number {
    return upgradeMultiplier(this.upgradeLevel);
  }

  buyUpgrade(): boolean {
    const cost = this.upgradeCostNow;
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.upgradeLevel++;
    return true;
  }

  // ── 웨이브 정보 (UI용) ─────────────────────────────

  nextWave(): { kind: EnemyKindId; name: string; count: number } {
    const kind = waveKind(this.round);
    const count = kind === 'boss' ? 1 + BOSS_MINIONS : WAVE_SIZE;
    return { kind, name: ENEMY_KINDS[kind].name, count };
  }

  // ── 전투 ──────────────────────────────────────────

  startCombat(): boolean {
    if (this.phase !== 'prep' || !this.handConfirmed) return false;
    const { kind } = this.nextWave();
    this.spawnQueue =
      kind === 'boss'
        ? ['boss', ...Array<EnemyKindId>(BOSS_MINIONS).fill('normal')]
        : Array<EnemyKindId>(WAVE_SIZE).fill(kind);
    this.spawnTimer = 0;
    this.combatTimer = 0;
    this.phase = 'combat';
    return true;
  }

  tickCombat(dt: number): TickResult | null {
    if (this.phase !== 'combat') return null;

    this.spawnTimer -= dt;
    while (this.spawnQueue.length > 0 && this.spawnTimer <= 0) {
      spawnEnemy(this.field, this.spawnQueue.shift()!, this.round);
      this.spawnTimer += SPAWN_INTERVAL;
    }

    const result = tick(this.field, dt, this.dmgMult);
    this.gold += result.goldEarned;

    const alive = aliveEnemies(this.field).length;
    if (alive > FIELD_CAP) {
      this.phase = 'defeat';
      return result;
    }

    if (this.spawnQueue.length === 0) {
      this.combatTimer += dt;
      if (alive === 0 || this.combatTimer >= COMBAT_MAX_TIME) this.endRound();
    }
    return result;
  }

  private endRound(): void {
    // 이번 라운드 스폰분(분열 자식 포함) 전멸 시 클리어 보너스
    const roundCleared = !this.field.enemies.some((e) => e.round === this.round && e.alive);
    if (roundCleared) this.gold += clearBonus(this.round);

    if (this.round >= ROUNDS) {
      this.phase = 'victory';
      return;
    }

    this.round++;
    this.gold += interest(this.gold);
    this.field.enemies = this.field.enemies.filter((e) => e.alive); // 시체 정리, 생존자는 이월
    this.hand = drawHand(this.rng);
    this.holds = [false, false, false, false, false];
    this.exchangesUsed = 0;
    this.handConfirmed = false;
    this.phase = 'prep';
  }
}
