import { describe, expect, test } from 'vitest';
import {
  enemyHp, exchangeCost, interest, upgradeCost, upgradeMultiplier,
  killGold, clearBonus, SELL_REFUND, LIFE_MODE_BOUNTY_MULTIPLIER,
  LIFE_MODE_CLEAR_BONUS_MULTIPLIER,
} from '../src/core/balance';
import { UNIT_DEFS, damagePerHit } from '../src/core/units';
import { ENEMY_KINDS, waveComposition, waveKind, waveSpawnOrder } from '../src/core/enemies';
import { HandRank } from '../src/core/cards/types';

describe('balance formulas', () => {
  test('적 HP 공식: 18 × 1.14^n (시뮬레이션 튜닝 후 값)', () => {
    expect(Math.round(enemyHp(1))).toBe(21);
    expect(enemyHp(30)).toBeGreaterThan(880);
    expect(enemyHp(30)).toBeLessThan(950);
  });

  test('교환 비용: 첫 회 무료, 이후 10/25/50/100/200', () => {
    expect(exchangeCost(0)).toBe(0);
    expect(exchangeCost(1)).toBe(10);
    expect(exchangeCost(2)).toBe(25);
    expect(exchangeCost(3)).toBe(50);
    expect(exchangeCost(4)).toBe(100);
    expect(exchangeCost(5)).toBe(200);
  });

  test('이자: 10%, 상한 50G, 소수점 버림', () => {
    expect(interest(300)).toBe(30);
    expect(interest(1000)).toBe(50);
    expect(interest(7)).toBe(0);
  });

  test('강화 비용 35×1.18^lv, 효과 +8%/lv 곱연산', () => {
    expect(upgradeCost(0)).toBe(35);
    expect(upgradeCost(9)).toBe(155);
    expect(upgradeCost(19)).toBe(813);
    expect(upgradeCost(29)).toBe(4253);
    expect(Array.from({ length: 30 }, (_, level) => upgradeCost(level)).reduce((sum, cost) => sum + cost, 0))
      .toBe(27684);
    expect(upgradeMultiplier(0)).toBe(1);
    expect(upgradeMultiplier(2)).toBeCloseTo(1.1664, 4);
  });

  test('처치 골드와 클리어 보너스', () => {
    expect(killGold(1)).toBe(2);
    expect(killGold(10)).toBe(4);
    expect(clearBonus(10)).toBe(40);
  });

  test('LIFE LAB은 탈출 허용 대가로 처치·클리어 수급을 제한한다', () => {
    expect(LIFE_MODE_BOUNTY_MULTIPLIER).toBe(0.9);
    expect(LIFE_MODE_CLEAR_BONUS_MULTIPLIER).toBe(0.8);
  });

  test('판매 환급은 10개 등급 전부 정의', () => {
    expect(SELL_REFUND.length).toBe(13);
  });
});

describe('unit defs', () => {
  test('10개 족보 전부 유닛이 정의되어 있다', () => {
    for (let tier = 0; tier <= 9; tier++) {
      const def = UNIT_DEFS[tier as HandRank];
      expect(def).toBeDefined();
      expect(def.dps).toBeGreaterThan(0);
      expect(def.range).toBeGreaterThan(0);
      expect(def.period).toBeGreaterThan(0);
    }
  });

  test('타격당 피해 = dps × 공격주기 (궁수 14 × 0.8 = 11.2)', () => {
    expect(damagePerHit(UNIT_DEFS[HandRank.Pair])).toBeCloseTo(11.2);
  });

  test('기획안 스탯: 신룡 dps 1800, 저격수 사거리 6', () => {
    expect(UNIT_DEFS[HandRank.RoyalFlush].dps).toBe(1800);
    expect(UNIT_DEFS[HandRank.Straight].range).toBe(6);
  });
});

describe('enemy kinds & wave schedule', () => {
  test('10의 배수 라운드는 보스', () => {
    expect(waveKind(10)).toBe('boss');
    expect(waveKind(40)).toBe('boss');
  });

  test('신규 타입은 해금 라운드에 데뷔한다 (기획안 등장 스케줄)', () => {
    expect(waveKind(1)).toBe('normal');
    expect(waveKind(5)).toBe('fast');
    expect(waveKind(12)).toBe('tank');
    // 기획안의 R20은 보스 라운드와 충돌 → R21로 보정 (스펙 수정)
    expect(waveKind(21)).toBe('regen');
    expect(waveKind(32)).toBe('splitter');
  });

  test('해금 전에는 등장하지 않는다', () => {
    for (let r = 1; r < 5; r++) expect(waveKind(r)).toBe('normal');
    for (let r = 5; r < 10; r++) expect(['normal', 'fast']).toContain(waveKind(r));
  });

  test('R1~R4는 단일 기본 병력, R5~R9는 normal+fast 30기 혼합이다', () => {
    for (let round = 1; round <= 4; round++) {
      expect(waveComposition(round)).toEqual([{ kind: 'normal', count: 30 }]);
    }
    for (let round = 5; round <= 9; round++) {
      const composition = waveComposition(round);
      expect(composition.map(({ kind }) => kind)).toEqual(['normal', 'fast']);
      expect(composition.every(({ count }) => count > 0)).toBe(true);
      expect(composition.reduce((sum, { count }) => sum + count, 0)).toBe(30);
    }
  });

  test('혼합 웨이브 순서는 카드 RNG와 분리된 seed+round 결정론이며 수량을 보존한다', () => {
    const first = waveSpawnOrder(7123, 8);
    expect(waveSpawnOrder(7123, 8)).toEqual(first);
    expect(waveSpawnOrder(7124, 8)).not.toEqual(first);
    expect(first).toHaveLength(30);
    expect(first.filter((kind) => kind === 'normal')).toHaveLength(24);
    expect(first.filter((kind) => kind === 'fast')).toHaveLength(6);
  });

  test('R10 보스 편성은 boss 1 + normal 10을 유지한다', () => {
    expect(waveComposition(10)).toEqual([{ kind: 'boss', count: 1 }, { kind: 'normal', count: 10 }]);
    expect(waveSpawnOrder(99, 10)).toEqual(['boss', ...Array(10).fill('normal')]);
  });

  test('canonical HP를 바꾸지 않고 초반 혼합 총 HP 변화를 기존 대비 ±12%로 제한한다', () => {
    for (let round = 5; round <= 9; round++) {
      const baseline = 30 * ENEMY_KINDS[waveKind(round)].hpMult;
      const mixed = waveComposition(round).reduce(
        (sum, group) => sum + group.count * ENEMY_KINDS[group.kind].hpMult,
        0,
      );
      expect(Math.abs(mixed / baseline - 1), `R${round}`).toBeLessThanOrEqual(0.12);
    }
  });

  test('방어형은 받는 피해 25% 감소, 고속형은 이속 1.6배', () => {
    expect(ENEMY_KINDS.tank.damageTakenMult).toBe(0.75);
    expect(ENEMY_KINDS.fast.speedMult).toBe(1.6);
  });
});
