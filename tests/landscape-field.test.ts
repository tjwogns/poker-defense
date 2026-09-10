import { afterEach, expect, test, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
import { FieldRenderer, currentFieldMetrics, fieldScreenPoint, tileAtScreen } from '../src/game/FieldRenderer';
import { setActiveLayoutMode } from '../src/game/device';
import { LANDSCAPE_FIELD, PANEL_BOUNDS, setActivePortraitHeight } from '../src/game/layout';
import { GRID_H, GRID_W, TILE, tileCenter } from '../src/core/map';
import { Game } from '../src/core/game';
import { addUnit } from '../src/core/combat';
import { HandRank } from '../src/core/cards/types';
import { UNIT_DEFS } from '../src/core/units';

afterEach(() => { setActiveLayoutMode(null); setActivePortraitHeight(844); });

test('desktop board grows proportionally, all tile centers round-trip and the rail stays outside', () => {
  setActiveLayoutMode('desktop');
  const metrics = currentFieldMetrics();
  expect(metrics).toEqual({ ...LANDSCAPE_FIELD, scale: 50 / TILE, portrait: false });
  expect(metrics.x + GRID_W * metrics.tile).toBeLessThan(PANEL_BOUNDS.x);
  expect(metrics.y + GRID_H * metrics.tile).toBeLessThan(720);
  for (let tx = 0; tx < GRID_W; tx++) for (let ty = 0; ty < GRID_H; ty++) {
    const p = tileCenter(tx, ty); const screen = fieldScreenPoint(p.x, p.y);
    expect(tileAtScreen(screen.x, screen.y)).toEqual({ tx, ty });
  }
  expect(tileAtScreen(900, 250)).toBeNull();
  expect(tileAtScreen(16 + 17 * 50, 84)).toBeNull();
});

test('actual selected/placement range renderer uses the same transformed center and radius', () => {
  setActiveLayoutMode('desktop');
  const game = new Game(1, 'life-economy');
  const unit = addUnit(game.field, HandRank.Pair, 3, 2);
  const p = tileCenter(3, 2); const screen = fieldScreenPoint(p.x, p.y);
  const graphics = { clear: vi.fn(), fillStyle: vi.fn(), fillCircle: vi.fn(), lineStyle: vi.fn(), strokeCircle: vi.fn() };
  const renderer: any = Object.create(FieldRenderer.prototype);
  renderer.metrics = currentFieldMetrics(); renderer.rangeG = graphics;
  renderer.scene = { input: { activePointer: screen } };
  renderer.updateRange(game, unit.id, null);
  expect(graphics.strokeCircle).toHaveBeenLastCalledWith(screen.x, screen.y, UNIT_DEFS[HandRank.Pair].range * 50);
  game.field.units = [];
  renderer.updateRange(game, null, HandRank.Pair);
  expect(graphics.strokeCircle).toHaveBeenLastCalledWith(screen.x, screen.y, UNIT_DEFS[HandRank.Pair].range * 50);
});

test('portrait metrics remain unchanged and do not adopt desktop enlargement', () => {
  setActiveLayoutMode('portrait'); setActivePortraitHeight(844);
  expect(currentFieldMetrics()).toEqual({ x: 8, y: 106, tile: 22, scale: 22 / TILE, portrait: true });
});
