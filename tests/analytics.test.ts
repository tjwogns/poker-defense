import { describe, expect, test, vi } from 'vitest';
import { ANALYTICS_KEY, LEGACY_ANALYTICS_KEY, Analytics } from '../src/meta/analytics';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('anonymous play analytics', () => {
  test('동의 전에는 이벤트를 기록하지 않는다', () => {
    const analytics = new Analytics(new MemoryStorage(), { idFactory: () => 'id' });

    expect(analytics.track('menu_view')).toBeNull();
    expect(analytics.exportEvents()).toEqual([]);
  });

  test('허용하면 민감 정보 없이 런 이벤트를 저장한다', () => {
    const storage = new MemoryStorage();
    let id = 0;
    const analytics = new Analytics(storage, {
      idFactory: () => `id-${++id}`,
      now: () => new Date('2026-08-26T00:00:00.000Z'),
    });
    analytics.setConsent('granted');
    const runId = analytics.beginRun({ mode: 'standard', retry: false });
    analytics.track('round_reached', { round: 10 }, runId);
    analytics.track('boss_encountered', { bossRound: 10, maxHp: 2699 }, runId);
    analytics.track('boss_survived', { bossRound: 10, hpPercent: 32, outcome: 'round_timeout' }, runId);

    const events = analytics.exportEvents();
    expect(events.map((event) => event.name)).toEqual([
      'consent_granted', 'run_started', 'round_reached', 'boss_encountered', 'boss_survived',
    ]);
    expect(events[2]).toMatchObject({ runId, properties: { round: 10 } });
    expect(events.every((event) => event.visitorId === events[0].visitorId)).toBe(true);
    expect(storage.values.get(ANALYTICS_KEY)).not.toContain('email');
  });

  test('같은 브라우저 저장소에서는 새 페이지 세션에도 익명 방문 ID를 유지한다', () => {
    const storage = new MemoryStorage();
    let id = 0;
    const options = { idFactory: () => `persistent-id-${++id}` };
    const first = new Analytics(storage, options);
    first.setConsent('granted');
    const firstEvent = first.track('menu_view')!;

    const reopened = new Analytics(storage, options);
    const reopenedEvent = reopened.track('menu_view')!;

    expect(reopenedEvent.visitorId).toBe(firstEvent.visitorId);
    expect(reopenedEvent.sessionId).not.toBe(firstEvent.sessionId);
  });

  test('정식 승격 전 익명 분석 동의와 방문 ID를 이어받는다', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_ANALYTICS_KEY, JSON.stringify({
      version: 1,
      consent: 'granted',
      visitorId: 'legacy-visitor',
      events: [],
    }));

    const analytics = new Analytics(storage, { idFactory: () => 'new-session' });
    expect(analytics.consent).toBe('granted');
    expect(analytics.track('menu_view')?.visitorId).toBe('legacy-visitor');
    expect(storage.values.has(ANALYTICS_KEY)).toBe(true);
  });

  test('거부하면 기존 이벤트를 삭제하고 이후 기록도 중단한다', () => {
    const analytics = new Analytics(new MemoryStorage(), { idFactory: () => 'id' });
    analytics.setConsent('granted');
    analytics.track('menu_view');
    analytics.setConsent('denied');

    expect(analytics.exportEvents()).toEqual([]);
    expect(analytics.track('menu_view')).toBeNull();
  });

  test('엔드포인트가 있으면 허용된 이벤트만 전송한다', () => {
    const send = vi.fn();
    const analytics = new Analytics(new MemoryStorage(), {
      endpoint: 'https://analytics.example/events', idFactory: () => 'id', send,
    });
    analytics.track('menu_view');
    expect(send).not.toHaveBeenCalled();

    analytics.setConsent('granted');
    analytics.track('menu_view');
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('서버 응답이 확인되면 전송 횟수와 마지막 확인 시각을 보존한다', async () => {
    const analytics = new Analytics(new MemoryStorage(), {
      endpoint: 'https://analytics.example/events',
      idFactory: () => 'delivery-id',
      now: () => new Date('2026-08-30T12:00:00.000Z'),
      send: async () => 'confirmed',
    });
    analytics.setConsent('granted');

    await vi.waitFor(() => expect(analytics.delivery.status).toBe('confirmed'));
    expect(analytics.delivery).toMatchObject({
      attempts: 1,
      lastAttemptAt: '2026-08-30T12:00:00.000Z',
      lastConfirmedAt: '2026-08-30T12:00:00.000Z',
      lastFailureAt: null,
    });
  });

  test('전송 실패는 게임 이벤트와 별도로 관측 상태에 기록한다', async () => {
    const analytics = new Analytics(new MemoryStorage(), {
      endpoint: 'https://analytics.example/events',
      idFactory: () => 'delivery-id',
      send: async () => { throw new Error('network'); },
    });
    analytics.setConsent('granted');

    await vi.waitFor(() => expect(analytics.delivery.status).toBe('failed'));
    expect(analytics.delivery.attempts).toBe(1);
    expect(analytics.exportEvents().map((event) => event.name)).toEqual(['consent_granted']);
  });
});
