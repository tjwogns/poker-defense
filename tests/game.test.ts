import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import { spawnEnemy } from '../src/core/combat';
import {
  START_GOLD, UNIT_CAP, SELL_REFUND, FIELD_CAP, COMBAT_MAX_TIME, LIFE_MODE_STARTING_LIVES,
} from '../src/core/balance';
import { PATH_LENGTH } from '../src/core/map';
import { h } from './helpers';

/** 라운드가 끝나 prep으로 돌아오거나 게임이 끝날 때까지 틱 진행 */
function runCombat(game: Game, maxTicks = 5000): void {
  for (let i = 0; i < maxTicks && game.phase === 'combat'; i++) {
    game.tickCombat(1 / 30);
  }
}

describe('Game state machine', () => {
  test('초기 상태: prep, 라운드 1, 시작 골드, 카드 5장', () => {
    const g = new Game(1);
    expect(g.phase).toBe('prep');
    expect(g.round).toBe(1);
    expect(g.gold).toBe(START_GOLD);
    expect(g.hand.length).toBe(5);
  });

  test('확정하면 족보 등급의 배치 대기 유닛이 생기고, 재확정은 불가', () => {
    const g = new Game(1);
    const rank = g.confirmHand();
    expect(rank).not.toBeNull();
    expect(g.pendingUnits.length).toBe(1);
    expect(g.confirmHand()).toBeNull();
    expect(g.pendingUnits.length).toBe(1);
  });

  test('히든 족보는 보스 승급에 의해 낮아지지 않고 초월 유닛으로 확정된다', () => {
    const g = new Game(61);
    g.round = 10;
    g.relics.push('ace_up_sleeve');
    g.hand = h('AS AS AS AS AS');
    expect(g.confirmHand()).toBe(HandRank.FlushFive);
    expect(g.pendingUnits).toEqual([HandRank.FlushFive]);
    expect(g.bestHand).toBe(HandRank.FlushFive);
  });

  test('교환: 첫 회 무료, 이후 골드 차감, 부족하면 실패', () => {
    const g = new Game(2);
    expect(g.doExchange()).toBe(true); // 무료
    expect(g.gold).toBe(START_GOLD);
    expect(g.doExchange()).toBe(true); // 10G
    expect(g.gold).toBe(START_GOLD - 10);
    expect(g.doExchange()).toBe(false); // 25G > 잔액 20G
  });

  test('생명·경제 실험 모드는 라운드당 무료 교환 3회로 제한한다', () => {
    const g = new Game(202, 'life-economy');
    expect(g.lives).toBe(LIFE_MODE_STARTING_LIVES);
    expect(g.maxExchangesNow).toBe(3);
    expect(g.exchangeCostNow).toBe(0);
    expect(g.doExchange()).toBe(true);
    expect(g.doExchange()).toBe(true);
    expect(g.doExchange()).toBe(true);
    expect(g.doExchange()).toBe(false);
    expect(g.gold).toBe(START_GOLD);
    expect(g.exchangesRemaining).toBe(0);
  });

  test('교환 유물은 생명·경제 실험 모드의 최대 교환 횟수를 늘린다', () => {
    const g = new Game(203, 'life-economy');
    g.relics.push('swift_shuffle');
    expect(g.maxExchangesNow).toBe(4);
  });

  test('배치: 경로 타일 불가, 정상 타일 성공, 중복 타일 불가', () => {
    const g = new Game(3);
    g.confirmHand();
    expect(g.placeUnit(1, 1)).toBe(false); // 경로
    expect(g.placeUnit(5, 2)).toBe(true);
    expect(g.pendingUnits.length).toBe(0);
    g.confirmHand(); // 이미 확정됨 → null이지만 대기 유닛은 없음
    expect(g.placeUnit(5, 2)).toBe(false); // 대기 유닛 없음 + 점유 타일
  });

  test('확정한 유닛을 배치하기 전에는 전투를 시작할 수 없다', () => {
    const g = new Game(31);
    g.confirmHand();
    expect(g.startCombat()).toBe(false);
    expect(g.placeUnit(5, 2)).toBe(true);
    expect(g.startCombat()).toBe(true);
  });

  test('배치 상한을 넘길 수 없다', () => {
    const g = new Game(4);
    for (let i = 0; i < UNIT_CAP; i++) g.pendingUnits.push(HandRank.HighCard);
    let placed = 0;
    for (let y = 0; y < 12 && placed < UNIT_CAP; y++) {
      for (let x = 0; x < 17 && placed < UNIT_CAP; x++) {
        if (g.placeUnit(x, y)) placed++;
      }
    }
    expect(placed).toBe(UNIT_CAP);
    g.pendingUnits.push(HandRank.HighCard);
    expect(g.placeUnit(13, 8)).toBe(false); // 상한 도달
  });

  test('판매: 골드 환급 + 유닛 제거', () => {
    const g = new Game(5);
    g.pendingUnits.push(HandRank.Trips);
    g.placeUnit(5, 2);
    const unit = g.field.units[0];
    const before = g.gold;
    expect(g.sellUnit(unit.id)).toBe(true);
    expect(g.gold).toBe(before + SELL_REFUND[HandRank.Trips]);
    expect(g.field.units.length).toBe(0);
  });

  test('준비 단계에서 동일 등급 유닛 3기를 한 단계 위 유닛으로 합성한다', () => {
    const g = new Game(51);
    for (const [x, y] of [[4, 4], [5, 4], [6, 4]]) {
      g.pendingUnits.push(HandRank.Pair);
      expect(g.placeUnit(x, y)).toBe(true);
    }
    const ids = g.field.units.map((unit) => unit.id);

    expect(g.fusionCandidates(HandRank.Pair)).toEqual(ids);
    expect(g.fuseUnits(ids)).toBe(true);
    expect(g.field.units).toHaveLength(1);
    expect(g.field.units[0].tier).toBe(HandRank.TwoPair);
    expect([g.field.units[0].tx, g.field.units[0].ty]).toEqual([4, 4]);
  });

  test('합성은 정확히 같은 등급 3기만 가능하고 신룡은 합성할 수 없다', () => {
    const g = new Game(52);
    for (const tier of [HandRank.Pair, HandRank.Pair, HandRank.Trips]) {
      g.pendingUnits.push(tier);
      g.placeUnit(4 + g.field.units.length, 4);
    }
    const ids = g.field.units.map((unit) => unit.id);
    expect(g.fuseUnits(ids.slice(0, 2))).toBe(false);
    expect(g.fuseUnits(ids)).toBe(false);

    const royal = new Game(53);
    for (let i = 0; i < 3; i++) {
      royal.pendingUnits.push(HandRank.RoyalFlush);
      royal.placeUnit(4 + i, 4);
    }
    expect(royal.fuseUnits(royal.field.units.map((unit) => unit.id))).toBe(false);

    const hidden = new Game(54);
    for (let i = 0; i < 3; i++) {
      hidden.pendingUnits.push(HandRank.FiveKind);
      hidden.placeUnit(4 + i, 4);
    }
    expect(hidden.fuseUnits(hidden.field.units.map((unit) => unit.id))).toBe(false);
  });

  test('전투 중에는 유닛 판매와 공격력 강화를 할 수 없다', () => {
    const g = new Game(54);
    g.pendingUnits.push(HandRank.Pair);
    g.placeUnit(4, 4);
    const unitId = g.field.units[0].id;
    g.gold = 1000;
    g.handConfirmed = true;
    g.startCombat();

    expect(g.sellUnit(unitId)).toBe(false);
    expect(g.buyUpgrade()).toBe(false);
    expect(g.field.units).toHaveLength(1);
    expect(g.gold).toBe(1000);
  });

  test('강화: 비용 차감과 배율 증가', () => {
    const g = new Game(6);
    g.gold = 100;
    expect(g.buyUpgrade()).toBe(true); // 50G
    expect(g.gold).toBe(50);
    expect(g.upgradeLevel).toBe(1);
    expect(g.dmgMult).toBeCloseTo(1.08);
  });

  test('전투 → 라운드 종료 → 다음 라운드 prep (이자 포함)', () => {
    const g = new Game(7);
    g.confirmHand();
    g.pendingUnits[0] = HandRank.FourKind; // 강한 유닛으로 교체 (테스트 가속)
    g.placeUnit(8, 5);
    g.gold = 200;
    expect(g.startCombat()).toBe(true);
    expect(g.phase).toBe('combat');
    runCombat(g);
    expect(g.phase).toBe('prep');
    expect(g.round).toBe(2);
    expect(g.exchangesUsed).toBe(0);
    expect(g.handConfirmed).toBe(false);
    // 이자: 최소 10% (킬 골드로 정확값은 변동) — 골드가 늘었는지만 확인
    expect(g.gold).toBeGreaterThan(200);
  });

  test('필드 적 80마리 초과 시 패배', () => {
    const g = new Game(8);
    g.confirmHand();
    g.pendingUnits = [];
    g.startCombat();
    for (let i = 0; i <= FIELD_CAP; i++) spawnEnemy(g.field, 'normal', 1, { dist: i });
    g.tickCombat(1 / 30);
    expect(g.phase).toBe('defeat');
  });

  test('생명 모드에서 적이 한 바퀴를 완주하면 제거되고 침투가 누적된다', () => {
    const g = new Game(204, 'life-economy');
    g.handConfirmed = true;
    expect(g.startCombat()).toBe(true);
    spawnEnemy(g.field, 'normal', 1, { dist: PATH_LENGTH - 1 });

    const result = g.tickCombat(1 / 30)!;

    expect(result.escaped).toHaveLength(1);
    expect(result.escaped[0].alive).toBe(false);
    expect(result.escaped[0].escaped).toBe(true);
    expect(g.lives).toBe(LIFE_MODE_STARTING_LIVES);
    expect(g.breach).toBe(1);
    expect(g.escapedEnemies).toBe(1);
    expect(g.gold).toBe(START_GOLD);
  });

  test('침투 5 이상이 쌓이면 라이프를 깎고 0이면 패배한다', () => {
    const g = new Game(205, 'life-economy');
    g.lives = 1;
    g.handConfirmed = true;
    g.startCombat();
    for (let i = 0; i < 3; i++) spawnEnemy(g.field, 'tank', 12, { dist: PATH_LENGTH - 1 });

    g.tickCombat(1 / 30);

    expect(g.lives).toBe(0);
    expect(g.breach).toBe(1);
    expect(g.phase).toBe('defeat');
    expect(g.defeatReason).toBe('life-depleted');
  });

  test('보스 탈출은 침투 게이지와 별개로 라이프 3을 즉시 깎는다', () => {
    const g = new Game(206, 'life-economy');
    g.lives = 3;
    g.round = 10;
    g.handConfirmed = true;
    g.startCombat();
    spawnEnemy(g.field, 'boss', 10, { dist: PATH_LENGTH - 1 });

    g.tickCombat(1 / 30);

    expect(g.lives).toBe(0);
    expect(g.breach).toBe(0);
    expect(g.defeatReason).toBe('life-depleted');
  });

  test('60라운드 최종 보스를 처치하지 못하면 제한시간 후 패배', () => {
    const g = new Game(9);
    g.round = 60;
    g.confirmHand();
    g.pendingUnits = [];
    g.startCombat();
    for (let i = 0; i < 30 * (10 + COMBAT_MAX_TIME); i++) g.tickCombat(1 / 30);
    expect(g.phase).toBe('combat'); // 일반 제한시간 32초를 지나도 최종전은 계속된다.
    expect(g.combatTimeRemaining).toBeGreaterThan(0);
    expect(g.combatTimeRemaining).toBeLessThan(20);
    runCombat(g);
    expect(g.phase).toBe('defeat');
    expect(g.defeatReason).toBe('final-boss-timeout');
    expect(g.field.enemies.some((enemy) => enemy.kind === 'boss' && enemy.alive)).toBe(true);
  });

  test('60라운드 최종 보스를 처치해야 승리하고 수행원 생존 여부는 무관하다', () => {
    const g = new Game(90);
    g.round = 60;
    g.confirmHand();
    g.pendingUnits = [];
    g.startCombat();
    for (let i = 0; i < 30 * 10 && g.phase === 'combat'; i++) g.tickCombat(1 / 30);

    const boss = g.field.enemies.find((enemy) => enemy.kind === 'boss' && enemy.round === 60)!;
    boss.alive = false;
    expect(g.field.enemies.some((enemy) => enemy.kind !== 'boss' && enemy.alive)).toBe(true);
    g.tickCombat(1 / 30);

    expect(g.phase).toBe('victory');
  });

  test('보스 라운드는 보스 1 + 수행원으로 구성된다', () => {
    const g = new Game(10);
    g.round = 10;
    g.confirmHand();
    g.pendingUnits = [];
    g.startCombat();
    // 스폰이 모두 끝날 때까지 진행 (0.6s × 11 ≈ 6.6s)
    for (let i = 0; i < 30 * 10 && g.phase === 'combat'; i++) g.tickCombat(1 / 30);
    const bosses = g.field.enemies.filter((e) => e.kind === 'boss');
    expect(bosses.length).toBe(1);
  });
});
