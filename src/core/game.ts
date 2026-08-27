import { Card, HandRank, Suit } from './cards/types';
import { drawHand, exchange } from './cards/deck';
import { evaluateHand } from './cards/evaluator';
import { Rng, mulberry32 } from './rng';
import {
  START_GOLD, ROUNDS, WAVE_SIZE, BOSS_MINIONS, BOSS_EVERY, SPAWN_INTERVAL, COMBAT_MAX_TIME,
  FIELD_CAP, UNIT_CAP, SELL_REFUND, INTEREST_RATE, INTEREST_CAP,
  exchangeCost, interest, upgradeCost, upgradeMultiplier, clearBonus,
} from './balance';
import { EnemyKindId, ENEMY_KINDS, waveKind } from './enemies';
import {
  Field, TickResult, Unit, addUnit, aliveEnemies, banishNewest, createField,
  spawnEnemy, strikeAll, stunAll, tick,
} from './combat';
import { isPlaceable, tileCanReachPath } from './map';
import { UNIT_DEFS } from './units';
import {
  RelicId,
  relicChoices as makeRelicChoices,
  relicModifiers,
} from './relics';
import {
  RunSummary,
  scoreForHand,
  scoreForKills,
  scoreForRoundClear,
  VICTORY_SCORE,
} from './scoring';
import { dominantSuit, SuitPowerResult } from './abilities';
import { bossDef } from './bosses';
import { synergyStatuses, unitSynergyDamageMultiplier } from './synergies';

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
  score = 0;
  kills = 0;
  bestHand: HandRank = HandRank.HighCard;
  powerCharges: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  lastPowerSuit: Suit | null = null;

  hand: Card[];
  holds: boolean[] = [false, false, false, false, false];
  exchangesUsed = 0;
  handConfirmed = false;
  lastHandRank: HandRank | null = null;
  relics: RelicId[] = [];
  relicChoices: RelicId[] = [];

  /** 배치 대기 중인 유닛 (족보 확정 시 추가) */
  pendingUnits: HandRank[] = [];
  field: Field = createField();

  readonly seed: number;
  private rng: Rng;
  private spawnQueue: EnemyKindId[] = [];
  private spawnTimer = 0;
  private combatTimer = 0;
  private nextBossTaxAt = Infinity;
  private nextBossSummonAt = Infinity;

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
    const mods = relicModifiers(this.relics);
    return Math.ceil(
      exchangeCost(Math.max(0, this.exchangesUsed - (mods.freeExchanges - 1)))
      * mods.exchangeCostMultiplier,
    );
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
    const baseRank = evaluateHand(this.hand);
    const bonus = this.round % BOSS_EVERY === 0
      ? relicModifiers(this.relics).bossRankBonus
      : 0;
    const rank = Math.min(HandRank.RoyalFlush, baseRank + bonus) as HandRank;
    this.lastHandRank = rank;
    this.bestHand = Math.max(this.bestHand, rank) as HandRank;
    this.score += scoreForHand(rank);
    this.pendingUnits.push(rank);
    const suit = dominantSuit(this.hand);
    this.lastPowerSuit = suit;
    const chargeCap = suit === 'C' ? relicModifiers(this.relics).clubChargeCap : 3;
    this.powerCharges[suit] = Math.min(chargeCap, this.powerCharges[suit] + 1);
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
    const tier = this.pendingUnits[0];
    if (!isPlaceable(tx, ty) || this.unitAt(tx, ty)) return false;
    if (!tileCanReachPath(tx, ty, UNIT_DEFS[tier].range)) return false;
    addUnit(this.field, this.pendingUnits.shift()!, tx, ty);
    return true;
  }

  moveUnit(unitId: number, tx: number, ty: number): boolean {
    if (this.phase !== 'prep') return false;
    const unit = this.field.units.find((u) => u.id === unitId);
    if (!unit) return false;
    if (!isPlaceable(tx, ty) || this.unitAt(tx, ty)) return false;
    if (!tileCanReachPath(tx, ty, UNIT_DEFS[unit.tier].range)) return false;
    unit.tx = tx;
    unit.ty = ty;
    return true;
  }

  fusionCandidates(tier: HandRank): number[] {
    if (tier >= HandRank.RoyalFlush) return [];
    return this.field.units
      .filter((unit) => unit.tier === tier)
      .sort((a, b) => a.id - b.id)
      .map((unit) => unit.id);
  }

  fuseUnits(unitIds: number[]): boolean {
    if (this.phase !== 'prep' || unitIds.length !== 3 || new Set(unitIds).size !== 3) return false;
    const materials = unitIds.map((id) => this.field.units.find((unit) => unit.id === id));
    if (materials.some((unit) => !unit)) return false;
    const units = materials as Unit[];
    const tier = units[0].tier;
    if (tier >= HandRank.RoyalFlush || units.some((unit) => unit.tier !== tier)) return false;

    const origin = units[0];
    const consumed = new Set(unitIds);
    this.field.units = this.field.units.filter((unit) => !consumed.has(unit.id));
    addUnit(this.field, (tier + 1) as HandRank, origin.tx, origin.ty);
    return true;
  }

  sellUnit(unitId: number): boolean {
    if (this.phase !== 'prep') return false;
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
    return upgradeMultiplier(this.upgradeLevel) * relicModifiers(this.relics).damageMultiplier;
  }

  get synergies() {
    return synergyStatuses(this.field.units);
  }

  unitDamageMult(tier: HandRank, targetIsBoss = false): number {
    return this.dmgMult * unitSynergyDamageMultiplier(tier, this.synergies, targetIsBoss);
  }

  get fieldCap(): number {
    return Math.max(20, FIELD_CAP + relicModifiers(this.relics).fieldCapBonus);
  }

  get interestNow(): number {
    const mods = relicModifiers(this.relics);
    return interest(
      this.gold,
      INTEREST_RATE * mods.interestMultiplier,
      INTEREST_CAP + mods.interestCapBonus,
    );
  }

  chooseRelic(id: RelicId): boolean {
    if (this.phase !== 'prep' || !this.relicChoices.includes(id)) return false;
    this.relics.push(id);
    if (id === 'frozen_clover') {
      this.powerCharges.C = Math.min(this.powerCharges.C, relicModifiers(this.relics).clubChargeCap);
    }
    this.relicChoices = [];
    return true;
  }

  buyUpgrade(): boolean {
    if (this.phase !== 'prep') return false;
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
    return { kind, name: kind === 'boss' ? bossDef(this.round).name : ENEMY_KINDS[kind].name, count };
  }

  // ── 전투 ──────────────────────────────────────────

  useSuitPower(suit: Suit): SuitPowerResult | null {
    if (this.phase !== 'combat' || this.powerCharges[suit] <= 0) return null;
    this.powerCharges[suit]--;

    if (suit === 'S') {
      return this.resolveStrikePower(suit, 0.22, 0.06);
    }
    if (suit === 'H') {
      if (relicModifiers(this.relics).heartStrike) return this.resolveStrikePower(suit, 0.12, 0.04);
      return { suit, affected: banishNewest(this.field, 6).length, goldEarned: 0 };
    }
    if (suit === 'D') {
      const goldEarned = 25 + this.round * 3;
      this.gold += goldEarned;
      return { suit, affected: 0, goldEarned };
    }
    return { suit, affected: stunAll(this.field, relicModifiers(this.relics).clubStunDuration), goldEarned: 0 };
  }

  private resolveStrikePower(suit: Suit, normalPct: number, bossPct: number): SuitPowerResult {
    const affected = aliveEnemies(this.field).length;
    const result = strikeAll(this.field, normalPct, bossPct);
    const mods = relicModifiers(this.relics);
    result.goldEarned = Math.floor(result.goldEarned * mods.bountyMultiplier);
    this.gold += result.goldEarned;
    this.kills += result.deaths.length;
    this.score += scoreForKills(this.round, result.deaths.length);
    return { suit, affected, goldEarned: result.goldEarned };
  }

  startCombat(): boolean {
    if (
      this.phase !== 'prep'
      || !this.handConfirmed
      || this.pendingUnits.length > 0
      || this.relicChoices.length > 0
    ) return false;
    const { kind } = this.nextWave();
    this.spawnQueue =
      kind === 'boss'
        ? ['boss', ...Array<EnemyKindId>(BOSS_MINIONS).fill('normal')]
        : Array<EnemyKindId>(WAVE_SIZE).fill(kind);
    this.spawnTimer = 0;
    this.combatTimer = 0;
    const hasTaxBoss = this.round === 40
      || this.field.enemies.some((enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === 40);
    const hasSummonBoss = this.round === 50
      || this.field.enemies.some((enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === 50);
    this.nextBossTaxAt = hasTaxBoss ? this.field.time + 5 : Infinity;
    this.nextBossSummonAt = hasSummonBoss ? this.field.time + 8 : Infinity;
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

    const result = tick(this.field, dt, this.dmgMult, this.synergies);
    const mods = relicModifiers(this.relics);
    result.goldEarned = Math.floor(result.goldEarned * mods.bountyMultiplier);
    this.gold += result.goldEarned;
    this.kills += result.deaths.length;
    this.score += scoreForKills(this.round, result.deaths.length);

    const taxBoss = this.field.enemies.find((enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === 40);
    while (taxBoss && this.field.time >= this.nextBossTaxAt) {
      this.gold = Math.max(0, this.gold - 5);
      result.bossEvents.push({ type: 'tax', bossRound: 40, amount: 5 });
      this.nextBossTaxAt += 5;
    }
    const summonBoss = this.field.enemies.find((enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === 50);
    while (summonBoss && this.field.time >= this.nextBossSummonAt) {
      spawnEnemy(this.field, 'normal', summonBoss.round, { dist: summonBoss.dist - 12 });
      spawnEnemy(this.field, 'normal', summonBoss.round, { dist: summonBoss.dist + 12 });
      result.bossEvents.push({ type: 'summon', bossRound: 50, count: 2 });
      this.nextBossSummonAt += 8;
    }

    const alive = aliveEnemies(this.field).length;
    if (alive > this.fieldCap) {
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
    if (roundCleared) {
      this.gold += clearBonus(this.round);
      this.score += scoreForRoundClear(this.round);
    }

    if (this.round >= ROUNDS) {
      this.score += VICTORY_SCORE;
      this.phase = 'victory';
      return;
    }

    const completedRound = this.round;
    this.round++;
    this.gold += this.interestNow;
    this.field.enemies = this.field.enemies.filter((e) => e.alive); // 시체 정리, 생존자는 이월
    this.hand = drawHand(this.rng);
    this.holds = [false, false, false, false, false];
    this.exchangesUsed = 0;
    this.handConfirmed = false;
    if (completedRound % BOSS_EVERY === 0) {
      this.relicChoices = makeRelicChoices(this.seed, completedRound, this.relics);
    }
    this.phase = 'prep';
  }

  summary(): RunSummary {
    return {
      seed: this.seed,
      result: this.phase === 'victory' || this.phase === 'defeat' ? this.phase : 'active',
      score: this.score,
      round: this.round,
      kills: this.kills,
      bestHand: this.bestHand,
      upgradeLevel: this.upgradeLevel,
      relics: [...this.relics],
    };
  }
}
