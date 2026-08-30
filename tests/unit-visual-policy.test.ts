import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { unitIntroDuration, unitSpriteExtent } from '../src/game/unitVisualPolicy';

describe('유닛 비주얼 정책', () => {
  test('고등급 유닛은 초중반보다 한 단계 큰 실루엣을 사용한다', () => {
    expect(unitSpriteExtent(HandRank.FullHouse)).toBeGreaterThan(unitSpriteExtent(HandRank.Flush));
    expect(unitSpriteExtent(HandRank.RoyalFlush)).toBe(unitSpriteExtent(HandRank.FullHouse));
  });

  test('히든 초월 유닛은 표준 고등급보다 더 큰 실루엣을 사용한다', () => {
    expect(unitSpriteExtent(HandRank.FiveKind)).toBeGreaterThan(unitSpriteExtent(HandRank.RoyalFlush));
    expect(unitSpriteExtent(HandRank.FlushFive)).toBe(54);
  });

  test('표준 고등급은 짧은 등장 강조를 사용한다', () => {
    expect(unitIntroDuration(HandRank.Flush)).toBe(0);
    expect(unitIntroDuration(HandRank.FullHouse)).toBe(420);
    expect(unitIntroDuration(HandRank.RoyalFlush)).toBe(420);
  });

  test('히든 초월 유닛은 더 긴 등장 강조를 사용한다', () => {
    expect(unitIntroDuration(HandRank.FiveKind)).toBe(560);
    expect(unitIntroDuration(HandRank.FlushFive)).toBe(560);
  });
});
