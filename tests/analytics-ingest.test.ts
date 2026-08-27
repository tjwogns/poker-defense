import { describe, expect, test } from 'vitest';
import { validateAnalyticsSubmission } from '../leaderboard-worker/src/index.js';

function validBody() {
  return {
    schema: 'poker-defense-event-v1',
    gameVersion: 'v1.4',
    event: {
      id: 'event-id-1234',
      name: 'upgrade_bought',
      at: '2026-08-27T02:00:00.000Z',
      visitorId: 'visitor-id-1234',
      sessionId: 'session-id-1234',
      runId: 'run-id-12345678',
      properties: { round: 12, level: 4, cost: 86, mode: 'standard' },
    },
  };
}

describe('analytics ingestion validation', () => {
  test('허용된 익명 이벤트를 받는다', () => {
    expect(validateAnalyticsSubmission(validBody())).toBe('');

    const boss = validBody();
    boss.event.name = 'boss_defeated';
    boss.event.properties = {
      bossRound: 10, resolvedRound: 11, roundsLate: 1,
      combatSecondsSinceSpawn: 51, units: 10, upgradeLevel: 4, relicCount: 0,
    };
    expect(validateAnalyticsSubmission(boss)).toBe('');
  });

  test('알 수 없는 이벤트와 중첩 속성을 거부한다', () => {
    const unknown = validBody();
    unknown.event.name = 'email_collected';
    expect(validateAnalyticsSubmission(unknown)).toBe('invalid_event_name');

    const nested = validBody();
    nested.event.properties = { round: 12, player: { email: 'x@example.com' } } as never;
    expect(validateAnalyticsSubmission(nested)).toBe('invalid_properties');
  });

  test('게임 버전과 무작위 식별자 형식을 검증한다', () => {
    const wrongVersion = validBody();
    wrongVersion.gameVersion = 'latest';
    expect(validateAnalyticsSubmission(wrongVersion)).toBe('invalid_version');

    const shortSession = validBody();
    shortSession.event.sessionId = 'short';
    expect(validateAnalyticsSubmission(shortSession)).toBe('invalid_session');

    const shortVisitor = validBody();
    shortVisitor.event.visitorId = 'short';
    expect(validateAnalyticsSubmission(shortVisitor)).toBe('invalid_visitor');
  });
});
