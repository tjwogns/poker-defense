import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { GRID_H, GRID_W, isPathTile } from '../src/core/map';
import { drawRoyalGardenField, FIELD_TEXTURES, preloadFieldTextures } from '../src/game/fieldAssets';

function scene(available = Object.values(FIELD_TEXTURES).map(({ key }) => key)) {
  const image = () => {
    const result = { setOrigin: vi.fn(), setDisplaySize: vi.fn(), setDepth: vi.fn() };
    for (const fn of Object.values(result)) fn.mockReturnValue(result);
    return result;
  };
  return {
    add: { image: vi.fn(image) },
    textures: { exists: (key: string) => available.includes(key as typeof available[number]) },
    load: { image: vi.fn() },
  };
}

describe('royal garden static field assets', () => {
  test('preloads two shared relative PNG textures with no runtime texture generation', () => {
    const fake = scene();
    preloadFieldTextures(fake as never);
    expect(fake.load.image.mock.calls).toEqual(Object.values(FIELD_TEXTURES).map(({ key, path }) => [key, path]));
    for (const asset of Object.values(FIELD_TEXTURES)) expect(asset.path).toMatch(/^\.\/assets\/field\/.+\.png$/);
  });

  test.each([22, 42])('ground and actual path cells align with the unchanged board at tile=%s', (tile) => {
    const fake = scene();
    expect(drawRoyalGardenField(fake as never, 'cross-road', { x: 8, y: 106, tile })).toBe(true);
    const cells = [];
    for (let tx = 0; tx < GRID_W; tx++) {
      for (let ty = 0; ty < GRID_H; ty++) {
        if (isPathTile(tx, ty, 'cross-road')) cells.push([8 + tx * tile, 106 + ty * tile, FIELD_TEXTURES.path.key]);
      }
    }
    expect(fake.add.image.mock.calls).toEqual([[8, 106, FIELD_TEXTURES.ground.key], ...cells]);
    expect(fake.add.image.mock.results[0].value.setDisplaySize).toHaveBeenCalledWith(GRID_W * tile, GRID_H * tile);
    for (const result of fake.add.image.mock.results.slice(1)) {
      expect(result.value.setDisplaySize).toHaveBeenCalledWith(tile, tile);
      expect(result.value.setDepth).toHaveBeenCalledWith(0);
    }
  });

  test('classic and missing-texture cases create no partial garden or missing-texture tiles', () => {
    const metrics = { x: 24, y: 68, tile: 42 };
    const classic = scene();
    expect(drawRoyalGardenField(classic as never, 'classic-ring', metrics)).toBe(false);
    expect(classic.add.image).not.toHaveBeenCalled();
    for (const available of [[], [FIELD_TEXTURES.ground.key], [FIELD_TEXTURES.path.key]]) {
      const missing = scene(available);
      expect(drawRoyalGardenField(missing as never, 'cross-road', metrics)).toBe(false);
      expect(missing.add.image).not.toHaveBeenCalled();
    }
  });

  test('garden objects are created only during static drawing and preserve navigation overlays', () => {
    const source = readFileSync(new URL('../src/game/FieldRenderer.ts', import.meta.url), 'utf8');
    expect(source.match(/drawRoyalGardenField\(this.scene/g)).toHaveLength(1);
    expect(source.slice(source.indexOf('  update('))).not.toContain('drawRoyalGardenField');
    expect(source).toContain("tr('S  입구', 'S  START')");
    expect(source).toContain("tr('E  출구', 'E  EXIT')");
    expect(source).toContain('const corners = pathCorners(this.mapId)');
  });
});
