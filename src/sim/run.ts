/**
 * 헤드리스 밸런싱 시뮬레이터 (npm run sim [게임수]).
 * 휴리스틱 전략으로 자동 플레이해 클리어율/도달 라운드 통계를 낸다.
 * core만 import — 렌더링 의존성 없음.
 */
import { Game } from '../core/game';
import { HandRank, HAND_NAMES_KO } from '../core/cards/types';
import { evaluateHand } from '../core/cards/evaluator';
import { GRID_W, GRID_H, isPlaceable } from '../core/map';
import { UNIT_CAP } from '../core/balance';
import { RelicId } from '../core/relics';

const GOLD_RESERVE = 300; // 이자용으로 남길 골드

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
function chooseHolds(g: Game): void {
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

function playPrep(g: Game, stats: GameStats): void {
  if (g.relicChoices.length > 0) {
    const priority: RelicId[] = [
      'royal_seal', 'compound_ledger', 'war_chest',
      'swift_shuffle', 'fortified_table', 'ace_up_sleeve',
    ];
    const chosen = priority.find((id) => g.relicChoices.includes(id)) ?? g.relicChoices[0];
    g.chooseRelic(chosen);
  }
  // 이미 트리플 이상이면 그대로 확정, 아니면 무료 교환 1회
  if (evaluateHand(g.hand) < HandRank.Trips) {
    chooseHolds(g);
    g.doExchange();
  }
  // 부유하면 유료 교환으로 고족보 도박 (설계 의도: 도박 vs 확정 강화)
  while (
    g.gold > 400 &&
    g.exchangesUsed < 8 &&
    evaluateHand(g.hand) < HandRank.FullHouse
  ) {
    clearHolds(g);
    chooseHolds(g);
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
        g.pendingUnits.shift(); // 새 유닛이 더 약함 → 버림
        continue;
      }
      g.sellUnit(weakest.id);
    }
    const spot = PLACEMENT.find(([x, y]) => !g.unitAt(x, y));
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
  while (g.gold >= g.upgradeCostNow + GOLD_RESERVE) g.buyUpgrade();

  g.startCombat();
}

interface GameStats {
  seed: number;
  result: 'victory' | 'defeat';
  roundReached: number;
  upgradeLevel: number;
  handCounts: number[];
  score: number;
}

function playGame(seed: number): GameStats {
  const g = new Game(seed);
  const stats: GameStats = {
    seed, result: 'defeat', roundReached: 1, upgradeLevel: 0,
    handCounts: Array(10).fill(0), score: 0,
  };
  const dt = 1 / 30;
  let guard = 0;
  while (g.phase !== 'victory' && g.phase !== 'defeat' && guard++ < 1_000_000) {
    if (g.phase === 'prep') playPrep(g, stats);
    else g.tickCombat(dt);
  }
  stats.result = g.phase === 'victory' ? 'victory' : 'defeat';
  stats.roundReached = g.round;
  stats.upgradeLevel = g.upgradeLevel;
  stats.score = g.score;
  return stats;
}

// ── 실행 ────────────────────────────────────────────
const games = Number(process.argv[2] ?? 30);
const all: GameStats[] = [];
for (let seed = 1; seed <= games; seed++) {
  all.push(playGame(seed));
}

const wins = all.filter((s) => s.result === 'victory').length;
const avgRound = all.reduce((s, g) => s + g.roundReached, 0) / all.length;
const avgUpgrade = all.reduce((s, g) => s + g.upgradeLevel, 0) / all.length;
const avgScore = all.reduce((s, g) => s + g.score, 0) / all.length;
const rounds = all.map((s) => s.roundReached).sort((a, b) => a - b);
const median = rounds[Math.floor(rounds.length / 2)];
const totalHands = all.reduce<number[]>(
  (acc, g) => acc.map((v, i) => v + g.handCounts[i]),
  Array(10).fill(0),
);
const handSum = totalHands.reduce((a, b) => a + b, 0);

console.log(`\n=== 포커 디펜스 시뮬레이션 (${games}판) ===`);
console.log(`클리어율      : ${((wins / games) * 100).toFixed(1)}% (${wins}/${games})`);
console.log(`평균 도달     : R${avgRound.toFixed(1)} / 중앙값 R${median}`);
console.log(`평균 강화 Lv  : ${avgUpgrade.toFixed(1)}`);
console.log(`평균 점수     : ${Math.round(avgScore).toLocaleString()}`);
console.log(`도달 분포     : ${rounds.join(' ')}`);
console.log(`\n족보 분포 (교환 1회 포함 실효 확률):`);
for (let t = 9; t >= 0; t--) {
  const pct = ((totalHands[t] / handSum) * 100).toFixed(2);
  console.log(`  ${HAND_NAMES_KO[t as HandRank].padEnd(12)} ${String(totalHands[t]).padStart(5)}회  ${pct.padStart(6)}%`);
}
