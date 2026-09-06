import Phaser from 'phaser';
import type { EnemyKindId } from '../core/enemies';

export const ENEMY_SPRITE_KEYS: Partial<Record<EnemyKindId, string>> = {
  normal: 'enemy-normal-card-soldier-pixel-v1',
  fast: 'enemy-fast-chip-thief-pixel-v1',
  tank: 'enemy-tank-vault-golem-pixel-v1',
  regen: 'enemy-regen-stitched-heartling-pixel-v1',
  splitter: 'enemy-splitter-card-mimic-pixel-v1',
};

export const ENEMY_SPRITE_PATHS: Record<string, string> = {
  'enemy-normal-card-soldier-pixel-v1': './assets/enemies/normal-card-soldier-pixel-v1.png',
  'enemy-fast-chip-thief-pixel-v1': './assets/enemies/fast-chip-thief-pixel-v1.png',
  'enemy-tank-vault-golem-pixel-v1': './assets/enemies/tank-vault-golem-pixel-v1.png',
  'enemy-regen-stitched-heartling-pixel-v1': './assets/enemies/regen-stitched-heartling-pixel-v1.png',
  'enemy-splitter-card-mimic-pixel-v1': './assets/enemies/splitter-card-mimic-pixel-v1.png',
};

const ENEMY_SPRITE_EXTENTS: Partial<Record<EnemyKindId, number>> = {
  normal: 28,
  fast: 25,
  tank: 32,
  regen: 28,
  splitter: 29,
};

/** v2.2.1 폐기된 덱 정식 그래픽. enemyArt=classic에서만 기존 도형을 유지한다. */
export function isDiscardedEnemyArtEnabled(search: string): boolean {
  return new URLSearchParams(search).get('enemyArt') !== 'classic';
}

export function enemySpriteKey(kind: EnemyKindId, search: string): string | undefined {
  if (!isDiscardedEnemyArtEnabled(search)) return undefined;
  return ENEMY_SPRITE_KEYS[kind];
}

export function enemySpriteExtent(kind: EnemyKindId): number {
  return ENEMY_SPRITE_EXTENTS[kind] ?? 0;
}

export function preloadEnemySprites(scene: Phaser.Scene): void {
  if (!isDiscardedEnemyArtEnabled(window.location.search)) return;
  for (const [key, path] of Object.entries(ENEMY_SPRITE_PATHS)) scene.load.image(key, path);
}
