import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import { spawnEnemy } from '../src/core/combat';
import { ENEMY_KINDS } from '../src/core/enemies';
import {
  START_GOLD, SELL_REFUND, FIELD_CAP, COMBAT_MAX_TIME, FINAL_BOSS_MAX_TIME, LIFE_MODE_STARTING_LIVES, upgradeCost,
  CROWN_I_BOSS_HP_MULTIPLIER, CROWN_I_ENEMY_HP_MULTIPLIER, CROWN_I_SPEED_MULTIPLIER, BOSS_HP_MULT, enemyHp,
  crownBossHpMultiplier, crownEnemyHpMultiplier, crownSpeedMultiplier, killGold,
} from '../src/core/balance';
import { scoreForKills, scoreForRoundClear } from '../src/core/scoring';
import { PATH_LENGTH, pathLength } from '../src/core/map';
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

  test.each([
    [5, 'fast', 4, 26], [6, 'normal', 26, 4], [7, 'fast', 6, 24],
    [8, 'normal', 24, 6], [9, 'fast', 8, 22],
  ] as const)('R%i 혼합 웨이브 HUD 구성과 실제 스폰 수량이 일치한다', (round, primary, normal, fast) => {
    const g = new Game(250);
    g.round = round;
    expect(g.nextWave()).toMatchObject({
      kind: primary, count: 30,
      composition: [{ kind: 'normal', count: normal }, { kind: 'fast', count: fast }],
    });
    g.confirmHand();
    g.discardPendingUnit();
    expect(g.startCombat()).toBe(true);
    for (let i = 0; i < 30; i++) g.tickCombat(0.45);
    expect(g.field.enemies.filter((enemy) => enemy.kind === 'normal')).toHaveLength(normal);
    expect(g.field.enemies.filter((enemy) => enemy.kind === 'fast')).toHaveLength(fast);
  });

  test('혼합 웨이브는 적별 왕관 배율을 한 번만 적용한다', () => {
    const g = new Game(251, 'classic', 1);
    g.round = 6;
    g.confirmHand();
    g.discardPendingUnit();
    g.startCombat();
    for (let i = 0; i < 30; i++) g.tickCombat(0.45);
    for (const enemy of g.field.enemies) {
      expect(enemy.maxHp).toBeCloseTo(
        enemyHp(6) * ENEMY_KINDS[enemy.kind].hpMult * CROWN_I_ENEMY_HP_MULTIPLIER,
      );
    }
  });

  test('혼합 웨이브 중복 시작을 거부하고 큰 프레임에도 30기만 스폰한다', () => {
    const g = new Game(253);
    g.round = 9;
    g.confirmHand();
    g.discardPendingUnit();
    expect(g.startCombat()).toBe(true);
    expect(g.startCombat()).toBe(false);
    g.tickCombat(30 * 0.45);
    expect(g.field.enemies).toHaveLength(30);
    expect(g.field.enemies.filter((enemy) => enemy.kind === 'normal')).toHaveLength(8);
    expect(g.field.enemies.filter((enemy) => enemy.kind === 'fast')).toHaveLength(22);
  });

  test('혼합 여부와 무관하게 30기 처치 보상·점수를 보존한다', () => {
    const g = new Game(252);
    g.round = 6;
    g.confirmHand();
    g.pendingUnits = [];
    for (let x = 4; x <= 8; x++) {
      g.pendingUnits.push(HandRank.RoyalFlush);
      expect(g.placeUnit(x, 4)).toBe(true);
    }
    const scoreBeforeCombat = g.score;
    g.startCombat();
    runCombat(g);
    expect(g.kills).toBe(30);
    expect(g.goldIncome.bounty).toBe(30 * killGold(6));
    expect(g.score - scoreBeforeCombat).toBe(scoreForKills(6, 30) + scoreForRoundClear(6));
  });

  test('왕관 I은 일반 적·보스 체력과 이동 속도만 공개 배율로 강화한다', () => {
    const regular = new Game(210, 'classic', 1);
    regular.confirmHand();
    expect(regular.placeUnit(5, 2)).toBe(true);
    expect(regular.startCombat()).toBe(true);
    regular.tickCombat(1 / 30);
    expect(regular.field.enemies[0].maxHp).toBeCloseTo(enemyHp(1) * CROWN_I_ENEMY_HP_MULTIPLIER);
    expect(regular.field.enemies[0].speedMultiplier).toBe(CROWN_I_SPEED_MULTIPLIER);

    const boss = new Game(211, 'classic', 1);
    boss.round = 10;
    boss.confirmHand();
    expect(boss.placeUnit(5, 2)).toBe(true);
    expect(boss.startCombat()).toBe(true);
    boss.tickCombat(1 / 30);
    expect(boss.field.enemies[0].maxHp).toBeCloseTo(enemyHp(10) * BOSS_HP_MULT * CROWN_I_BOSS_HP_MULTIPLIER);
  });

  test('LIFE 원정도 왕관 I 배율을 적용하되 라이프 규칙은 유지한다', () => {
    const lifeCrown = new Game(212, 'life-economy', 1);
    expect(lifeCrown.crownLevel).toBe(1);
    expect(lifeCrown.lives).toBe(LIFE_MODE_STARTING_LIVES);
    lifeCrown.confirmHand();
    expect(lifeCrown.placeUnit(5, 2)).toBe(true);
    expect(lifeCrown.startCombat()).toBe(true);
    lifeCrown.tickCombat(1 / 30);
    expect(lifeCrown.field.enemies[0].maxHp).toBeCloseTo(enemyHp(1) * CROWN_I_ENEMY_HP_MULTIPLIER);
    expect(lifeCrown.field.enemies[0].speedMultiplier).toBe(CROWN_I_SPEED_MULTIPLIER);
  });

  test('왕관 단계가 오르면 체력과 속도 증가분을 선형 누적한다', () => {
    const crownThree = new Game(213, 'life-economy', 3);
    crownThree.confirmHand();
    expect(crownThree.placeUnit(5, 2)).toBe(true);
    expect(crownThree.startCombat()).toBe(true);
    crownThree.tickCombat(1 / 30);
    expect(crownThree.field.enemies[0].maxHp).toBeCloseTo(enemyHp(1) * crownEnemyHpMultiplier(3));
    expect(crownThree.field.enemies[0].speedMultiplier).toBe(crownSpeedMultiplier(3));
    expect(crownBossHpMultiplier(3)).toBe(1.75);
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

  test('30기 숫자 상한 없이 빈 타일 수만큼 배치할 수 있다', () => {
    const g = new Game(4);
    const target = 31;
    for (let i = 0; i < target; i++) g.pendingUnits.push(HandRank.RoyalFlush);
    let placed = 0;
    for (let y = 0; y < 12 && placed < target; y++) {
      for (let x = 0; x < 17 && placed < target; x++) {
        if (g.placeUnit(x, y)) placed++;
      }
    }
    expect(placed).toBe(target);
    expect(g.field.units).toHaveLength(target);
  });

  test('판매: 골드 환급 + 유닛 제거', () => {
    const g = new Game(5);
    g.pendingUnits.push(HandRank.Trips);
    g.placeUnit(5, 2);
    const unit = g.field.units[0];
    const before = g.gold;
    expect(g.sellUnit(unit.id)).toBe(true);
    expect(g.gold).toBe(before + SELL_REFUND[HandRank.Trips]);
    expect(g.goldIncome.sales).toBe(SELL_REFUND[HandRank.Trips]);
    expect(g.field.units.length).toBe(0);
  });

  test('왕실 내기 골드는 별도 수입 원장에만 기록한다', () => {
    const g = new Game(500);
    const before = g.gold;
    g.grantWagerGold(35);
    expect(g.gold).toBe(before + 35);
    expect(g.goldIncome.wager).toBe(35);
    expect(g.goldIncome.relic).toBe(0);
    g.confirmHand();
    g.pendingUnits[0] = HandRank.FourKind;
    g.placeUnit(8, 5);
    g.startCombat();
    runCombat(g);
    expect(g.lastRoundSettlement!.income.wager).toBe(35);
    expect(g.lastRoundSettlement!.incomeTotal).toBe(
      Object.values(g.lastRoundSettlement!.income).reduce((sum, value) => sum + value, 0),
    );
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
    expect(g.buyUpgrade()).toBe(true);
    expect(g.gold).toBe(100 - upgradeCost(0));
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
    expect(g.goldIncome.bounty).toBeGreaterThan(0);
    expect(g.goldIncome.clear).toBeGreaterThan(0);
    expect(g.goldIncome.interest).toBeGreaterThan(0);
    expect(g.lastRoundSettlement).toMatchObject({ round: 1, escaped: 0, lifeDamage: 0 });
    expect(g.lastRoundSettlement!.incomeTotal).toBeGreaterThan(0);
    expect(g.lastRoundSettlement!.goldEnd).toBe(g.gold);
  });

  test('라운드 결산은 교환·강화 지출과 다음 강화 비용을 기록한다', () => {
    const g = new Game(77);
    g.gold = 500;
    g.doExchange();
    g.doExchange();
    g.buyUpgrade();
    g.confirmHand();
    g.pendingUnits[0] = HandRank.FourKind;
    g.placeUnit(8, 5);
    g.startCombat();
    runCombat(g);

    expect(g.lastRoundSettlement!.spend.exchange).toBe(10);
    expect(g.lastRoundSettlement!.spend.upgrade).toBe(upgradeCost(0));
    expect(g.lastRoundSettlement!.spendTotal).toBe(10 + upgradeCost(0));
    expect(g.lastRoundSettlement!.nextUpgradeCost).toBe(upgradeCost(1));
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

  test('생명 모드에서 일반 적 1기가 탈출하면 즉시 라이프 1을 잃는다', () => {
    const g = new Game(204, 'life-economy');
    g.handConfirmed = true;
    expect(g.startCombat()).toBe(true);
    spawnEnemy(g.field, 'normal', 1, { dist: pathLength(g.mapId) - 1 });

    expect(g.escapeWarningCount).toBe(1);

    const result = g.tickCombat(1 / 30)!;

    expect(result.escaped).toHaveLength(1);
    expect(result.escaped[0].alive).toBe(false);
    expect(result.escaped[0].escaped).toBe(true);
    expect(g.lives).toBe(LIFE_MODE_STARTING_LIVES - 1);
    expect(g.escapedEnemies).toBe(1);
    expect(g.lifeDamageTaken).toBe(1);
    expect(g.lastLifeDamage).toBe(1);
    expect(g.gold).toBe(START_GOLD);
  });

  test('일반 적 5종은 종류와 무관하게 같은 tick에 각각 라이프 1 피해를 준다', () => {
    const g = new Game(205, 'life-economy');
    g.round = 35;
    g.handConfirmed = true;
    g.startCombat();
    for (const kind of ['normal', 'fast', 'tank', 'regen', 'splitter'] as const) {
      spawnEnemy(g.field, kind, 35, { dist: pathLength(g.mapId) - 1 });
    }

    g.tickCombat(1 / 30);

    expect(g.lives).toBe(LIFE_MODE_STARTING_LIVES - 5);
    expect(g.lifeDamageTaken).toBe(5);
    expect(g.lifeRoundHistory).toHaveLength(1);
    expect(g.lifeRoundHistory[0]).toMatchObject({
      round: 35,
      escaped: 5,
      lifeDamage: 5,
      escapedByKind: { normal: 1, fast: 1, tank: 1, regen: 1, splitter: 1 },
    });
  });

  test('남은 라이프보다 많은 동시 탈출도 실제 피해 합계를 기록하고 라이프는 0으로 고정한다', () => {
    const g = new Game(208, 'life-economy');
    g.lives = 3;
    g.handConfirmed = true;
    g.startCombat();
    for (let i = 0; i < 5; i++) spawnEnemy(g.field, 'normal', 1, { dist: pathLength(g.mapId) - 1 });
    g.tickCombat(1 / 30);
    expect(g.lives).toBe(0);
    expect(g.lifeDamageTaken).toBe(5);
    expect(g.lastLifeDamage).toBe(5);
    expect(g.phase).toBe('defeat');
    expect(g.defeatReason).toBe('life-depleted');
  });

  test('일반 적과 보스가 함께 탈출하면 일반 적 피해를 기록하고 보스는 즉시 패배시킨다', () => {
    const g = new Game(206, 'life-economy');
    g.lives = LIFE_MODE_STARTING_LIVES;
    g.round = 10;
    g.handConfirmed = true;
    g.startCombat();
    spawnEnemy(g.field, 'normal', 10, { dist: pathLength(g.mapId) - 1 });
    spawnEnemy(g.field, 'boss', 10, { dist: pathLength(g.mapId) - 1 });

    g.tickCombat(1 / 30);

    expect(g.lives).toBe(LIFE_MODE_STARTING_LIVES - 1);
    expect(g.phase).toBe('defeat');
    expect(g.defeatReason).toBe('boss-escaped');
    expect(g.lifeRoundHistory[0].escaped).toBe(2);
    expect(g.lifeRoundHistory[0].lifeDamage).toBe(1);
    expect(g.lifeRoundHistory[0].escapedBossHpPercent).toBe(100);
  });

  test('classic 규칙은 적 탈출과 라이프 피해가 없는 기존 동작을 유지한다', () => {
    const g = new Game(209, 'classic');
    g.handConfirmed = true;
    g.startCombat();
    const enemy = spawnEnemy(g.field, 'tank', 1, { dist: pathLength('cross-road') + 1000 });
    g.tickCombat(1 / 30);
    expect(enemy.alive).toBe(true);
    expect(g.escapedEnemies).toBe(0);
    expect(g.lifeDamageTaken).toBe(0);
  });

  test('생명 모드는 일반 제한시간이 지나도 적이 처치되거나 탈출할 때까지 계속된다', () => {
    const g = new Game(207, 'life-economy');
    g.handConfirmed = true;
    expect(g.startCombat()).toBe(true);
    for (let i = 0; i < 30 * (10 + COMBAT_MAX_TIME); i++) g.tickCombat(1 / 30);

    expect(g.phase).toBe('combat');
    expect(g.combatTimeRemaining).toBeNull();
    expect(g.field.enemies.some((enemy) => enemy.alive)).toBe(true);
  });

  test('CLASSIC은 60라운드 최종 보스 제한시간 후 패배를 유지한다', () => {
    const g = new Game(9, 'classic');
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

  test.each(['kill', 'escape'] as const)('LIFE 최종전은 50초 후에도 계속되며 이후 %s로 종료된다', (ending) => {
    const g = new Game(91, 'life-economy');
    g.round = 60;
    expect(g.combatTimeRemaining).toBeNull();
    g.handConfirmed = true;
    expect(g.startCombat()).toBe(true);
    // 시간초과와 탈출 판정을 분리하기 위해 경로 시작에 적들을 고정한다.
    for (let i = 0; i < 30 * (FINAL_BOSS_MAX_TIME + 20); i++) {
      for (const enemy of g.field.enemies) enemy.dist = 0;
      g.tickCombat(1 / 30);
    }
    expect(g.phase).toBe('combat');
    expect(g.defeatReason).toBeNull();
    expect(g.combatTimeRemaining).toBeNull();
    expect(g.lives).toBe(LIFE_MODE_STARTING_LIVES);
    const boss = g.field.enemies.find((enemy) => enemy.kind === 'boss' && enemy.round === 60)!;
    expect(boss.alive).toBe(true);
    if (ending === 'kill') boss.alive = false;
    else boss.dist = pathLength(g.mapId) + 1;
    g.tickCombat(1 / 30);
    expect(g.phase).toBe(ending === 'kill' ? 'victory' : 'defeat');
    expect(g.defeatReason).toBe(ending === 'kill' ? null : 'boss-escaped');
  });

  test.each(['alive', 'missing', 'escaped'] as const)('LIFE 최종 보스 %s 상태는 정산을 우회해도 승리·보상을 받지 못한다', (state) => {
    const g = new Game(92, 'life-economy');
    g.round = 60;
    g.handConfirmed = true;
    g.startCombat();
    for (let i = 0; i < 300; i++) {
      for (const enemy of g.field.enemies) enemy.dist = 0;
      g.tickCombat(1 / 30);
    }
    const boss = g.field.enemies.find((enemy) => enemy.kind === 'boss')!;
    if (state === 'missing') g.field.enemies = [];
    if (state === 'escaped') {
      boss.alive = false;
      boss.escaped = true;
    }
    const before = { gold: g.gold, score: g.score, clear: g.goldIncome.clear, settlement: g.lastRoundSettlement };
    (g as unknown as { endRound(): void }).endRound();
    expect(g.phase).toBe('combat');
    expect(g.defeatReason).toBeNull();
    expect({ gold: g.gold, score: g.score, clear: g.goldIncome.clear, settlement: g.lastRoundSettlement }).toEqual(before);
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
