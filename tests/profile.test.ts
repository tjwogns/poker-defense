import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { dailySeed, defaultProfile, loadProfile, recordRun, saveProfile } from '../src/meta/profile';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const victory = {
  seed: 7,
  result: 'victory' as const,
  score: 84_000,
  round: 60,
  kills: 1700,
  bestHand: HandRank.FourKind,
  upgradeLevel: 13,
  relics: ['royal_seal', 'war_chest', 'compound_ledger', 'fortified_table', 'swift_shuffle'] as const,
};

describe('profile persistence', () => {
  test('손상된 저장 데이터는 예외 없이 기본 프로필로 복구한다', () => {
    const storage = new MemoryStorage();
    storage.setItem('poker-defense:v1:profile', '{broken');

    expect(loadProfile(storage)).toEqual(defaultProfile());
  });

  test('저장 후 다시 읽으면 기록과 설정을 보존한다', () => {
    const storage = new MemoryStorage();
    const profile = { ...defaultProfile(), bestScore: 12345, soundEnabled: false };

    expect(saveProfile(storage, profile)).toBe(true);
    expect(loadProfile(storage)).toMatchObject({ bestScore: 12345, soundEnabled: false });
  });

  test('승리 기록은 최고 기록과 업적 및 데일리 최고점을 갱신한다', () => {
    const updated = recordRun(defaultProfile(), victory, 'daily', '2026-08-26');

    expect(updated.totalRuns).toBe(1);
    expect(updated.wins).toBe(1);
    expect(updated.bestScore).toBe(84_000);
    expect(updated.bestRound).toBe(60);
    expect(updated.daily).toEqual({ date: '2026-08-26', bestScore: 84_000 });
    expect(updated.achievements).toEqual(expect.arrayContaining([
      'first_run', 'boss_breaker', 'royal_victory', 'relic_collector',
    ]));
  });

  test('같은 날짜는 같은 양의 데일리 시드를 만든다', () => {
    expect(dailySeed('2026-08-26')).toBe(dailySeed('2026-08-26'));
    expect(dailySeed('2026-08-26')).not.toBe(dailySeed('2026-08-27'));
    expect(dailySeed('2026-08-26')).toBeGreaterThan(0);
  });
});
