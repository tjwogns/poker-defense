import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import {
  PROFILE_KEY, dailyDate, dailySeed, defaultProfile, ensureLeaderboardIdentity, exportPlaytestData, loadProfile, recordRun, saveProfile,
} from '../src/meta/profile';

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
    storage.setItem(PROFILE_KEY, '{broken');

    expect(loadProfile(storage)).toEqual(defaultProfile());
  });

  test('이전 형식의 베타 프로필은 기록을 보존하며 최신 형식으로 마이그레이션한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROFILE_KEY, JSON.stringify({
      version: 1, totalRuns: 4, wins: 1, bestScore: 5000, bestRound: 33,
      tutorialDone: true, soundEnabled: false, achievements: ['first_run'], daily: null,
    }));

    expect(loadProfile(storage)).toMatchObject({
      version: 3, totalRuns: 4, wins: 1, bestScore: 5000, recentRuns: [],
    });
  });

  test('v1 정식판 프로필은 v2 베타 기록에 섞이지 않는다', () => {
    const storage = new MemoryStorage();
    storage.setItem('poker-defense:v1:profile', JSON.stringify({
      version: 3, totalRuns: 9, wins: 2, bestScore: 99_999,
    }));

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

  test('일일 도전 날짜는 한국 표준시 자정을 기준으로 한다', () => {
    expect(dailyDate(new Date('2026-08-26T14:59:59Z'))).toBe('2026-08-26');
    expect(dailyDate(new Date('2026-08-26T15:00:00Z'))).toBe('2026-08-27');
  });

  test('익명 랭킹 지휘관 이름은 한 번 생성한 뒤 유지한다', () => {
    const created = ensureLeaderboardIdentity(defaultProfile(), () => 'fixed-player-id');
    const loadedAgain = ensureLeaderboardIdentity(created, () => 'different-id');
    expect(created.leaderboardPlayerId).toBe('fixed-player-id');
    expect(created.leaderboardName).toMatch(/\s\d{2}$/);
    expect(loadedAgain).toEqual(created);
  });

  test('최근 플레이 로그는 최신 20판만 저장한다', () => {
    let profile = defaultProfile();
    for (let seed = 1; seed <= 21; seed++) {
      profile = recordRun(profile, { ...victory, seed, score: seed * 100 }, 'standard', '2026-08-26');
    }
    expect(profile.recentRuns).toHaveLength(20);
    expect(profile.recentRuns[0].seed).toBe(2);
    expect(profile.recentRuns[19].seed).toBe(21);
  });

  test('플레이테스트 내보내기는 민감 정보 없이 최근 런을 JSON으로 만든다', () => {
    const profile = recordRun(defaultProfile(), victory, 'daily', '2026-08-26');
    const exported = JSON.parse(exportPlaytestData(profile)) as { schema: string; runs: unknown[] };
    expect(exported.schema).toBe('poker-defense-playtest-v2');
    expect(exported.runs).toHaveLength(1);
  });
});
