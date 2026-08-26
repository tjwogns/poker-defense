import { describe, expect, test, vi } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { fetchDailyLeaderboard, submitDailyScore } from '../src/meta/leaderboard';

const endpoint = 'https://ranking.example/leaderboard';

describe('online daily leaderboard client', () => {
  test('날짜와 플레이어 ID로 TOP 10을 조회한다', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      entries: [{
        rank: 1, name: '푸른 에이스 07', score: 1234, round: 8,
        result: 'defeat', submittedAt: '2026-08-27T00:00:00.000Z', isCurrentPlayer: true,
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const entries = await fetchDailyLeaderboard('2026-08-27', 'player-1', fetcher, endpoint);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ rank: 1, score: 1234, isCurrentPlayer: true });
    const calledUrl = new URL(String(vi.mocked(fetcher).mock.calls[0][0]));
    expect(calledUrl.searchParams.get('date')).toBe('2026-08-27');
    expect(calledUrl.searchParams.get('playerId')).toBe('player-1');
  });

  test('데일리 종료 요약을 등록하고 순위를 반환한다', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      rank: 3, bestScore: 8400, accepted: true,
    }), { status: 200 })) as unknown as typeof fetch;
    const result = await submitDailyScore({
      date: '2026-08-27',
      playerId: 'player-1',
      name: '은빛 방패 31',
      summary: {
        seed: 7, result: 'defeat', score: 8400, round: 12, kills: 230,
        bestHand: HandRank.Trips, upgradeLevel: 2, relics: [],
      },
    }, fetcher, endpoint);

    expect(result).toEqual({ rank: 3, bestScore: 8400, accepted: true });
    const init = vi.mocked(fetcher).mock.calls[0][1];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      schema: 'royal-siege-leaderboard-v1', date: '2026-08-27', score: 8400,
    });
  });

  test('서버 오류를 성공으로 오인하지 않는다', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(fetchDailyLeaderboard('2026-08-27', 'player-1', fetcher, endpoint))
      .rejects.toThrow('leaderboard_fetch_503');
  });
});
