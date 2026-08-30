import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { unitIntroDuration, unitSpriteExtent } from '../src/game/unitVisualPolicy';

describe('유닛 비주얼 정책', () => {
  test('고등급 유닛은 초중반보다 한 단계 큰 실루엣을 사용한다', () => {
    expect(unitSpriteExtent(HandRank.FullHouse)).toBeGreaterThan(unitSpriteExtent(HandRank.Flush));
    expect(unitSpriteExtent(HandRank.RoyalFlush)).toBe(unitSpriteExtent(HandRank.FullHouse));
  });

  test('풀하우스 이상만 짧은 등장 강조를 사용한다', () => {
    expect(unitIntroDuration(HandRank.Flush)).toBe(0);
    expect(unitIntroDuration(HandRank.FullHouse)).toBe(420);
    expect(unitIntroDuration(HandRank.RoyalFlush)).toBe(420);
  });
});
