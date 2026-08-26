import { describe, expect, test, vi } from 'vitest';
import { ANALYTICS_KEY, Analytics } from '../src/meta/analytics';

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

    const events = analytics.exportEvents();
    expect(events.map((event) => event.name)).toEqual([
      'consent_granted', 'run_started', 'round_reached',
    ]);
    expect(events[2]).toMatchObject({ runId, properties: { round: 10 } });
    expect(storage.values.get(ANALYTICS_KEY)).not.toContain('email');
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
});
