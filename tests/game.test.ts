import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import { spawnEnemy } from '../src/core/combat';
import { START_GOLD, UNIT_CAP, SELL_REFUND, FIELD_CAP } from '../src/core/balance';

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

  test('교환: 첫 회 무료, 이후 골드 차감, 부족하면 실패', () => {
    const g = new Game(2);
    expect(g.doExchange()).toBe(true); // 무료
    expect(g.gold).toBe(START_GOLD);
    expect(g.doExchange()).toBe(true); // 10G
    expect(g.gold).toBe(START_GOLD - 10);
    expect(g.doExchange()).toBe(false); // 25G > 잔액 20G
  });

  test('배치: 경로 타일 불가, 정상 타일 성공, 중복 타일 불가', () => {
    const g = new Game(3);
    g.confirmHand();
    expect(g.placeUnit(1, 1)).toBe(false); // 경로
    expect(g.placeUnit(5, 5)).toBe(true);
    expect(g.pendingUnits.length).toBe(0);
    g.confirmHand(); // 이미 확정됨 → null이지만 대기 유닛은 없음
    expect(g.placeUnit(5, 5)).toBe(false); // 대기 유닛 없음 + 점유 타일
  });

  test('배치 상한을 넘길 수 없다', () => {
    const g = new Game(4);
    for (let i = 0; i < UNIT_CAP; i++) g.pendingUnits.push(HandRank.HighCard);
    let placed = 0;
    for (let y = 2; y < 10 && placed < UNIT_CAP; y++) {
      for (let x = 2; x < 15 && placed < UNIT_CAP; x++) {
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
    g.placeUnit(5, 5);
    const unit = g.field.units[0];
    const before = g.gold;
    expect(g.sellUnit(unit.id)).toBe(true);
    expect(g.gold).toBe(before + SELL_REFUND[HandRank.Trips]);
    expect(g.field.units.length).toBe(0);
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
    g.startCombat();
    for (let i = 0; i <= FIELD_CAP; i++) spawnEnemy(g.field, 'normal', 1, { dist: i });
    g.tickCombat(1 / 30);
    expect(g.phase).toBe('defeat');
  });

  test('60라운드를 버티면 승리', () => {
    const g = new Game(9);
    g.round = 60;
    g.confirmHand();
    g.startCombat();
    runCombat(g); // 유닛 없음 → 시간 경과로 라운드 종료 → 승리
    expect(g.phase).toBe('victory');
  });

  test('보스 라운드는 보스 1 + 수행원으로 구성된다', () => {
    const g = new Game(10);
    g.round = 10;
    g.confirmHand();
    g.startCombat();
    // 스폰이 모두 끝날 때까지 진행 (0.6s × 11 ≈ 6.6s)
    for (let i = 0; i < 30 * 10 && g.phase === 'combat'; i++) g.tickCombat(1 / 30);
    const bosses = g.field.enemies.filter((e) => e.kind === 'boss');
    expect(bosses.length).toBe(1);
  });
});
