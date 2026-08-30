import { describe, expect, it } from 'vitest';
import { RELIC_IDS } from '../src/core/relics';
import {
  RELIC_RARITY_STYLES, RELIC_SPRITE_KEYS, RELIC_SPRITE_PATHS,
} from '../src/game/relicAssets';

describe('relic visual assets', () => {
  it('maps every relic to a unique sprite key and png path', () => {
    expect(Object.keys(RELIC_SPRITE_KEYS)).toHaveLength(RELIC_IDS.length);
    expect(new Set(Object.values(RELIC_SPRITE_KEYS)).size).toBe(RELIC_IDS.length);
    for (const id of RELIC_IDS) {
      expect(RELIC_SPRITE_KEYS[id]).toContain(id.replace(/_/g, '-'));
      expect(RELIC_SPRITE_PATHS[id]).toMatch(/\.png$/);
    }
  });

  it('makes rarity readable without relying on color alone', () => {
    expect(RELIC_RARITY_STYLES.common.lineWidth).toBeLessThan(RELIC_RARITY_STYLES.rare.lineWidth);
    expect(RELIC_RARITY_STYLES.rare.lineWidth).toBeLessThan(RELIC_RARITY_STYLES.legendary.lineWidth);
    expect(RELIC_RARITY_STYLES.legendary.doubleFrame).toBe(true);
    expect(RELIC_RARITY_STYLES.common.doubleFrame).toBe(false);
  });
});
