import { afterEach, expect, test, vi } from 'vitest';
import { currentLayoutMode, isPortraitLayout, setActiveLayoutMode } from '../src/game/device';
import { MenuViewportRefresh, viewportCanvasLayout } from '../src/game/viewportLayout';
import { readFileSync } from 'node:fs';

afterEach(() => { setActiveLayoutMode(null); vi.unstubAllGlobals(); vi.useRealTimers(); });

test('active run UI stays pinned while raw viewport changes, then menu can commit the next layout', () => {
  vi.stubGlobal('window', { innerWidth: 1280, innerHeight: 720 });
  setActiveLayoutMode('desktop');
  expect(isPortraitLayout()).toBe(false);
  window.innerWidth = 360;
  window.innerHeight = 740;
  expect(currentLayoutMode()).toBe('portrait');
  expect(isPortraitLayout()).toBe(false);
  const menu = viewportCanvasLayout(360, 740);
  expect(menu).toEqual({ mode: 'portrait', width: 390, height: 802 });
  setActiveLayoutMode(menu.mode);
  expect(isPortraitLayout()).toBe(true);
  window.innerWidth = 1280;
  window.innerHeight = 720;
  expect(currentLayoutMode()).toBe('desktop');
  expect(isPortraitLayout()).toBe(true);
});

test('menu geometry handles portrait height changes and keyboard height without changing orientation policy', () => {
  expect(viewportCanvasLayout(390, 844)).toMatchObject({ width: 390, height: 844 });
  expect(viewportCanvasLayout(430, 932)).toMatchObject({ width: 390, height: 845 });
  expect(viewportCanvasLayout(390, 844, 500)).toMatchObject({ mode: 'portrait', width: 390, height: 720 });
  expect(viewportCanvasLayout(844, 390)).toMatchObject({ width: 1280, height: 720 });
});

test('resize events debounce, defer across modal input/request work, and flush once after close', () => {
  vi.useFakeTimers();
  let modal = false;
  const rebuild = vi.fn();
  const refresh = new MenuViewportRefresh(() => modal, rebuild);
  refresh.request();
  vi.advanceTimersByTime(100);
  refresh.request();
  vi.advanceTimersByTime(100);
  expect(rebuild).not.toHaveBeenCalled();
  vi.advanceTimersByTime(50);
  expect(rebuild).toHaveBeenCalledTimes(1);
  modal = true;
  refresh.request();
  vi.advanceTimersByTime(200);
  expect(rebuild).toHaveBeenCalledTimes(1);
  refresh.flush();
  expect(rebuild).toHaveBeenCalledTimes(1);
  modal = false;
  refresh.flush();
  refresh.flush();
  expect(rebuild).toHaveBeenCalledTimes(2);
});

test('shutdown cancels pending rebuild so entering a run never restarts it', () => {
  vi.useFakeTimers();
  const rebuild = vi.fn();
  const refresh = new MenuViewportRefresh(() => false, rebuild);
  refresh.request();
  refresh.dispose();
  refresh.flush();
  refresh.request();
  vi.runAllTimers();
  expect(rebuild).not.toHaveBeenCalled();
});

test('menu rebuild preserves crown, suppresses duplicate view events and cleans up resize/keyboard listeners', () => {
  const menu = readFileSync(new URL('../src/game/MenuScene.ts', import.meta.url), 'utf8');
  expect(menu).toContain('this.scene.restart({ viewportRebuild: true, crown: this.selectedMenuCrown })');
  expect(menu.match(/this.selectedMenuCrown = selectedCrown/g)).toHaveLength(2);
  expect(menu.match(/if \(!this.viewportRebuild\) analytics.track\('menu_view'/g)).toHaveLength(2);
  for (const event of ['resize', 'orientationchange']) expect(menu).toContain(`window.removeEventListener('${event}', onViewportChange)`);
  expect(menu).toContain("window.visualViewport?.removeEventListener('resize', onViewportChange)");
  expect(menu).toContain("off('keydown-ESC', closeLeaderboard)");
  expect(menu).toContain("off('keydown-ESC', closePatchNotes)");
  for (const modal of ['leaderboard', 'patch', 'consent']) expect(menu).toContain(`this.viewportModals.add('${modal}')`);
  const play = readFileSync(new URL('../src/game/PlayScene.ts', import.meta.url), 'utf8');
  expect(play).not.toContain('MenuViewportRefresh');
  expect(play).not.toContain('setGameSize');
});
