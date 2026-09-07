import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import worker, { validateAnalyticsSubmission } from '../leaderboard-worker/src/index.js';

function validBody() {
  return {
    schema: 'poker-defense-event-v1',
    gameVersion: 'v2.0',
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
  test('첫 실행 퍼널 SQL이 언어·레이아웃·소요 시간을 집계한다', () => {
    const sql = readFileSync(new URL('../leaderboard-worker/queries/analytics-summary.sql', import.meta.url), 'utf8');
    expect(sql).toContain("name = 'onboarding_step'");
    expect(sql).toContain("'$.locale'");
    expect(sql).toContain("'$.layout'");
    expect(sql).toContain("'$.durationSeconds'");
    expect(sql).toContain("WHEN 'first_combat_cleared'");
  });

  test('로열 웨이저 SQL이 선택률과 정산 성공률을 집계한다', () => {
    const sql = readFileSync(new URL('../leaderboard-worker/queries/analytics-summary.sql', import.meta.url), 'utf8');
    expect(sql).toContain("name = 'wager_selected'");
    expect(sql).toContain("events.name = 'wager_offered'");
    expect(sql).toContain("'$.offeredIds'");
    expect(sql).toContain('selected_run_percent');
    expect(sql).toContain("name = 'wager_resolved'");
    expect(sql).toContain("'$.success'");
    expect(sql).toContain('success_percent');
  });

  test('허용된 익명 이벤트를 받는다', () => {
    expect(validateAnalyticsSubmission(validBody())).toBe('');

    const boss = validBody();
    boss.event.name = 'boss_defeated';
    boss.event.properties = {
      bossRound: 10, resolvedRound: 11, roundsLate: 1,
      combatSecondsSinceSpawn: 51, units: 10, upgradeLevel: 4, relicCount: 0, crownLevel: 1,
    };
    expect(validateAnalyticsSubmission(boss)).toBe('');

    const deckEvent = validBody();
    deckEvent.event.name = 'deck_modified';
    expect(validateAnalyticsSubmission(deckEvent)).toBe('');

    deckEvent.event.name = 'maintenance_mastery_purchase';
    deckEvent.event.properties = { round: 10, handRank: 1, level: 1, cost: 30, goldAfter: 70 };
    expect(validateAnalyticsSubmission(deckEvent)).toBe('');

    deckEvent.event.name = 'run_feedback';
    deckEvent.event.properties = {
      question: 'difficulty', answer: 'balanced', mode: 'standard', ruleset: 'life-economy',
      result: 'defeat', round: 31,
    };
    expect(validateAnalyticsSubmission(deckEvent)).toBe('');

    const onboarding = validBody();
    onboarding.event.name = 'onboarding_step';
    onboarding.event.properties = {
      step: 'hand_confirmed', locale: 'en', layout: 'portrait', durationSeconds: 42,
      ruleset: 'life-economy', round: 1,
    };
    expect(validateAnalyticsSubmission(onboarding)).toBe('');

    const wagerOffered = validBody();
    wagerOffered.event.name = 'wager_offered';
    wagerOffered.event.properties = {
      offeredIds: ['pristine_three', 'pair_three', 'straight_one'],
      round: 1, locale: 'en', layout: 'landscape',
    };
    expect(validateAnalyticsSubmission(wagerOffered)).toBe('');

    const wagerSelected = validBody();
    wagerSelected.event.name = 'wager_selected';
    wagerSelected.event.properties = {
      wagerId: 'pristine_three', offeredIds: ['pristine_three', 'pair_three', 'straight_one'],
      round: 1, locale: 'en', layout: 'landscape',
    };
    expect(validateAnalyticsSubmission(wagerSelected)).toBe('');

    const wagerResolved = validBody();
    wagerResolved.event.name = 'wager_resolved';
    wagerResolved.event.properties = {
      wagerId: 'pristine_three', success: true, progress: 3, target: 3,
      rewardType: 'gold', rewardAmount: 35, round: 10,
    };
    expect(validateAnalyticsSubmission(wagerResolved)).toBe('');
  });

  test('허용된 웹 주소의 preflight에 자격 증명 CORS 헤더를 반환한다', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/analytics', {
        method: 'OPTIONS',
        headers: { Origin: 'https://tjwogns.github.io' },
      }),
      { ALLOWED_ORIGIN: 'https://tjwogns.github.io' },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://tjwogns.github.io');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
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
