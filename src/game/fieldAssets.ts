import type Phaser from 'phaser';
import { GRID_H, GRID_W, isPathTile, type MapId } from '../core/map';

export const FIELD_TEXTURES = {
  ground: { key: 'royal-garden-ground', path: './assets/field/royal-garden-ground.png' },
  path: { key: 'royal-garden-path', path: './assets/field/royal-garden-path.png' },
} as const;

export function preloadFieldTextures(scene: Phaser.Scene): void {
  for (const { key, path } of Object.values(FIELD_TEXTURES)) scene.load.image(key, path);
}

/** One static ground image and shared-texture tiles; never called from the frame loop.
 * Use the existing renderer unchanged if either optional texture failed to load.
 */
export function drawRoyalGardenField(
  scene: Phaser.Scene,
  mapId: MapId,
  metrics: { x: number; y: number; tile: number },
): boolean {
  if (mapId !== 'cross-road'
    || !Object.values(FIELD_TEXTURES).every(({ key }) => scene.textures.exists(key))) return false;
  const { x, y, tile } = metrics;
  scene.add.image(x, y, FIELD_TEXTURES.ground.key)
    .setOrigin(0).setDisplaySize(GRID_W * tile, GRID_H * tile).setDepth(0);
  for (let tx = 0; tx < GRID_W; tx++) {
    for (let ty = 0; ty < GRID_H; ty++) {
      if (!isPathTile(tx, ty, mapId)) continue;
      scene.add.image(x + tx * tile, y + ty * tile, FIELD_TEXTURES.path.key)
        .setOrigin(0).setDisplaySize(tile, tile).setDepth(0);
    }
  }
  return true;
}
