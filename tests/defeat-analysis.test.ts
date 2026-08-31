import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { analyzeDefeat, DefeatAnalysisInput } from '../src/meta/defeatAnalysis';
import { createHandMasteryLevels } from '../src/core/mastery';

function baseInput(): DefeatAnalysisInput {
  return {
    reason: 'field-cap',
    round: 24,
    fieldCap: 80,
    enemies: [],
    unitTiers: [],
    upgradeLevel: 3,
    bestHand: HandRank.HighCard,
    relicCount: 1,
    handMastery: createHandMasteryLevels(),
    handDamage: Object.fromEntries(
      Array.from({ length: HandRank.FlushFive + 1 }, (_, rank) => [rank, 0]),
    ) as Record<HandRank, number>,
  };
}

describe('defeat analysis', () => {
  test('최종 보스의 남은 HP와 빌드 대응을 분석한다', () => {
    const input = baseInput();
    input.reason = 'final-boss-timeout';
    input.round = 60;
    input.enemies = [
      { kind: 'boss', round: 60, hp: 250, maxHp: 1000, alive: true },
      { kind: 'normal', round: 60, hp: 10, maxHp: 20, alive: true },
    ];
    input.unitTiers = [HandRank.HighCard, HandRank.Pair];

    const analysis = analyzeDefeat(input);

    expect(analysis.cause).toContain('50초');
    expect(analysis.boss).toBe('생존 보스 R60 · HP 25%');
    expect(analysis.tips[0]).toContain('스페이드 대표 문양');
    expect(analysis.bossHpPercent).toBe(25);
  });

  test('필드 상한 패배에서 위협도와 정리 속도 조언을 알려준다', () => {
    const input = baseInput();
    input.enemies = Array.from({ length: 81 }, (_, index) => ({
      kind: 'normal', round: 24, hp: 10 + index, maxHp: 100, alive: true,
    }));

    const analysis = analyzeDefeat(input);

    expect(analysis.cause).toBe('필드 위협도 81 / 80 도달');
    expect(analysis.boss).toBe('생존 보스 없음');
    expect(analysis.tips[0]).toContain('주력 족보 연마');
    expect(analysis.aliveEnemies).toBe(81);
  });

  test('이월 보스가 남은 필드 패배에는 보스 대응 조언을 제공한다', () => {
    const input = baseInput();
    input.bestHand = HandRank.Flush;
    input.unitTiers = [HandRank.TwoPair, HandRank.Straight];
    input.enemies = [
      { kind: 'boss', round: 20, hp: 337, maxHp: 1000, alive: true },
      ...Array.from({ length: 80 }, () => ({ kind: 'normal', round: 24, hp: 10, maxHp: 10, alive: true })),
    ];

    const analysis = analyzeDefeat(input);

    expect(analysis.boss).toBe('생존 보스 R20 · HP 34%');
    expect(analysis.tips[0]).toContain('R20 보스');
  });

  test('족보별 누적 피해와 연마 레벨로 주력 빌드를 분석한다', () => {
    const input = baseInput();
    input.handMastery[HandRank.Pair] = 2;
    input.handDamage[HandRank.Pair] = 700;
    input.handDamage[HandRank.Trips] = 300;

    const analysis = analyzeDefeat(input);

    expect(analysis.mastery).toBe('주력 원페어 70% · Lv2');
    expect(analysis.mainDamageRank).toBe(HandRank.Pair);
    expect(analysis.mainDamagePercent).toBe(70);
  });

  test('미연마 주력 족보에는 다음 판 연마 추천을 제공한다', () => {
    const input = baseInput();
    input.bestHand = HandRank.Flush;
    input.handDamage[HandRank.Flush] = 1000;

    const analysis = analyzeDefeat(input);

    expect(analysis.tips[0]).toContain('피해 1위 플러시');
    expect(analysis.tips[0]).toContain('연마');
  });
});
