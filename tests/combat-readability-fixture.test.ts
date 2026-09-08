import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { isPlaceable, pathLength } from '../src/core/map';
import { Game } from '../src/core/game';
import { TICK_RATE } from '../src/core/balance';

const source = readFileSync(new URL('../src/game/PlayScene.ts', import.meta.url), 'utf8');

test('fixture initial tick creates exactly one real R40 boss without queued duplicate bosses', () => {
  const game = new Game(1, 'life-economy');
  game.round = 40;
  game.handConfirmed = true;
  expect(game.startCombat()).toBe(true);
  game.tickCombat(1 / TICK_RATE);
  expect(game.field.enemies.filter((enemy) => enemy.kind === 'boss')).toHaveLength(1);
  expect(game.nextEnemyPreview(100)).not.toContain('boss');
});

test('readability fixture uses 26 unique integer placements valid on the actual cross-road map', () => {
  const positions = source.match(/const readabilityPositions = \[([\s\S]*?)\n      \];/)![1];
  const tiles = [...positions.matchAll(/\[(\d+), (\d+)\]/g)].map((match) => [Number(match[1]), Number(match[2])]);
  expect(tiles).toHaveLength(26);
  expect(new Set(tiles.map(([x, y]) => `${x},${y}`)).size).toBe(26);
  for (const [x, y] of tiles) expect(isPlaceable(x, y, 'cross-road')).toBe(true);
});

test('readability fixture stays localhost-only, starts paused and spreads enemies inside the route', () => {
  expect(source).toContain("['127.0.0.1', 'localhost'].includes(window.location.hostname)");
  const fixture = source.split("localVisualTest === 'combat-readability'")[1].split("localVisualTest === 'enemy-roster'")[0];
  for (const setting of ['this.profile.tutorialDone = true', 'this.wagerChoiceMade = true',
    'this.core.round = 40', 'this.core.gold = 100', 'this.paused = true',
    'isPlaceable(x, y, this.core.mapId)', 'pathLength(this.core.mapId)']) expect(fixture).toContain(setting);
  const length = pathLength('cross-road');
  for (let index = 0; index < 25; index++) {
    const distance = length * (index + 1) / 28;
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(length);
  }
});
