import { describe, expect, test } from 'vitest';
import { ENEMY_SPRITE_KEYS, ENEMY_SPRITE_PATHS, enemySpriteExtent, enemySpriteKey } from '../src/game/enemyAssets';

describe('폐기된 덱 적군 정식 에셋', () => {
  test('일반 적 5종을 고유 PNG에 연결한다', () => {
    const kinds = ['normal', 'fast', 'tank', 'regen', 'splitter'] as const;
    expect(Object.keys(ENEMY_SPRITE_KEYS)).toHaveLength(kinds.length);
    expect(new Set(Object.values(ENEMY_SPRITE_KEYS)).size).toBe(kinds.length);
    expect(Object.keys(ENEMY_SPRITE_PATHS)).toHaveLength(kinds.length);
    for (const kind of kinds) {
      expect(enemySpriteKey(kind, '')).toContain(kind);
      expect(enemySpriteExtent(kind)).toBeGreaterThanOrEqual(24);
    }
  });

  test('enemyArt=classic에서만 기존 적 그래픽을 유지한다', () => {
    expect(enemySpriteKey('normal', '?enemyArt=discarded')).toContain('normal');
    expect(enemySpriteKey('normal', '?enemyArt=classic')).toBeUndefined();
    expect(enemySpriteKey('boss', '')).toBeUndefined();
  });
});
