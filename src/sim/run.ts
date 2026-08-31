/**
 * 헤드리스 밸런싱 시뮬레이터 (npm run sim [게임수]).
 * 휴리스틱 전략으로 자동 플레이해 클리어율/도달 라운드 통계를 낸다.
 * core만 import — 렌더링 의존성 없음.
 */
import { DeckSealId, Game } from '../core/game';
import { Card, HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { evaluateHand } from '../core/cards/evaluator';
import { GRID_W, GRID_H, isPlaceable, tileCanReachPath } from '../core/map';
import { UNIT_CAP } from '../core/balance';
import { RelicId } from '../core/relics';
import { UNIT_DEFS } from '../core/units';

const GOLD_RESERVE = 300; // 이자용으로 남길 골드
const MAINTENANCE_STRATEGIES = ['skip', 'banish', 'duplicate', 'both', 'hidden'] as const;
type MaintenanceStrategy = typeof MAINTENANCE_STRATEGIES[number];
const RELIC_STRATEGIES = ['skip', 'always', 'targeted'] as const;
type RelicStrategy = typeof RELIC_STRATEGIES[number];
const MASTERY_STRATEGIES = ['skip', 'always', 'low', 'high'] as const;
type MasteryStrategy = typeof MASTERY_STRATEGIES[number];

const RELIC_PRIORITY: RelicId[] = [
  'pair_broker', 'underdog_banner', 'pristine_oath', 'compression_enthusiast',
  'delay_tactics', 'four_suit_crest', 'royal_seal', 'war_chest', 'compound_ledger',
  'swift_shuffle', 'rear_position', 'fortified_table', 'ace_up_sleeve',
  'royal_bloodline', 'glass_crown', 'frozen_clover', 'blood_contract', 'greedy_ledger',
];

/** 60라운드 중 현실적인 고점 6회를 가정한 화력 상한 실험용 패. */
const HIGH_HAND_SCHEDULE = new Map<number, readonly Card[]>([
  [5, cards('AS AH AD KS KH')],
  [15, cards('QS QH QD JS JH')],
  [25, cards('8S 8H 8D 8C AS')],
  [35, cards('10S 10H 10D 9S 9H')],
  [45, cards('7S 7H 7D 7C KS')],
  [55, cards('9S 10S JS QS KS')],
]);

/** 경로에 가까운 타일부터 선호하는 배치 순서 */
function placementOrder(): Array<[number, number]> {
  const tiles: Array<[number, number, number]> = [];
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      if (!isPlaceable(x, y)) continue;
      // 경로 링(테두리 x=1..15, y=1..10)까지의 최소 거리
      const dPath = Math.min(
        Math.abs(y - 1), Math.abs(y - 10),
        Math.abs(x - 1), Math.abs(x - 15),
      );
      tiles.push([x, y, dPath]);
    }
  }
  tiles.sort((a, b) => a[2] - b[2]);
  return tiles.map(([x, y]) => [x, y]);
}
const PLACEMENT = placementOrder();

/** 홀드 전략: 페어 이상 랭크 그룹 유지, 없으면 4장 플러시 드로우 유지 */
function chooseHolds(g: Game, strategy: MaintenanceStrategy): void {
  if (strategy === 'hidden') {
    const rankCounts = new Map<number, number>();
    for (const card of g.deckSnapshot()) rankCounts.set(card.rank, (rankCounts.get(card.rank) ?? 0) + 1);
    const targetRank = [...rankCounts.entries()]
      .filter(([, count]) => count > 4)
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
    if (targetRank !== undefined && g.hand.some((card) => card.rank === targetRank)) {
      g.hand.forEach((card, index) => {
        if (card.rank === targetRank && !g.holds[index]) g.toggleHold(index);
      });
      return;
    }
  }
  const counts = new Map<number, number>();
  for (const c of g.hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const hasGroup = [...counts.values()].some((n) => n >= 2);
  if (hasGroup) {
    g.hand.forEach((c, i) => {
      if ((counts.get(c.rank) ?? 0) >= 2 && !g.holds[i]) g.toggleHold(i);
    });
    return;
  }
  const suitCounts = new Map<string, number>();
  for (const c of g.hand) suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  const flushSuit = [...suitCounts.entries()].find(([, n]) => n === 4)?.[0];
  if (flushSuit) {
    g.hand.forEach((c, i) => {
      if (c.suit === flushSuit && !g.holds[i]) g.toggleHold(i);
    });
  }
}

function clearHolds(g: Game): void {
  g.holds.forEach((held, i) => {
    if (held) g.toggleHold(i);
  });
}

function playPrep(
  g: Game,
  stats: GameStats,
  strategy: MaintenanceStrategy,
  relicStrategy: RelicStrategy,
  masteryStrategy: MasteryStrategy,
  upgradeFromRound: number,
  forcedHands: ReadonlyMap<number, readonly Card[]>,
): void {
  if (g.relicChoices.length > 0) {
    const chosen = RELIC_PRIORITY.find((id) => g.relicChoices.includes(id)) ?? g.relicChoices[0];
    const replacement = g.relicSlotsRemaining === 0 ? weakestOwnedRelic(g) : undefined;
    g.chooseRelic(chosen, replacement);
  }
  if (g.maintenancePending) playMaintenance(g, stats, strategy, relicStrategy, masteryStrategy);
  const forcedHand = forcedHands.get(g.round);
  if (forcedHand) g.hand = forcedHand.map((card) => ({ ...card }));
  // 이미 트리플 이상이면 그대로 확정, 아니면 무료 교환 1회
  if (evaluateHand(g.hand) < HandRank.Trips) {
    chooseHolds(g, strategy);
    g.doExchange();
  }
  // 부유하면 유료 교환으로 고족보 도박 (설계 의도: 도박 vs 확정 강화)
  while (
    g.gold > 400 &&
    g.exchangesUsed < 8 &&
    evaluateHand(g.hand) < HandRank.FullHouse
  ) {
    clearHolds(g);
    chooseHolds(g, strategy);
    if (!g.doExchange()) break;
  }
  const rank = g.confirmHand();
  if (rank !== null) stats.handCounts[rank]++;

  // 배치 (상한 도달 시 더 낮은 등급 유닛을 팔아 자리 확보)
  while (g.pendingUnits.length > 0) {
    const tier = g.pendingUnits[0];
    if (g.field.units.length >= UNIT_CAP) {
      const weakest = [...g.field.units].sort((a, b) => a.tier - b.tier)[0];
      if (weakest.tier >= tier) {
        g.discardPendingUnit(); // 새 유닛이 더 약함 → 버림
        continue;
      }
      g.sellUnit(weakest.id);
    }
    const spot = PLACEMENT.find(([x, y]) => (
      !g.unitAt(x, y) && tileCanReachPath(x, y, UNIT_DEFS[tier].range)
    ));
    if (!spot) break;
    g.placeUnit(spot[0], spot[1]);
  }

  // 낮은 등급부터 3기 합성. 합성 결과가 다시 3기가 되면 연쇄 합성한다.
  let fused = true;
  while (fused) {
    fused = false;
    for (let tier = HandRank.HighCard; tier < HandRank.RoyalFlush; tier++) {
      const ids = g.fusionCandidates(tier).slice(0, 3);
      if (ids.length === 3 && g.fuseUnits(ids)) {
        fused = true;
        break;
      }
    }
  }

  // 강화: 예비 골드를 남기고 전부 투자
  while (g.round >= upgradeFromRound && g.gold >= g.upgradeCostNow + GOLD_RESERVE) g.buyUpgrade();

  g.startCombat();
}

function playMaintenance(
  g: Game,
  stats: GameStats,
  strategy: MaintenanceStrategy,
  relicStrategy: RelicStrategy,
  masteryStrategy: MasteryStrategy,
): void {
  stats.maintenanceVisits++;
  const wanted: DeckSealId[] = strategy === 'both'
    ? ['banish', 'duplicate']
    : strategy === 'skip' ? []
      : strategy === 'hidden' ? ['duplicate'] : [strategy];
  for (const id of wanted) {
    const cost = g.maintenanceOffer(id).cost;
    if (!g.buyMaintenanceSeal(id)) continue;
    stats.sealPurchases[id]++;
    stats.sealSpend += cost;
  }
  const relicOffer = g.maintenanceRelicOffer();
  if (relicOffer && shouldBuyRelic(relicOffer.id, relicStrategy)) {
    const replacement = relicOffer.requiresReplacement ? weakestOwnedRelic(g) : undefined;
    const priced = g.maintenanceRelicOffer(replacement);
    if (priced && g.buyMaintenanceRelic(replacement)) {
      stats.relicPurchases++;
      stats.relicSpend += priced.cost - priced.refund;
    }
  }
  const masteryOffer = g.maintenanceMasteryOffer();
  if (masteryOffer && shouldBuyMastery(masteryOffer.rank, masteryStrategy) && g.buyMaintenanceMastery()) {
    stats.masteryPurchases++;
    stats.masterySpend += masteryOffer.cost;
  }
  g.leaveMaintenance();
  useOwnedSeals(g, strategy);
}

function shouldBuyMastery(rank: HandRank, strategy: MasteryStrategy): boolean {
  if (strategy === 'skip') return false;
  if (strategy === 'always') return true;
  if (strategy === 'low') return rank <= HandRank.Trips;
  return rank >= HandRank.Straight;
}

function shouldBuyRelic(id: RelicId, strategy: RelicStrategy): boolean {
  if (strategy === 'skip') return false;
  if (strategy === 'always') return true;
  return RELIC_PRIORITY.indexOf(id) <= RELIC_PRIORITY.indexOf('four_suit_crest');
}

function weakestOwnedRelic(g: Game): RelicId {
  return [...g.relics].sort((a, b) => RELIC_PRIORITY.indexOf(b) - RELIC_PRIORITY.indexOf(a))[0];
}

function useOwnedSeals(g: Game, strategy: MaintenanceStrategy): void {
  if (strategy === 'banish' || strategy === 'both') {
    while (g.deckSeals.banish > 0) {
      const target = banishTarget(g);
      if (!target || !g.applyDeckSeal('banish', target)) break;
    }
  }
  if (strategy === 'duplicate' || strategy === 'both' || strategy === 'hidden') {
    const target = duplicateTarget(g);
    while (target && g.deckSeals.duplicate > 0 && g.applyDeckSeal('duplicate', target)) {
      // 한 방문에서 산 재고를 모두 같은 핵심 카드에 집중한다.
    }
  }
}

function banishTarget(g: Game): Card | undefined {
  const handCounts = new Map<string, number>();
  for (const card of g.hand) {
    const key = cardKey(card);
    handCounts.set(key, (handCounts.get(key) ?? 0) + 1);
  }
  return g.deckSnapshot()
    .filter((card) => g.deckCardCount(card) > (handCounts.get(cardKey(card)) ?? 0))
    .sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit))[0];
}

function duplicateTarget(g: Game): Card | undefined {
  return g.deckSnapshot()
    .sort((a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit))[0];
}

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function cards(value: string): Card[] {
  return value.split(' ').map((token) => {
    const suit = token.slice(-1) as Card['suit'];
    const rankToken = token.slice(0, -1);
    const rank = rankToken === 'A' ? 14 : rankToken === 'K' ? 13
      : rankToken === 'Q' ? 12 : rankToken === 'J' ? 11 : Number(rankToken);
    return { rank, suit };
  });
}

interface GameStats {
  seed: number;
  result: 'victory' | 'defeat';
  roundReached: number;
  upgradeLevel: number;
  handCounts: number[];
  score: number;
  maintenanceVisits: number;
  sealPurchases: Record<DeckSealId, number>;
  sealSpend: number;
  relicPurchases: number;
  relicSpend: number;
  masteryPurchases: number;
  masterySpend: number;
  deckSize: number;
  goldEnd: number;
  finalBossHpPct: number;
}

function playGame(
  seed: number,
  strategy: MaintenanceStrategy,
  relicStrategy: RelicStrategy = 'skip',
  masteryStrategy: MasteryStrategy = 'skip',
  upgradeFromRound = 1,
  forcedHands: ReadonlyMap<number, readonly Card[]> = new Map(),
): GameStats {
  const g = new Game(seed);
  const stats: GameStats = {
    seed, result: 'defeat', roundReached: 1, upgradeLevel: 0,
    handCounts: Array(HandRank.FlushFive + 1).fill(0), score: 0,
    maintenanceVisits: 0, sealPurchases: { banish: 0, duplicate: 0 },
    sealSpend: 0, relicPurchases: 0, relicSpend: 0, masteryPurchases: 0, masterySpend: 0,
    deckSize: 52, goldEnd: 0,
    finalBossHpPct: 1,
  };
  const dt = 1 / 30;
  let guard = 0;
  while (g.phase !== 'victory' && g.phase !== 'defeat' && guard++ < 1_000_000) {
    if (g.phase === 'prep') {
      playPrep(g, stats, strategy, relicStrategy, masteryStrategy, upgradeFromRound, forcedHands);
    }
    else {
      g.tickCombat(dt);
    }
  }
  stats.result = g.phase === 'victory' ? 'victory' : 'defeat';
  stats.roundReached = g.round;
  stats.upgradeLevel = g.upgradeLevel;
  stats.score = g.score;
  stats.deckSize = g.deckSize;
  stats.goldEnd = g.gold;
  const finalBoss = g.field.enemies.find((enemy) => enemy.kind === 'boss' && enemy.round === 60);
  stats.finalBossHpPct = finalBoss ? Math.max(0, finalBoss.hp / finalBoss.maxHp) : 0;
  return stats;
}

// ── 실행 ────────────────────────────────────────────
const games = Number(process.argv[2] ?? 30);
const strategyArg = process.argv[3] ?? 'skip';
if (strategyArg === 'compare') printComparison(games);
else if (strategyArg === 'relic-compare') printRelicComparison(games);
else if (strategyArg === 'hidden-compare') printHiddenComparison(games);
else if (strategyArg === 'mastery-compare') printMasteryComparison(games);
else if (strategyArg === 'clear') printClearAttempt(runClearGames(games, 1), 1);
else if (strategyArg === 'clear-delay30') printClearAttempt(runClearGames(games, 31), 31);
else if (strategyArg === 'clear-high6') printClearAttempt(runHighHandGames(games), 1, '고족보 6회');
else if (MAINTENANCE_STRATEGIES.includes(strategyArg as MaintenanceStrategy)) {
  printDetails(runGames(games, strategyArg as MaintenanceStrategy), strategyArg as MaintenanceStrategy);
} else {
  throw new Error(`unknown maintenance strategy: ${strategyArg}`);
}

function runGames(count: number, strategy: MaintenanceStrategy): GameStats[] {
  return Array.from({ length: count }, (_, index) => playGame(index + 1, strategy));
}

function runRelicGames(count: number, strategy: RelicStrategy): GameStats[] {
  return Array.from({ length: count }, (_, index) => playGame(index + 1, 'both', strategy));
}

function runMasteryGames(count: number, strategy: MasteryStrategy): GameStats[] {
  return Array.from(
    { length: count },
    (_, index) => playGame(index + 1, 'both', 'targeted', strategy),
  );
}

/** 클리어 지향 빌드의 강화 시작 라운드를 바꿔 동일 시드로 비교한다. */
function runClearGames(count: number, upgradeFromRound: number): GameStats[] {
  return Array.from(
    { length: count },
    (_, index) => playGame(index + 1, 'both', 'targeted', 'low', upgradeFromRound),
  );
}

function runHighHandGames(count: number): GameStats[] {
  return Array.from(
    { length: count },
    (_, index) => playGame(index + 1, 'both', 'targeted', 'low', 1, HIGH_HAND_SCHEDULE),
  );
}

function printComparison(count: number): void {
  console.log(`\n=== v2 정비소 경제 비교 (동일 시드 각 ${count}판) ===`);
  console.log('전략       승률   평균R  강화Lv  T+%   방문  상점G  구매(추/복)  최종덱  종료G');
  for (const strategy of MAINTENANCE_STRATEGIES) {
    const all = runGames(count, strategy);
    const wins = all.filter((game) => game.result === 'victory').length;
    const avg = (value: (game: GameStats) => number) => (
      all.reduce((sum, game) => sum + value(game), 0) / all.length
    );
    const banish = all.reduce((sum, game) => sum + game.sealPurchases.banish, 0);
    const duplicate = all.reduce((sum, game) => sum + game.sealPurchases.duplicate, 0);
    const hands = all.reduce((sum, game) => sum + game.handCounts.reduce((a, b) => a + b, 0), 0);
    const advancedHands = all.reduce(
      (sum, game) => sum + game.handCounts.slice(HandRank.Trips).reduce((a, b) => a + b, 0),
      0,
    );
    console.log(
      `${strategy.padEnd(10)} ${((wins / count) * 100).toFixed(1).padStart(5)}% `
      + `${avg((game) => game.roundReached).toFixed(1).padStart(6)} `
      + `${avg((game) => game.upgradeLevel).toFixed(1).padStart(7)} `
      + `${((advancedHands / hands) * 100).toFixed(1).padStart(5)} `
      + `${avg((game) => game.maintenanceVisits).toFixed(1).padStart(5)} `
      + `${avg((game) => game.sealSpend).toFixed(1).padStart(6)} `
      + `${`${banish}/${duplicate}`.padStart(11)} `
      + `${avg((game) => game.deckSize).toFixed(1).padStart(6)} `
      + `${avg((game) => game.goldEnd).toFixed(0).padStart(6)}`,
    );
  }
}

function printRelicComparison(count: number): void {
  console.log(`\n=== v2 유물 구매 전략 비교 (인장 both · 동일 시드 각 ${count}판) ===`);
  console.log('전략       승률   평균R  강화Lv  구매수  유물G  종료G  최종보스HP');
  for (const strategy of RELIC_STRATEGIES) {
    const all = runRelicGames(count, strategy);
    const wins = all.filter((game) => game.result === 'victory').length;
    const avg = (value: (game: GameStats) => number) => (
      all.reduce((sum, game) => sum + value(game), 0) / all.length
    );
    console.log(
      `${strategy.padEnd(10)} ${((wins / count) * 100).toFixed(1).padStart(5)}% `
      + `${avg((game) => game.roundReached).toFixed(1).padStart(6)} `
      + `${avg((game) => game.upgradeLevel).toFixed(1).padStart(7)} `
      + `${avg((game) => game.relicPurchases).toFixed(1).padStart(6)} `
      + `${avg((game) => game.relicSpend).toFixed(1).padStart(6)} `
      + `${avg((game) => game.goldEnd).toFixed(0).padStart(6)} `
      + `${(avg((game) => game.finalBossHpPct) * 100).toFixed(1).padStart(10)}%`,
    );
  }
}

function printHiddenComparison(count: number): void {
  console.log(`\n=== v2 히든 족보 전략 비교 (동일 시드 각 ${count}판) ===`);
  console.log('전략       승률   평균R  복제수  히든패  파이브/하우스/플러시5');
  for (const strategy of ['skip', 'duplicate', 'hidden'] as MaintenanceStrategy[]) {
    const all = runGames(count, strategy);
    const wins = all.filter((game) => game.result === 'victory').length;
    const avgRound = all.reduce((sum, game) => sum + game.roundReached, 0) / all.length;
    const duplicates = all.reduce((sum, game) => sum + game.sealPurchases.duplicate, 0);
    const hidden = all.reduce(
      (sum, game) => sum + game.handCounts.slice(HandRank.FiveKind).reduce((a, b) => a + b, 0),
      0,
    );
    const byRank = [HandRank.FiveKind, HandRank.FlushHouse, HandRank.FlushFive]
      .map((rank) => all.reduce((sum, game) => sum + game.handCounts[rank], 0));
    console.log(
      `${strategy.padEnd(10)} ${((wins / count) * 100).toFixed(1).padStart(5)}% `
      + `${avgRound.toFixed(1).padStart(6)} `
      + `${(duplicates / count).toFixed(1).padStart(6)} `
      + `${String(hidden).padStart(6)}  ${byRank.join('/')}`,
    );
  }
}

function printMasteryComparison(count: number): void {
  console.log(`\n=== v2 족보 연마 전략 비교 (인장 both · 선별 유물 · 동일 시드 각 ${count}판) ===`);
  console.log('전략       승률   평균R  강화Lv  연마수  연마G  종료G  최종보스HP');
  for (const strategy of MASTERY_STRATEGIES) {
    const all = runMasteryGames(count, strategy);
    const wins = all.filter((game) => game.result === 'victory').length;
    const avg = (value: (game: GameStats) => number) => (
      all.reduce((sum, game) => sum + value(game), 0) / all.length
    );
    console.log(
      `${strategy.padEnd(10)} ${((wins / count) * 100).toFixed(1).padStart(5)}% `
      + `${avg((game) => game.roundReached).toFixed(1).padStart(6)} `
      + `${avg((game) => game.upgradeLevel).toFixed(1).padStart(7)} `
      + `${avg((game) => game.masteryPurchases).toFixed(1).padStart(6)} `
      + `${avg((game) => game.masterySpend).toFixed(1).padStart(6)} `
      + `${avg((game) => game.goldEnd).toFixed(0).padStart(6)} `
      + `${(avg((game) => game.finalBossHpPct) * 100).toFixed(1).padStart(10)}%`,
    );
  }
}

function printClearAttempt(all: GameStats[], upgradeFromRound: number, extraLabel = ''): void {
  const wins = all.filter((game) => game.result === 'victory').length;
  const upgradeLabel = upgradeFromRound <= 1 ? '즉시 강화' : `R${upgradeFromRound} 강화 시작`;
  const scenario = extraLabel ? `${extraLabel} · ` : '';
  console.log(`\n=== v2 클리어 도전 (${all.length}판 · ${scenario}${upgradeLabel} · 인장 both · 선별 유물 · 저족보 연마) ===`);
  console.log('시드  결과    도달   강화  유물구매  연마구매  덱크기  종료G  최종보스HP');
  for (const game of all) {
    console.log(
      `${String(game.seed).padStart(4)}  ${(game.result === 'victory' ? '클리어' : '패배').padEnd(6)} `
      + `${`R${game.roundReached}`.padStart(5)} `
      + `${String(game.upgradeLevel).padStart(6)} `
      + `${String(game.relicPurchases).padStart(8)} `
      + `${String(game.masteryPurchases).padStart(8)} `
      + `${String(game.deckSize).padStart(7)} `
      + `${String(game.goldEnd).padStart(6)} `
      + `${game.roundReached >= 60 ? `${(game.finalBossHpPct * 100).toFixed(1)}%` : '미도달'}`,
    );
  }
  const avgRound = all.reduce((sum, game) => sum + game.roundReached, 0) / all.length;
  console.log(`클리어율 ${((wins / all.length) * 100).toFixed(1)}% (${wins}/${all.length}) · 평균 도달 R${avgRound.toFixed(1)}`);
}

function printDetails(all: GameStats[], strategy: MaintenanceStrategy): void {
  const wins = all.filter((game) => game.result === 'victory').length;
  const avgRound = all.reduce((sum, game) => sum + game.roundReached, 0) / all.length;
  const avgUpgrade = all.reduce((sum, game) => sum + game.upgradeLevel, 0) / all.length;
  const avgScore = all.reduce((sum, game) => sum + game.score, 0) / all.length;
  const avgSpend = all.reduce((sum, game) => sum + game.sealSpend, 0) / all.length;
  const rounds = all.map((game) => game.roundReached).sort((a, b) => a - b);
  const median = rounds[Math.floor(rounds.length / 2)];
  const totalHands = all.reduce<number[]>(
    (acc, game) => acc.map((value, index) => value + game.handCounts[index]),
    Array(HandRank.FlushFive + 1).fill(0),
  );
  const handSum = totalHands.reduce((a, b) => a + b, 0);
  console.log(`\n=== 포커 디펜스 시뮬레이션 (${all.length}판 · 정비소 ${strategy}) ===`);
  console.log(`클리어율      : ${((wins / all.length) * 100).toFixed(1)}% (${wins}/${all.length})`);
  console.log(`평균 도달     : R${avgRound.toFixed(1)} / 중앙값 R${median}`);
  console.log(`평균 강화 Lv  : ${avgUpgrade.toFixed(1)}`);
  console.log(`평균 점수     : ${Math.round(avgScore).toLocaleString()}`);
  console.log(`평균 정비 지출: ${avgSpend.toFixed(1)}G`);
  console.log(`도달 분포     : ${rounds.join(' ')}`);
  console.log('\n족보 분포 (교환 1회 포함 실효 확률):');
  for (let tier = HandRank.FlushFive; tier >= HandRank.HighCard; tier--) {
    const pct = handSum > 0 ? ((totalHands[tier] / handSum) * 100).toFixed(2) : '0.00';
    console.log(
      `  ${HAND_NAMES_KO[tier as HandRank].padEnd(12)} `
      + `${String(totalHands[tier]).padStart(5)}회  ${pct.padStart(6)}%`,
    );
  }
}
