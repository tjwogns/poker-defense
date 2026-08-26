export const ANALYTICS_KEY = 'poker-defense:v1:analytics';

export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';
export type AnalyticsValue = string | number | boolean | null | string[] | number[];
export type AnalyticsProperties = Record<string, AnalyticsValue>;

export type AnalyticsEventName =
  | 'menu_view'
  | 'consent_granted'
  | 'run_started'
  | 'tutorial_finished'
  | 'hand_confirmed'
  | 'combat_started'
  | 'round_reached'
  | 'placement_blocked'
  | 'unit_fused'
  | 'relic_selected'
  | 'run_finished'
  | 'run_abandoned'
  | 'retry_clicked'
  | 'result_shared';

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  at: string;
  sessionId: string;
  runId?: string;
  properties: AnalyticsProperties;
}

interface AnalyticsState {
  version: 1;
  consent: AnalyticsConsent;
  events: AnalyticsEvent[];
}

export interface AnalyticsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface AnalyticsOptions {
  endpoint?: string;
  idFactory?: () => string;
  now?: () => Date;
  send?: (endpoint: string, event: AnalyticsEvent) => void;
}

const MAX_EVENTS = 500;

export class Analytics {
  private readonly sessionId: string;
  private readonly endpoint: string;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly send: (endpoint: string, event: AnalyticsEvent) => void;
  private state: AnalyticsState;

  constructor(private readonly storage: AnalyticsStorage, options: AnalyticsOptions = {}) {
    this.idFactory = options.idFactory ?? randomId;
    this.now = options.now ?? (() => new Date());
    this.endpoint = options.endpoint?.trim() ?? '';
    this.send = options.send ?? sendEvent;
    this.sessionId = this.idFactory();
    this.state = loadState(storage);
  }

  get consent(): AnalyticsConsent {
    return this.state.consent;
  }

  get remoteEnabled(): boolean {
    return this.state.consent === 'granted' && this.endpoint.length > 0;
  }

  setConsent(consent: Exclude<AnalyticsConsent, 'unknown'>): void {
    const changed = this.state.consent !== consent;
    this.state.consent = consent;
    if (consent === 'denied') this.state.events = [];
    this.persist();
    if (changed && consent === 'granted') this.track('consent_granted');
  }

  beginRun(properties: AnalyticsProperties): string {
    const runId = this.idFactory();
    this.track('run_started', properties, runId);
    return runId;
  }

  track(name: AnalyticsEventName, properties: AnalyticsProperties = {}, runId?: string): AnalyticsEvent | null {
    if (this.state.consent !== 'granted') return null;
    const event: AnalyticsEvent = {
      id: this.idFactory(),
      name,
      at: this.now().toISOString(),
      sessionId: this.sessionId,
      ...(runId ? { runId } : {}),
      properties: sanitizeProperties(properties),
    };
    this.state.events = [...this.state.events, event].slice(-MAX_EVENTS);
    this.persist();
    if (this.endpoint) this.send(this.endpoint, event);
    return event;
  }

  exportEvents(): AnalyticsEvent[] {
    return this.state.consent === 'granted' ? this.state.events.map((event) => ({
      ...event,
      properties: { ...event.properties },
    })) : [];
  }

  clearEvents(): void {
    this.state.events = [];
    this.persist();
  }

  private persist(): void {
    try {
      this.storage.setItem(ANALYTICS_KEY, JSON.stringify(this.state));
    } catch {
      // 저장소가 차단되어도 게임 진행에는 영향을 주지 않는다.
    }
  }
}

let singleton: Analytics | null = null;

export function getAnalytics(): Analytics {
  if (!singleton) {
    singleton = new Analytics(localStorage, {
      endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
    });
  }
  return singleton;
}

function loadState(storage: AnalyticsStorage): AnalyticsState {
  try {
    const raw = storage.getItem(ANALYTICS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AnalyticsState>;
    return {
      version: 1,
      consent: parsed.consent === 'granted' || parsed.consent === 'denied' ? parsed.consent : 'unknown',
      events: Array.isArray(parsed.events) ? parsed.events.filter(isAnalyticsEvent).slice(-MAX_EVENTS) : [],
    };
  } catch {
    return defaultState();
  }
}

function defaultState(): AnalyticsState {
  return { version: 1, consent: 'unknown', events: [] };
}

function sanitizeProperties(properties: AnalyticsProperties): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => {
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
      if (typeof value === 'number') return Number.isFinite(value);
      return Array.isArray(value) && value.every((item) => typeof item === 'string' || Number.isFinite(item));
    }),
  );
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AnalyticsEvent>;
  return typeof event.id === 'string'
    && typeof event.name === 'string'
    && typeof event.at === 'string'
    && typeof event.sessionId === 'string'
    && (!event.runId || typeof event.runId === 'string')
    && !!event.properties
    && typeof event.properties === 'object';
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sendEvent(endpoint: string, event: AnalyticsEvent): void {
  const body = JSON.stringify({ schema: 'poker-defense-event-v1', event });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // 분석 전송 실패는 플레이를 방해하지 않는다. 로컬 기록은 유지된다.
  }
}
