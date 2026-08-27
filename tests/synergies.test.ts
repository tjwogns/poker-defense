import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { addUnit, createField, spawnEnemy, tick } from '../src/core/combat';
import { TILE } from '../src/core/map';
import {
  familyLabel, synergyStatuses, unitSynergyDamageMultiplier,
} from '../src/core/synergies';

function statusOf(units: HandRank[], id: 'legion' | 'precision' | 'arcane' | 'royal' | 'dragon') {
  return synergyStatuses(units.map((tier) => ({ tier }))).find((status) => status.id === id)!;
}

describe('unit family synergies', () => {
  test('같은 등급을 여러 기 배치해도 계열 종류 수는 한 번만 센다', () => {
    const legion = statusOf([HandRank.HighCard, HandRank.HighCard, HandRank.Pair], 'legion');
    expect(legion.count).toBe(2);
    expect(legion.level).toBe(1);
    expect(legion.activeTier?.description).toBe('모든 피해 +8%');
  });

  test('고급 유닛의 복수 계열이 각각 집계된다', () => {
    const units = [HandRank.FullHouse, HandRank.StraightFlush, HandRank.RoyalFlush];
    expect(statusOf(units, 'royal')).toMatchObject({ count: 3, level: 2 });
    expect(statusOf(units, 'arcane')).toMatchObject({ count: 1, level: 0 });
    expect(familyLabel(HandRank.RoyalFlush)).toBe('용족 · 왕실');
  });

  test('범용·계열·보스 보너스는 곱연산으로 중첩된다', () => {
    const statuses = synergyStatuses([
      { tier: HandRank.HighCard },
      { tier: HandRank.Pair },
      { tier: HandRank.FullHouse },
      { tier: HandRank.FourKind },
      { tier: HandRank.StraightFlush },
      { tier: HandRank.RoyalFlush },
    ]);
    expect(unitSynergyDamageMultiplier(HandRank.Pair, statuses)).toBeCloseTo(1.2 * 1.28);
    expect(unitSynergyDamageMultiplier(HandRank.RoyalFlush, statuses, true)).toBeCloseTo(1.2 * 1.28 * 1.5);
  });

  test('전투 엔진이 활성 군단 시너지를 실제 피해에 적용한다', () => {
    const field = createField();
    const enemy = spawnEnemy(field, 'normal', 20, { dist: 2 * TILE });
    addUnit(field, HandRank.HighCard, 3, 2);
    addUnit(field, HandRank.Pair, 12, 8); // 계열 활성용, 사거리 밖
    const statuses = synergyStatuses(field.units);

    const result = tick(field, 1 / 30, 1, statuses);
    expect(result.attacks[0].damage).toBeCloseTo(8 * 1.08, 3);
    expect(enemy.maxHp - enemy.hp).toBeCloseTo(8 * 1.08, 3);
  });
});
