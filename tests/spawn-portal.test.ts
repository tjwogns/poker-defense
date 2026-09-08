import { expect, test } from 'vitest';
import { SpawnPortalPulse } from '../src/game/spawnPortal';
import { TILE } from '../src/core/map';
import { readFileSync } from 'node:fs';

test('initial crowded snapshots do not flash, a later entrance spawn flashes once', () => {
  const pulse = new SpawnPortalPulse();
  const first = { id: 1, alive: true, dist: 0 };
  expect(pulse.update([first], 0, false)).toBe(0);
  const second = { id: 2, alive: true, dist: 2 };
  expect(pulse.update([first, second], 1, false)).toBe(1);
  expect(pulse.update([first, second], 1.15, false)).toBeCloseTo(0.5);
  // Paused updates neither restart nor advance the flash.
  expect(pulse.update([first, second], 1.15, false)).toBeCloseTo(0.5);
  expect(pulse.update([first, second], 1.31, false)).toBe(0);
});

test('mid-route split/summon IDs and dead enemies do not pulse the entrance', () => {
  const pulse = new SpawnPortalPulse();
  pulse.update([], 0, false);
  expect(pulse.update([{ id: 1, alive: true, dist: TILE * 5 }], 1, false)).toBe(0);
  expect(pulse.update([{ id: 2, alive: false, dist: 0 }], 2, false)).toBe(0);
});

test('reduced motion suppresses flashes and consumes their IDs without replay', () => {
  const pulse = new SpawnPortalPulse();
  pulse.update([], 0, true);
  const enemy = { id: 1, alive: true, dist: 2 };
  expect(pulse.update([enemy], 1, true)).toBe(0);
  expect(pulse.update([enemy], 1.1, false)).toBe(0);
});

test('portal remains smaller than one tile and below enemies, keeping near-exit warning', () => {
  const source = readFileSync(new URL('../src/game/FieldRenderer.ts', import.meta.url), 'utf8');
  expect(source).toContain('this.scene.add.graphics().setDepth(0.2)');
  expect(source).toContain('tile * 0.74, tile * 0.84');
  expect(source).toContain('this.updateEscapeWarning(game)');
  expect(source).not.toContain('S  입구');
  expect(source).not.toContain('E  출구');
  expect(source).not.toContain('portrait ? 80 : 106');
});
