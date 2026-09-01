export const ANALYTICS_KEY = 'poker-defense:v2:analytics';
export const LEGACY_ANALYTICS_KEY = 'poker-defense:v2-beta:analytics';
import { CURRENT_VERSION } from './patchNotes';

export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';
export type AnalyticsDeliveryStatus = 'idle' | 'pending' | 'queued' | 'confirmed' | 'failed';
export type AnalyticsDeliveryResult = Exclude<AnalyticsDeliveryStatus, 'idle' | 'pending'>;
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
  | 'relic_sold'
  | 'run_finished'
  | 'run_abandoned'
  | 'retry_clicked'
  | 'result_shared'
  | 'leaderboard_viewed'
  | 'leaderboard_submitted'
  | 'patch_notes_viewed'
  | 'background_pause'
  | 'upgrade_bought'
  | 'odds_opened'
  | 'deck_opened'
  | 'deck_modified'
  | 'maintenance_opened'
  | 'maintenance_purchase'
  | 'maintenance_relic_purchase'
  | 'maintenance_mastery_purchase'
  | 'maintenance_closed'
  | 'boss_encountered'
  | 'boss_defeated'
  | 'boss_survived'
  | 'relic_triggered';

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  at: string;
  visitorId: string;
  sessionId: string;
  runId?: string;
  properties: AnalyticsProperties;
}

interface AnalyticsState {
  version: 1;
  consent: AnalyticsConsent;
  visitorId: string;
  events: AnalyticsEvent[];
  delivery: AnalyticsDeliveryState;
}

export interface AnalyticsDeliveryState {
  attempts: number;
  status: AnalyticsDeliveryStatus;
  lastAttemptAt: string | null;
  lastConfirmedAt: string | null;
  lastFailureAt: string | null;
}

export interface AnalyticsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface AnalyticsOptions {
  endpoint?: string;
  idFactory?: () => string;
  now?: () => Date;
  send?: (endpoint: string, event: AnalyticsEvent) => AnalyticsDeliveryResult | Promise<AnalyticsDeliveryResult> | void;
}

const MAX_EVENTS = 500;

export class Analytics {
  private readonly sessionId: string;
  private readonly endpoint: string;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly send: NonNullable<AnalyticsOptions['send']>;
  private state: AnalyticsState;

  constructor(private readonly storage: AnalyticsStorage, options: AnalyticsOptions = {}) {
    this.idFactory = options.idFactory ?? randomId;
    this.now = options.now ?? (() => new Date());
    this.endpoint = options.endpoint?.trim() ?? '';
    this.send = options.send ?? sendEvent;
    this.sessionId = this.idFactory();
    this.state = loadState(storage);
    if (!this.state.visitorId) {
      this.state.visitorId = this.idFactory();
      this.persist();
    }
  }

  get consent(): AnalyticsConsent {
    return this.state.consent;
  }

  get remoteEnabled(): boolean {
    return this.state.consent === 'granted' && this.endpoint.length > 0;
  }

  get delivery(): AnalyticsDeliveryState {
    return { ...this.state.delivery };
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
      visitorId: this.state.visitorId,
      sessionId: this.sessionId,
      ...(runId ? { runId } : {}),
      properties: sanitizeProperties(properties),
    };
    this.state.events = [...this.state.events, event].slice(-MAX_EVENTS);
    this.persist();
    if (this.endpoint) this.dispatch(event);
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

  private dispatch(event: AnalyticsEvent): void {
    this.state.delivery = {
      ...this.state.delivery,
      attempts: this.state.delivery.attempts + 1,
      status: 'pending',
      lastAttemptAt: this.now().toISOString(),
    };
    this.persist();
    try {
      void Promise.resolve(this.send(this.endpoint, event))
        .then((result) => this.finishDelivery(result ?? 'queued'))
        .catch(() => this.finishDelivery('failed'));
    } catch {
      this.finishDelivery('failed');
    }
  }

  private finishDelivery(status: AnalyticsDeliveryResult): void {
    const at = this.now().toISOString();
    this.state.delivery = {
      ...this.state.delivery,
      status,
      lastConfirmedAt: status === 'confirmed' ? at : this.state.delivery.lastConfirmedAt,
      lastFailureAt: status === 'failed' ? at : this.state.delivery.lastFailureAt,
    };
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
let localOnlySingleton: Analytics | null = null;

export function getAnalytics(localOnly = false): Analytics {
  if (localOnly) {
    if (!localOnlySingleton) {
      const memory = new Map<string, string>();
      localOnlySingleton = new Analytics({
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => { memory.set(key, value); },
      }, { endpoint: '' });
      localOnlySingleton.setConsent('denied');
    }
    return localOnlySingleton;
  }
  if (!singleton) {
    singleton = new Analytics(localStorage, {
      endpoint: import.meta.env.VITE_ANALYTICS_ENDPOINT,
    });
  }
  return singleton;
}

function loadState(storage: AnalyticsStorage): AnalyticsState {
  try {
    const raw = storage.getItem(ANALYTICS_KEY) ?? storage.getItem(LEGACY_ANALYTICS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<AnalyticsState>;
    return {
      version: 1,
      consent: parsed.consent === 'granted' || parsed.consent === 'denied' ? parsed.consent : 'unknown',
      visitorId: typeof parsed.visitorId === 'string' ? parsed.visitorId : '',
      events: Array.isArray(parsed.events) ? parsed.events.filter(isAnalyticsEvent).slice(-MAX_EVENTS) : [],
      delivery: sanitizeDelivery(parsed.delivery),
    };
  } catch {
    return defaultState();
  }
}

function defaultState(): AnalyticsState {
  return { version: 1, consent: 'unknown', visitorId: '', events: [], delivery: defaultDelivery() };
}

function defaultDelivery(): AnalyticsDeliveryState {
  return { attempts: 0, status: 'idle', lastAttemptAt: null, lastConfirmedAt: null, lastFailureAt: null };
}

function sanitizeDelivery(value: unknown): AnalyticsDeliveryState {
  if (!value || typeof value !== 'object') return defaultDelivery();
  const parsed = value as Partial<AnalyticsDeliveryState>;
  const statuses: AnalyticsDeliveryStatus[] = ['idle', 'pending', 'queued', 'confirmed', 'failed'];
  return {
    attempts: Number.isInteger(parsed.attempts) && (parsed.attempts ?? 0) >= 0 ? parsed.attempts! : 0,
    status: statuses.includes(parsed.status as AnalyticsDeliveryStatus)
      ? parsed.status as AnalyticsDeliveryStatus
      : 'idle',
    lastAttemptAt: typeof parsed.lastAttemptAt === 'string' ? parsed.lastAttemptAt : null,
    lastConfirmedAt: typeof parsed.lastConfirmedAt === 'string' ? parsed.lastConfirmedAt : null,
    lastFailureAt: typeof parsed.lastFailureAt === 'string' ? parsed.lastFailureAt : null,
  };
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
    && (!event.visitorId || typeof event.visitorId === 'string')
    && typeof event.sessionId === 'string'
    && (!event.runId || typeof event.runId === 'string')
    && !!event.properties
    && typeof event.properties === 'object';
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function sendEvent(endpoint: string, event: AnalyticsEvent): Promise<AnalyticsDeliveryResult> {
  const body = JSON.stringify({ schema: 'poker-defense-event-v1', gameVersion: CURRENT_VERSION, event });
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
    return response.ok ? 'confirmed' : 'failed';
  } catch {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        return navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
          ? 'queued'
          : 'failed';
      }
    } catch {
      // 아래 실패 상태로 합류한다.
    }
    return 'failed';
  }
}
