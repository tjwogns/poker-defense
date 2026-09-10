import { afterEach, expect, test, vi } from 'vitest';
const buttons = vi.hoisted(() => [] as Array<{ label: string; click: () => void }>);
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../src/game/ui', async (load) => {
  const original = await load<typeof import('../src/game/ui')>();
  return { ...original, makeButton: (_s: unknown, _x: number, _y: number, _w: number, _h: number, label: string, click: () => void) => {
    const button = { label, click }; buttons.push(button);
    return { container: { setDepth() {} }, setLabel(value: string) { button.label = value; }, setEnabled() {} };
  } };
});
vi.mock('../src/meta/leaderboard', () => ({ leaderboardConfigured: () => true, submitDailyScore: vi.fn() }));
vi.mock('../src/game/ShareCard', () => ({ shareRun: vi.fn(), downloadShareCard: vi.fn() }));
import { PlayScene } from '../src/game/PlayScene';
import { Game } from '../src/core/game';
import { loadProfile, saveProfile, defaultProfile } from '../src/meta/profile';
import { submitDailyScore } from '../src/meta/leaderboard';
import { shareRun, downloadShareCard } from '../src/game/ShareCard';

afterEach(() => { vi.unstubAllGlobals(); buttons.length = 0; });

test('real PlayScene init/end uses sandbox, suppresses publication, and retries/returns with the same experiment', () => {
  const entries = new Map<string, string>();
  const real = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } };
  saveProfile(real, defaultProfile());
  const before = [...entries];
  vi.stubGlobal('localStorage', real);
  vi.stubGlobal('window', { location: { search: '?experiment=battlefields', pathname: '/', hostname: 'localhost' }, innerWidth: 1280, innerHeight: 720 });
  const scene = new PlayScene();
  const experiment = { mapId: 'inward-spiral' as const, seed: 12345 };
  scene.init({ experiment, mode: 'daily', seed: 999 });
  // Phaser rendering is stubbed; the production init/end/action methods execute unchanged.
  const state = scene as any;
  expect(state.mode).toBe('standard'); expect(state.seedValue).toBe(12345);
  expect(state.analytics.consent).toBe('denied');
  state.core = new Game(12345, 'life-economy', 0, experiment.mapId);
  state.core.phase = 'victory';
  state.profile = loadProfile(state.profileStorage);
  state.audio = { play() {} }; state.firstRunCoach = { refresh() {} };
  state.scale = { height: 720 };
  const chain = new Proxy({}, { get: () => () => chain });
  state.add = { rectangle: () => chain, text: () => chain };
  state.scene = { restart: vi.fn(), start: vi.fn() };
  state.renderEndFeedback = () => {};
  state.showEnd();
  expect([...entries]).toEqual(before);
  expect(loadProfile(state.profileStorage).totalRuns).toBe(1);
  expect(buttons).toHaveLength(2);
  expect(buttons.map((b) => b.label).join(' ')).not.toMatch(/PNG|SHARE|랭킹|공유/);
  buttons[0].click();
  expect(state.scene.restart).toHaveBeenCalledWith(expect.objectContaining({ seed: 12345, experiment, mode: 'standard' }));
  buttons[1].click();
  expect(state.scene.start).toHaveBeenCalledWith('battlefields', experiment);
  expect(submitDailyScore).not.toHaveBeenCalled(); expect(shareRun).not.toHaveBeenCalled(); expect(downloadShareCard).not.toHaveBeenCalled();
});
