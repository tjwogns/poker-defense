import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { analyzeDefeat, DefeatAnalysisInput } from '../src/meta/defeatAnalysis';

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
    expect(analysis.synergies).toContain('군단 1단계');
    expect(analysis.tips[0]).toContain('용족 2종');
    expect(analysis.bossHpPercent).toBe(25);
  });

  test('필드 상한 패배에서 위협도와 시너지 부재를 알려준다', () => {
    const input = baseInput();
    input.enemies = Array.from({ length: 81 }, (_, index) => ({
      kind: 'normal', round: 24, hp: 10 + index, maxHp: 100, alive: true,
    }));

    const analysis = analyzeDefeat(input);

    expect(analysis.cause).toBe('필드 위협도 81 / 80 도달');
    expect(analysis.boss).toBe('생존 보스 없음');
    expect(analysis.synergies).toBe('활성 시너지 없음');
    expect(analysis.tips[0]).toContain('첫 시너지');
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
    expect(analysis.synergies).toContain('정밀 1단계');
    expect(analysis.tips[0]).toContain('R20 보스');
  });
});
