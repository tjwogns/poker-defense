import { describe, expect, test } from 'vitest';
import {
  enemyHp, exchangeCost, interest, upgradeCost, upgradeMultiplier,
  killGold, clearBonus, SELL_REFUND,
} from '../src/core/balance';
import { UNIT_DEFS, damagePerHit } from '../src/core/units';
import { ENEMY_KINDS, waveKind } from '../src/core/enemies';
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

  test('강화 비용 50×1.2^lv, 효과 +8%/lv 곱연산', () => {
    expect(upgradeCost(0)).toBe(50);
    expect(upgradeCost(1)).toBe(60);
    expect(upgradeMultiplier(0)).toBe(1);
    expect(upgradeMultiplier(2)).toBeCloseTo(1.1664, 4);
  });

  test('처치 골드와 클리어 보너스', () => {
    expect(killGold(1)).toBe(2);
    expect(killGold(10)).toBe(4);
    expect(clearBonus(10)).toBe(40);
  });

  test('판매 환급은 10개 등급 전부 정의', () => {
    expect(SELL_REFUND.length).toBe(10);
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

  test('방어형은 받는 피해 25% 감소, 고속형은 이속 1.6배', () => {
    expect(ENEMY_KINDS.tank.damageTakenMult).toBe(0.75);
    expect(ENEMY_KINDS.fast.speedMult).toBe(1.6);
  });
});
