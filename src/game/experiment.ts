/** v2.2 정식 LIFE 규칙 진입 여부. ruleset=classic 또는 /classic/만 이전 규칙을 유지한다. */
export function isLifeLabLocation(location: Pick<Location, 'hostname' | 'pathname' | 'search'> = window.location): boolean {
  const pathname = location.pathname.replace(/\/+$/, '');
  const params = new URLSearchParams(location.search);
  return !pathname.endsWith('/classic') && params.get('ruleset') !== 'classic';
}
import { BattlefieldMapId, isBattlefieldMapId } from '../core/map';
import { Analytics } from '../meta/analytics';
import { loadProfile, saveProfile, StorageLike } from '../meta/profile';

export interface BattlefieldExperiment { mapId: BattlefieldMapId; seed: number }
export const BATTLEFIELD_DEFAULT_SEED = 20260909;
// Twin gardens is shelved; retain its geometry for historical tests only.
export const ACTIVE_BATTLEFIELD_MAP_IDS = ['cross-road', 'parallel-corridors', 'inward-spiral'] as const;
export function battlefieldRunLabel(mapId: BattlefieldMapId, english: boolean): string {
  const labels: Record<BattlefieldMapId, readonly [string, string]> = {
    'cross-road': ['교차로', 'CROSSROAD'],
    'parallel-corridors': ['평행 회랑', 'CORRIDORS'],
    'twin-gardens': ['쌍정원', 'TWIN GARDENS'],
    'inward-spiral': ['안쪽 나선', 'SPIRAL'],
  };
  return `${english ? 'LAB' : '실험'} · ${labels[mapId][english ? 1 : 0]}`;
}

/** Explicit opt-in only. Conflicting daily/classic links never become experimental runs. */
export function battlefieldExperiment(search: string, pathname = ''): BattlefieldExperiment | null {
  const params = new URLSearchParams(search);
  if (params.get('experiment') !== 'battlefields' || params.has('daily')
    || params.get('ruleset') === 'classic' || pathname.replace(/\/+$/, '').endsWith('/classic')) return null;
  const rawSeed = params.get('seed');
  const seed = rawSeed !== null && /^\d{1,10}$/.test(rawSeed) && Number(rawSeed) <= 0xffffffff
    ? Number(rawSeed) : BATTLEFIELD_DEFAULT_SEED;
  const mapId = params.get('map');
  return { mapId: isBattlefieldMapId(mapId) && ACTIVE_BATTLEFIELD_MAP_IDS.some(id => id === mapId) ? mapId : 'cross-road', seed };
}

/** Copy the profile, never delegate writes to the supplied real storage. */
export function createBattlefieldSandbox(realStorage: StorageLike): { storage: StorageLike; analytics: Analytics } {
  const values = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
  saveProfile(storage, loadProfile(realStorage));
  const analytics = new Analytics(storage);
  analytics.setConsent('denied');
  return { storage, analytics };
}
