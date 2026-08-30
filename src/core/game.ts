import { Card, HandRank } from './cards/types';
import { Suit } from './cards/types';
import { MAX_RUN_DECK_SIZE, MIN_RUN_DECK_SIZE, RunDeck } from './cards/deck';
import { evaluateHand } from './cards/evaluator';
import { Rng, mulberry32 } from './rng';
import {
  START_GOLD, ROUNDS, WAVE_SIZE, BOSS_MINIONS, BOSS_EVERY, SPAWN_INTERVAL, COMBAT_MAX_TIME,
  FINAL_BOSS_MAX_TIME, DECK_SEAL_COSTS,
  FIELD_CAP, UNIT_CAP, SELL_REFUND, INTEREST_RATE, INTEREST_CAP,
  exchangeCost, interest, upgradeCost, upgradeMultiplier, clearBonus,
} from './balance';
import { EnemyKindId, ENEMY_KINDS, waveKind } from './enemies';
import {
  Field, TickResult, Unit, addUnit, aliveEnemies, createField, spawnEnemy, tick,
} from './combat';
import { isPlaceable, tileCanReachPath } from './map';
import { UNIT_DEFS } from './units';
import {
  RelicId,
  RELIC_SLOT_CAP,
  relicChoices as makeRelicChoices,
  relicBuyPrice,
  relicModifiers,
  relicSellPrice,
  relicShopChoice,
  relicUnitDamageResult,
} from './relics';
import {
  RunSummary,
  scoreForHand,
  scoreForKills,
  scoreForRoundClear,
  VICTORY_SCORE,
} from './scoring';
import { bossDef } from './bosses';
import { synergyStatuses, unitSynergyDamageMultiplier } from './synergies';
import {
  createHandMasteryLevels, HandMasteryLevels, handMasteryCost, handMasteryMultiplier,
  handMasteryOffer, HAND_MASTERY_DAMAGE_PER_LEVEL, HAND_MASTERY_MAX_LEVEL, MasterableHandRank,
} from './mastery';
import {
  dominantSuitChoices, HandVariant, handVariant, suitDamageMultiplier, suitPeriodMultiplier,
  variantDamageMultiplier, variantPeriodMultiplier,
} from './cards/handIdentity';

export type Phase = 'prep' | 'combat' | 'victory' | 'defeat';
export type DefeatReason = 'field-cap' | 'final-boss-timeout';
export type DeckSealId = 'banish' | 'duplicate';
export type DeckEditStatus =
  | 'ready'
  | 'wrong_phase'
  | 'maintenance_pending'
  | 'hand_locked'
  | 'exchange_started'
  | 'no_seal'
  | 'card_missing'
  | 'hand_copy_protected'
  | 'size_limit';

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
  defeatReason: DefeatReason | null = null;

  hand: Card[];
  holds: boolean[] = [false, false, false, false, false];
  exchangesUsed = 0;
  handConfirmed = false;
  lastHandRank: HandRank | null = null;
  lastHandSuit: Suit | null = null;
  lastHandVariant: HandVariant | null = null;
  selectedDominantSuit: Suit | null = null;
  relics: RelicId[] = [];
  relicChoices: RelicId[] = [];
  readonly deckSeals: Record<DeckSealId, number> = { banish: 0, duplicate: 0 };
  readonly handMastery: HandMasteryLevels = createHandMasteryLevels();
  /** 실제 체력 감소량 기준 족보별 누적 피해(광역·연쇄 포함). */
  readonly handDamage: Record<HandRank, number> = Object.fromEntries(
    Array.from({ length: HandRank.FlushFive + 1 }, (_, rank) => [rank, 0]),
  ) as Record<HandRank, number>;

  /** 배치 대기 중인 유닛 (족보 확정 시 추가) */
  pendingUnits: HandRank[] = [];
  private pendingUnitPristine: boolean[] = [];
  private pendingUnitSuits: (Suit | null)[] = [];
  private pendingUnitVariants: (HandVariant | null)[] = [];
  lastRelicGoldBonus = 0;
  lastPairBrokerBonus = false;
  lastRelicTriggers: RelicId[] = [];
  field: Field = createField();

  readonly seed: number;
  private readonly runDeck: RunDeck;
  private rng: Rng;
  private spawnQueue: EnemyKindId[] = [];
  private spawnTimer = 0;
  private combatTimer = 0;
  private diamondGoldThisRound = 0;
  private nextBossTaxAt = Infinity;
  private nextBossSummonAt = Infinity;
  private pendingBossRewardRounds: number[] = [];
  private queuedBossRewardRounds = new Set<number>();
  private visitedMaintenanceRounds = new Set<number>();
  private purchasedMaintenanceOffers = new Set<string>();
  private maintenanceRelics = new Map<number, RelicId | null>();
  private maintenanceMasteries = new Map<number, MasterableHandRank | null>();
  private pendingMaintenanceRound: number | null = null;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.runDeck = new RunDeck();
    this.hand = this.runDeck.draw(this.rng);
  }

  // ── 준비 페이즈: 카드 ──────────────────────────────

  get maintenancePending(): boolean {
    return this.phase === 'prep'
      && this.pendingMaintenanceRound === this.round
      && !this.visitedMaintenanceRounds.has(this.round)
      && this.relicChoices.length === 0;
  }

  get relicSlotsRemaining(): number {
    return Math.max(0, RELIC_SLOT_CAP - this.relics.length);
  }

  maintenanceOffer(id: DeckSealId): { cost: number; purchased: boolean; affordable: boolean } {
    const cost = DECK_SEAL_COSTS[id];
    return {
      cost,
      purchased: this.purchasedMaintenanceOffers.has(`${this.round}:${id}`),
      affordable: this.gold >= cost,
    };
  }

  maintenanceRelicOffer(replaceId?: RelicId): {
    id: RelicId;
    cost: number;
    refund: number;
    netCost: number;
    purchased: boolean;
    affordable: boolean;
    requiresReplacement: boolean;
  } | null {
    if (!this.maintenancePending) return null;
    if (!this.maintenanceRelics.has(this.round)) {
      this.maintenanceRelics.set(this.round, relicShopChoice(this.seed, this.round, this.relics));
    }
    const id = this.maintenanceRelics.get(this.round);
    if (!id) return null;
    const cost = relicBuyPrice(id);
    const requiresReplacement = this.relics.length >= RELIC_SLOT_CAP;
    const validReplacement = replaceId !== undefined && this.relics.includes(replaceId);
    const refund = requiresReplacement && validReplacement ? relicSellPrice(replaceId) : 0;
    const netCost = cost - refund;
    return {
      id,
      cost,
      refund,
      netCost,
      purchased: this.purchasedMaintenanceOffers.has(`${this.round}:relic`),
      affordable: this.gold >= Math.max(0, netCost),
      requiresReplacement,
    };
  }

  maintenanceMasteryOffer(): {
    rank: MasterableHandRank;
    level: number;
    nextLevel: number;
    cost: number;
    multiplier: number;
    nextMultiplier: number;
    purchased: boolean;
    affordable: boolean;
  } | null {
    if (!this.maintenancePending) return null;
    if (!this.maintenanceMasteries.has(this.round)) {
      this.maintenanceMasteries.set(this.round, handMasteryOffer(this.seed, this.round, this.handMastery));
    }
    const rank = this.maintenanceMasteries.get(this.round);
    if (rank === null || rank === undefined) return null;
    const level = this.handMastery[rank];
    const cost = handMasteryCost(rank);
    return {
      rank,
      level,
      nextLevel: Math.min(HAND_MASTERY_MAX_LEVEL, level + 1),
      cost,
      multiplier: handMasteryMultiplier(this.handMastery, rank),
      nextMultiplier: Math.pow(
        1 + HAND_MASTERY_DAMAGE_PER_LEVEL,
        Math.min(HAND_MASTERY_MAX_LEVEL, level + 1),
      ),
      purchased: this.purchasedMaintenanceOffers.has(`${this.round}:mastery`),
      affordable: this.gold >= cost && level < HAND_MASTERY_MAX_LEVEL,
    };
  }

  buyMaintenanceSeal(id: DeckSealId): boolean {
    if (!this.maintenancePending) return false;
    const key = `${this.round}:${id}`;
    const cost = DECK_SEAL_COSTS[id];
    if (this.purchasedMaintenanceOffers.has(key) || this.gold < cost) return false;
    this.gold -= cost;
    this.grantDeckSeal(id);
    this.purchasedMaintenanceOffers.add(key);
    return true;
  }

  buyMaintenanceRelic(replaceId?: RelicId): boolean {
    const offer = this.maintenanceRelicOffer(replaceId);
    if (!offer || offer.purchased) return false;
    if (!offer.requiresReplacement && replaceId) return false;
    if (offer.requiresReplacement && (!replaceId || !this.relics.includes(replaceId))) return false;
    if (!offer.affordable) return false;
    if (replaceId) this.removeRelic(replaceId);
    this.gold += offer.refund - offer.cost;
    this.addRelic(offer.id);
    this.purchasedMaintenanceOffers.add(`${this.round}:relic`);
    return true;
  }

  buyMaintenanceMastery(): boolean {
    const offer = this.maintenanceMasteryOffer();
    if (!offer || offer.purchased || !offer.affordable) return false;
    this.gold -= offer.cost;
    this.handMastery[offer.rank]++;
    this.purchasedMaintenanceOffers.add(`${this.round}:mastery`);
    return true;
  }

  leaveMaintenance(): boolean {
    if (!this.maintenancePending) return false;
    this.visitedMaintenanceRounds.add(this.round);
    this.pendingMaintenanceRound = null;
    return true;
  }

  sellRelic(id: RelicId): boolean {
    if (!this.maintenancePending) return false;
    if (!this.relics.includes(id)) return false;
    this.removeRelic(id);
    this.gold += relicSellPrice(id);
    return true;
  }

  get deckSize(): number {
    return this.runDeck.size;
  }

  deckSnapshot(): Card[] {
    return this.runDeck.snapshot();
  }

  deckCardCount(card: Card): number {
    return this.runDeck.count(card);
  }

  /** 추후 정비소 보상에서 호출할 덱 개조 인장 지급 진입점. */
  grantDeckSeal(id: DeckSealId, count = 1): void {
    if (!Number.isInteger(count) || count <= 0) throw new Error('seal count must be a positive integer');
    this.deckSeals[id] += count;
  }

  /** 현재 패의 교환 가능성을 깨뜨리지 않는 범위에서만 덱 개조를 허용한다. */
  deckEditStatus(id: DeckSealId, card: Card): DeckEditStatus {
    if (this.phase !== 'prep') return 'wrong_phase';
    if (this.maintenancePending) return 'maintenance_pending';
    if (this.handConfirmed) return 'hand_locked';
    if (this.exchangesUsed > 0) return 'exchange_started';
    if (this.deckSeals[id] <= 0) return 'no_seal';

    const deckCount = this.runDeck.count(card);
    if (deckCount === 0) return 'card_missing';
    if (id === 'duplicate') {
      return this.runDeck.size >= MAX_RUN_DECK_SIZE ? 'size_limit' : 'ready';
    }

    if (this.runDeck.size <= MIN_RUN_DECK_SIZE) return 'size_limit';
    const handCount = this.hand.filter(
      (candidate) => candidate.rank === card.rank && candidate.suit === card.suit,
    ).length;
    return deckCount > handCount ? 'ready' : 'hand_copy_protected';
  }

  applyDeckSeal(id: DeckSealId, card: Card): boolean {
    if (this.deckEditStatus(id, card) !== 'ready') return false;
    const changed = id === 'banish'
      ? this.runDeck.banish(card)
      : this.runDeck.duplicate(card);
    if (!changed) return false;
    this.deckSeals[id]--;
    return true;
  }

  toggleHold(i: number): void {
    if (this.phase !== 'prep' || this.handConfirmed || this.maintenancePending) return;
    this.holds[i] = !this.holds[i];
  }

  get dominantSuitChoicesNow(): Suit[] {
    return dominantSuitChoices(this.hand);
  }

  get dominantSuitNow(): Suit | null {
    const choices = this.dominantSuitChoicesNow;
    if (choices.length === 1) return choices[0];
    return this.selectedDominantSuit && choices.includes(this.selectedDominantSuit)
      ? this.selectedDominantSuit
      : null;
  }

  selectDominantSuit(suit: Suit): boolean {
    if (this.phase !== 'prep' || this.handConfirmed || this.maintenancePending) return false;
    const choices = this.dominantSuitChoicesNow;
    if (choices.length < 2 || !choices.includes(suit)) return false;
    this.selectedDominantSuit = suit;
    return true;
  }

  get exchangeCostNow(): number {
    const mods = relicModifiers(this.relics, this.deckSize);
    return Math.ceil(
      exchangeCost(Math.max(0, this.exchangesUsed - (mods.freeExchanges - 1)))
      * mods.exchangeCostMultiplier,
    );
  }

  doExchange(): boolean {
    if (this.phase !== 'prep' || this.handConfirmed || this.maintenancePending) return false;
    const cost = this.exchangeCostNow;
    if (this.gold < cost) return false;
    const baseFreeExchanges = this.relics.includes('swift_shuffle') ? 2 : 1;
    const compressionTriggered = this.relics.includes('compression_enthusiast')
      && this.deckSize <= 45
      && this.exchangesUsed >= baseFreeExchanges
      && cost === 0;
    this.lastRelicTriggers = compressionTriggered ? ['compression_enthusiast'] : [];
    this.gold -= cost;
    this.hand = this.runDeck.exchange(this.hand, this.holds, this.rng);
    this.exchangesUsed++;
    this.selectedDominantSuit = null;
    return true;
  }

  /** 족보 확정 → 해당 등급 유닛 1기 획득 (배치 대기). 하이카드도 유닛 지급. */
  confirmHand(requireSuitChoice = false): HandRank | null {
    if (this.phase !== 'prep' || this.handConfirmed || this.maintenancePending) return null;
    const choices = this.dominantSuitChoicesNow;
    const suit = this.dominantSuitNow ?? (!requireSuitChoice ? choices[0] : null);
    if (!suit) return null;
    this.handConfirmed = true;
    this.lastRelicGoldBonus = 0;
    this.lastPairBrokerBonus = false;
    this.lastRelicTriggers = [];
    if (this.pendingUnits.length === 0) this.pendingUnitPristine = [];
    const baseRank = evaluateHand(this.hand);
    const variant = handVariant(this.hand, baseRank);
    const bonus = this.round % BOSS_EVERY === 0
      ? relicModifiers(this.relics).bossRankBonus
      : 0;
    // 히든 족보는 실제 카드 조합으로만 얻는다. 보스 유물의 +1 승급은
    // 표준 족보 안에서만 적용하며, 이미 완성한 히든 족보는 낮추지 않는다.
    const rank = baseRank > HandRank.RoyalFlush
      ? baseRank
      : Math.min(HandRank.RoyalFlush, baseRank + bonus) as HandRank;
    this.lastHandRank = rank;
    this.lastHandSuit = suit;
    this.lastHandVariant = variant;
    this.bestHand = Math.max(this.bestHand, rank) as HandRank;
    this.score += scoreForHand(rank);
    const pristine = this.exchangesUsed === 0;
    this.pendingUnits.push(rank);
    this.pendingUnitPristine.push(pristine);
    this.pendingUnitSuits.push(suit);
    this.pendingUnitVariants.push(variant);
    const mods = relicModifiers(this.relics, this.deckSize);
    if (mods.pairBonusUnit && rank === HandRank.Pair) {
      if (this.field.units.length + this.pendingUnits.length < UNIT_CAP) {
        this.pendingUnits.push(rank);
        this.pendingUnitPristine.push(pristine);
        this.pendingUnitSuits.push(suit);
        this.pendingUnitVariants.push(variant);
        this.lastPairBrokerBonus = true;
      } else {
        this.gold += 15;
        this.lastRelicGoldBonus += 15;
      }
      this.lastRelicTriggers.push('pair_broker');
    }
    if (new Set(this.hand.map((card) => card.suit)).size === 4) {
      this.gold += mods.fourSuitGoldBonus;
      this.lastRelicGoldBonus += mods.fourSuitGoldBonus;
      if (mods.fourSuitGoldBonus > 0) this.lastRelicTriggers.push('four_suit_crest');
    }
    return rank;
  }

  // ── 준비 페이즈: 유닛 ──────────────────────────────

  unitAt(tx: number, ty: number): Unit | undefined {
    return this.field.units.find((u) => u.tx === tx && u.ty === ty);
  }

  placeUnit(tx: number, ty: number): boolean {
    if (this.phase !== 'prep' || this.maintenancePending) return false;
    if (this.pendingUnits.length === 0) return false;
    if (this.field.units.length >= UNIT_CAP) return false;
    const tier = this.pendingUnits[0];
    if (!isPlaceable(tx, ty) || this.unitAt(tx, ty)) return false;
    if (!tileCanReachPath(tx, ty, UNIT_DEFS[tier].range)) return false;
    addUnit(
      this.field,
      this.pendingUnits.shift()!,
      tx,
      ty,
      this.pendingUnitPristine.shift() ?? false,
      this.pendingUnitSuits.shift() ?? null,
      this.pendingUnitVariants.shift() ?? null,
    );
    return true;
  }

  discardPendingUnit(): boolean {
    if (this.pendingUnits.length === 0) return false;
    this.pendingUnits.shift();
    this.pendingUnitPristine.shift();
    this.pendingUnitSuits.shift();
    this.pendingUnitVariants.shift();
    return true;
  }

  moveUnit(unitId: number, tx: number, ty: number): boolean {
    if (this.phase !== 'prep' || this.maintenancePending) return false;
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
    if (
      this.phase !== 'prep' || this.maintenancePending
      || unitIds.length !== 3 || new Set(unitIds).size !== 3
    ) return false;
    const materials = unitIds.map((id) => this.field.units.find((unit) => unit.id === id));
    if (materials.some((unit) => !unit)) return false;
    const units = materials as Unit[];
    const tier = units[0].tier;
    if (tier >= HandRank.RoyalFlush || units.some((unit) => unit.tier !== tier)) return false;

    const origin = units[0];
    const consumed = new Set(unitIds);
    this.field.units = this.field.units.filter((unit) => !consumed.has(unit.id));
    const fusedSuit = units.every((unit) => unit.suit === origin.suit) ? origin.suit : null;
    addUnit(this.field, (tier + 1) as HandRank, origin.tx, origin.ty, false, fusedSuit, null);
    return true;
  }

  sellUnit(unitId: number): boolean {
    if (this.phase !== 'prep' || this.maintenancePending) return false;
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
    return this.dmgMult
      * handMasteryMultiplier(this.handMastery, tier)
      * unitSynergyDamageMultiplier(tier, this.synergies, targetIsBoss);
  }

  unitDpsMult(unit: Pick<Unit, 'tier' | 'suit' | 'variant'>, targetIsBoss = false): number {
    return this.unitDamageMult(unit.tier, targetIsBoss)
      * suitDamageMultiplier(unit.suit, targetIsBoss)
      * variantDamageMultiplier(unit.variant)
      / suitPeriodMultiplier(unit.suit)
      / variantPeriodMultiplier(unit.variant);
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

  /** 모든 적 스폰이 끝난 뒤부터 흐르는 현재 라운드 제한시간. */
  get combatTimeRemaining(): number | null {
    if (this.phase !== 'combat' || this.spawnQueue.length > 0) return null;
    const limit = this.round >= ROUNDS ? FINAL_BOSS_MAX_TIME : COMBAT_MAX_TIME;
    return Math.max(0, limit - this.combatTimer);
  }

  chooseRelic(id: RelicId, replaceId?: RelicId): boolean {
    if (
      this.phase !== 'prep'
      || !this.relicChoices.includes(id)
    ) return false;
    const full = this.relics.length >= RELIC_SLOT_CAP;
    if (!full && replaceId) return false;
    if (full && (!replaceId || !this.relics.includes(replaceId))) return false;
    if (replaceId) {
      this.removeRelic(replaceId);
      this.gold += relicSellPrice(replaceId);
    }
    this.addRelic(id);
    this.relicChoices = [];
    this.openNextBossReward();
    return true;
  }

  buyUpgrade(): boolean {
    if (this.phase !== 'prep' || this.maintenancePending) return false;
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

  /** HUD와 텔레그래프가 실제 보스 발동 시계와 같은 값을 표시한다. */
  bossAbilityCountdown(bossRound: number): number | null {
    if (this.phase !== 'combat') return null;
    const alive = this.field.enemies.some(
      (enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === bossRound,
    );
    if (!alive) return null;
    const nextAt = bossRound === 40
      ? this.nextBossTaxAt
      : bossRound === 50 ? this.nextBossSummonAt : Infinity;
    return Number.isFinite(nextAt) ? Math.max(0, nextAt - this.field.time) : null;
  }

  // ── 전투 ──────────────────────────────────────────

  startCombat(): boolean {
    if (
      this.phase !== 'prep'
      || !this.handConfirmed
      || this.pendingUnits.length > 0
      || this.relicChoices.length > 0
      || this.maintenancePending
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

    const triggeredRelics = new Set<RelicId>();
    const result = tick(
      this.field,
      dt,
      this.dmgMult,
      this.synergies,
      (unit, enemy, field) => {
        const relicDamage = relicUnitDamageResult(this.relics, unit, enemy, field);
        for (const id of relicDamage.active) triggeredRelics.add(id);
        return relicDamage.multiplier * handMasteryMultiplier(this.handMastery, unit.tier);
      },
    );
    result.relicTriggers = [...triggeredRelics];
    let diamondBonusGold = 0;
    for (const attack of result.attacks) {
      const unit = this.field.units.find((candidate) => candidate.id === attack.unitId);
      if (!unit) continue;
      this.handDamage[unit.tier] += attack.totalDamage;
      if (unit.suit === 'D' && attack.kills > 0 && this.diamondGoldThisRound < 3) {
        const bonus = Math.min(attack.kills, 3 - this.diamondGoldThisRound);
        this.diamondGoldThisRound += bonus;
        diamondBonusGold += bonus;
      }
    }
    const mods = relicModifiers(this.relics);
    result.goldEarned = Math.floor(result.goldEarned * mods.bountyMultiplier) + diamondBonusGold;
    this.gold += result.goldEarned;
    this.kills += result.deaths.length;
    this.score += result.deaths.reduce(
      (total, enemy) => total + scoreForKills(enemy.round, 1),
      0,
    );

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
      this.defeatReason = 'field-cap';
      this.phase = 'defeat';
      return result;
    }

    if (this.spawnQueue.length === 0) {
      this.combatTimer += dt;
      const currentBossAlive = this.field.enemies.some(
        (enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === this.round,
      );

      // 최종전은 보스 처치가 승리 조건이다. 보스를 잡으면 수행원이 남아 있어도
      // 승리하며, 제한 시간까지 보스가 생존하면 승리 대신 패배한다.
      if (this.round >= ROUNDS) {
        if (!currentBossAlive) this.endRound();
        else if (this.combatTimer >= FINAL_BOSS_MAX_TIME) {
          this.defeatReason = 'final-boss-timeout';
          this.phase = 'defeat';
        }
      } else if (alive === 0 || this.combatTimer >= COMBAT_MAX_TIME) {
        this.endRound();
      }
    }
    return result;
  }

  private endRound(): void {
    const completedRound = this.round;
    const bossDefeated = completedRound % BOSS_EVERY === 0
      && !this.field.enemies.some(
        (enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === completedRound,
      );

    // 보스는 제한시간 후 다음 라운드로 이월될 수 있다. 처치한 시점의 현재
    // 라운드가 아니라 보스가 등장한 라운드를 기준으로 미수령 보상을 적립한다.
    this.queueDefeatedBossRewards();

    // 이번 라운드 스폰분(분열 자식 포함) 전멸 시 클리어 보너스
    const roundCleared = !this.field.enemies.some((e) => e.round === completedRound && e.alive);
    if (roundCleared) {
      this.gold += clearBonus(completedRound);
      this.score += scoreForRoundClear(completedRound);
    }

    if (completedRound >= ROUNDS) {
      // tickCombat의 최종전 판정을 우회해도 생존 보스로 승리할 수 없게 방어한다.
      if (!bossDefeated) {
        this.defeatReason = 'final-boss-timeout';
        this.phase = 'defeat';
        return;
      }
      this.score += VICTORY_SCORE;
      this.phase = 'victory';
      return;
    }

    this.round++;
    if (this.round % BOSS_EVERY === 0) this.pendingMaintenanceRound = this.round;
    this.gold += this.interestNow;
    this.field.enemies = this.field.enemies.filter((e) => e.alive); // 시체 정리, 생존자는 이월
    this.hand = this.runDeck.draw(this.rng);
    this.holds = [false, false, false, false, false];
    this.exchangesUsed = 0;
    this.selectedDominantSuit = null;
    this.lastHandRank = null;
    this.lastHandSuit = null;
    this.lastHandVariant = null;
    this.diamondGoldThisRound = 0;
    this.handConfirmed = false;
    this.phase = 'prep';
    this.openNextBossReward();
  }

  private queueDefeatedBossRewards(): void {
    for (const boss of this.field.enemies) {
      if (
        boss.kind !== 'boss'
        || boss.alive
        || boss.round >= ROUNDS
        || this.queuedBossRewardRounds.has(boss.round)
      ) continue;
      this.queuedBossRewardRounds.add(boss.round);
      this.pendingBossRewardRounds.push(boss.round);
    }
    this.pendingBossRewardRounds.sort((a, b) => a - b);
  }

  private openNextBossReward(): void {
    while (this.relicChoices.length === 0 && this.pendingBossRewardRounds.length > 0) {
      const bossRound = this.pendingBossRewardRounds.shift()!;
      this.relicChoices = makeRelicChoices(this.seed, bossRound, this.relics);
    }
  }

  private addRelic(id: RelicId): void {
    this.relics.push(id);
  }

  private removeRelic(id: RelicId): void {
    const index = this.relics.indexOf(id);
    if (index >= 0) this.relics.splice(index, 1);
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
