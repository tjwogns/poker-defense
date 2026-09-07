import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { addUnit, createField, spawnEnemy, tick, type CombatTacticHooks } from '../src/core/combat';
import {
  HAND_TACTIC_COPY,
  HAND_TACTIC_COMPACT_COPY,
  createHandTactic,
  handTacticAttackSpeedMultiplier,
  handTacticBountyMultiplier,
  handTacticDamageMultiplier,
  handTacticEnemySpeedMultiplier,
  handTacticOverkillRatio,
  lockHandTacticForCombat,
  tacticIdForRank,
} from '../src/core/handTactics';
import { TILE } from '../src/core/map';

const AT_TILE_3_1 = 2 * TILE;

describe('hand tactics', () => {
  test('Two Pair부터 순서대로 전술을 정하고 히든 3종은 Royal 효과를 상속한다', () => {
    expect(tacticIdForRank(HandRank.Pair)).toBeNull();
    expect([
      HandRank.TwoPair, HandRank.Trips, HandRank.Straight, HandRank.Flush,
      HandRank.FullHouse, HandRank.FourKind, HandRank.StraightFlush, HandRank.RoyalFlush,
    ].map(tacticIdForRank)).toEqual([
      'volley', 'focus-fire', 'roadblock', 'suit-command',
      'stronghold', 'fourth-strike', 'overflow', 'royal-decree',
    ]);
    expect(tacticIdForRank(HandRank.FiveKind)).toBe('royal-decree');
    expect(tacticIdForRank(HandRank.FlushHouse)).toBe('royal-decree');
    expect(tacticIdForRank(HandRank.FlushFive)).toBe('royal-decree');
  });

  test('KO/EN 모든 전술 설명을 제공한다', () => {
    for (const copy of Object.values(HAND_TACTIC_COPY)) {
      expect(copy.ko.length).toBeGreaterThan(5);
      expect(copy.en.length).toBeGreaterThan(5);
    }
    for (const copy of Object.values(HAND_TACTIC_COMPACT_COPY)) {
      expect(copy.ko.length).toBeGreaterThan(5);
      expect(copy.en.length).toBeLessThanOrEqual(34);
    }
  });

  test('Two Pair와 Straight는 같은 라운드 적에게만 공속/이속을 적용한다', () => {
    const field = createField();
    const current = spawnEnemy(field, 'normal', 5);
    const carry = spawnEnemy(field, 'normal', 4);
    const volley = createHandTactic(HandRank.TwoPair, 5, 'S');
    const roadblock = createHandTactic(HandRank.Straight, 5, 'S');
    expect(handTacticAttackSpeedMultiplier(volley, current)).toBe(1.08);
    expect(handTacticAttackSpeedMultiplier(volley, carry)).toBe(1);
    expect(handTacticEnemySpeedMultiplier(roadblock, current)).toBe(0.9);
    expect(handTacticEnemySpeedMultiplier(roadblock, carry)).toBe(1);
  });

  test('Trips는 유닛별 동일 대상 연속 주 공격을 +20%까지 누적하고 이월 적도 대상 변경으로 센다', () => {
    const field = createField();
    const a = spawnEnemy(field, 'normal', 5);
    const carry = spawnEnemy(field, 'normal', 4);
    const unit = addUnit(field, HandRank.Trips, 3, 2);
    const state = createHandTactic(HandRank.Trips, 5, 'H')!;
    expect([1, 2, 3, 4, 5, 6].map(() => handTacticDamageMultiplier(state, unit, a, true)))
      .toEqual([1, 1.05, 1.1, 1.15, 1.2, 1.2]);
    expect(handTacticDamageMultiplier(state, unit, carry, true)).toBe(1);
    expect(handTacticDamageMultiplier(state, unit, a, true)).toBe(1);
    expect(handTacticDamageMultiplier(state, unit, a, false)).toBe(1);
    expect(handTacticDamageMultiplier(state, unit, a, true)).toBe(1.05);
  });

  test('Flush는 대표 문양, Full House는 전투 시작 시 최다 사분면을 잠근다', () => {
    const field = createField();
    const enemy = spawnEnemy(field, 'normal', 5);
    const heart = addUnit(field, HandRank.Pair, 2, 2, false, 'H');
    const spade = addUnit(field, HandRank.Pair, 10, 2, false, 'S');
    const flush = createHandTactic(HandRank.Flush, 5, 'H');
    expect(handTacticDamageMultiplier(flush, heart, enemy, true)).toBe(1.15);
    expect(handTacticDamageMultiplier(flush, spade, enemy, true)).toBe(1);
    expect(handTacticDamageMultiplier(createHandTactic(HandRank.Flush, 5, null), heart, enemy, true)).toBe(1);

    // TL/TR 1:1 동률은 TL. prep에서 TR 유닛을 BL로 옮긴 뒤 잠그면 BL이다.
    const tied = lockHandTacticForCombat(createHandTactic(HandRank.FullHouse, 5, 'H'), [heart, spade])!;
    expect(tied.lockedZone).toBe(0);
    spade.tx = 2;
    spade.ty = 8;
    const moved = lockHandTacticForCombat(createHandTactic(HandRank.FullHouse, 5, 'H'), [heart, spade, {
      ...spade, id: spade.id + 1,
    }])!;
    expect(moved.lockedZone).toBe(2);
    expect(handTacticDamageMultiplier(moved, spade, enemy, true)).toBe(1.15);
    spade.tx = 10;
    expect(handTacticDamageMultiplier(moved, spade, enemy, true)).toBe(1);
    expect(moved.lockedZone).toBe(2);
  });

  test('Quads는 attacker와 무관하게 적별 4/8번째 실제 피격에 +40%를 준다', () => {
    const field = createField();
    const enemy = spawnEnemy(field, 'normal', 7);
    const other = spawnEnemy(field, 'normal', 7);
    const a = addUnit(field, HandRank.Pair, 3, 2);
    const b = addUnit(field, HandRank.Pair, 4, 2);
    const state = createHandTactic(HandRank.FourKind, 7, 'D')!;
    expect(Array.from({ length: 8 }, (_, index) => handTacticDamageMultiplier(
      state, index % 2 ? a : b, enemy, index % 3 === 0,
    ))).toEqual([1, 1, 1, 1.4, 1, 1, 1, 1.4]);
    expect(handTacticDamageMultiplier(state, a, other, true)).toBe(1);
    const carry = spawnEnemy(field, 'normal', 6);
    expect(handTacticDamageMultiplier(state, a, carry, true)).toBe(1);
    // 이월 적 피격은 current 적의 카운터를 건드리지 않으며, 이후 같은 round late spawn은 독립 카운터를 가진다.
    expect(handTacticDamageMultiplier(state, a, enemy, true)).toBe(1);
    const late = spawnEnemy(field, 'normal', 7);
    expect(handTacticDamageMultiplier(state, a, late, true)).toBe(1);
  });

  test('Straight Flush와 Royal은 현재 라운드에만 승인된 전달/피해/골드 배율을 준다', () => {
    const field = createField();
    const current = spawnEnemy(field, 'normal', 8);
    const carry = spawnEnemy(field, 'normal', 7);
    const unit = addUnit(field, HandRank.RoyalFlush, 3, 2);
    const overflow = createHandTactic(HandRank.StraightFlush, 8, 'C');
    const royal = createHandTactic(HandRank.RoyalFlush, 8, 'C');
    expect(handTacticOverkillRatio(overflow, current)).toBe(0.5);
    expect(handTacticOverkillRatio(overflow, carry)).toBe(0);
    expect(handTacticDamageMultiplier(royal, unit, current, true)).toBe(1.2);
    expect(handTacticDamageMultiplier(royal, unit, carry, true)).toBe(1);
    expect(handTacticBountyMultiplier(royal, current)).toBe(1.1);
    expect(handTacticBountyMultiplier(royal, carry)).toBe(1);
  });

  test('overflow는 방어 후 실제 초과 피해 50%를 배열 순서와 무관하게 최저 ID 적에게 1회 전달한다', () => {
    const field = createField();
    const target = spawnEnemy(field, 'tank', 8, { dist: AT_TILE_3_1, hpOverride: 1 });
    const carry = spawnEnemy(field, 'normal', 7, { dist: AT_TILE_3_1, hpOverride: 100 });
    const lowId = spawnEnemy(field, 'normal', 8, { dist: AT_TILE_3_1, hpOverride: 1 });
    const highId = spawnEnemy(field, 'normal', 8, { dist: AT_TILE_3_1, hpOverride: 100 });
    const unit = addUnit(field, HandRank.Pair, 3, 2);
    field.enemies = [target, highId, carry, lowId];
    const state = createHandTactic(HandRank.StraightFlush, 8, 'S')!;
    const hooks: CombatTacticHooks = {
      damageMultiplier: (u, e, primary) => handTacticDamageMultiplier(state, u, e, primary),
      attackSpeedMultiplier: (_u, e) => handTacticAttackSpeedMultiplier(state, e),
      enemySpeedMultiplier: (e) => handTacticEnemySpeedMultiplier(state, e),
      overkillTransferRatio: (_u, e) => handTacticOverkillRatio(state, e),
    };
    const result = tick(field, 1 / 30, 1, () => 1, Infinity, () => 1, hooks);
    // Pair 11.2 × tank 0.75 = 8.4 effective; overkill 7.4, transfer 3.7.
    expect(target.alive).toBe(false);
    expect(lowId.alive).toBe(false);
    expect(carry.hp).toBe(100);
    expect(highId.hp).toBe(100); // lowId 전이 사망의 초과 피해는 재전이되지 않는다.
    expect(result.deaths.map((enemy) => enemy.id)).toEqual([target.id, lowId.id]);
    expect(result.goldEarned).toBe(target.bounty + lowId.bounty);
    expect(result.attacks[0].totalDamage).toBeCloseTo(2);
    expect(unit.id).toBeGreaterThan(highId.id);
  });
});
