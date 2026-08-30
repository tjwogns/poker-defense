import { describe, expect, test } from 'vitest';
import { bossDef } from '../src/core/bosses';
import { bossSpriteKey } from '../src/game/bossAssets';
import { bossIntroDuration, bossSpriteExtent } from '../src/game/bossVisualPolicy';

describe('보스 비주얼 정책', () => {
  test('보스 라운드마다 고유 스프라이트를 선택한다', () => {
    const keys = [10, 20, 30, 40, 50, 60].map(bossSpriteKey);
    expect(new Set(keys).size).toBe(6);
    expect(keys[0]).toContain(bossDef(10).id.replace('_', '-'));
    expect(keys[5]).toContain(bossDef(60).id.replace('_', '-'));
  });

  test('최종 보스는 더 크고 긴 등장 연출을 사용한다', () => {
    expect(bossSpriteExtent(60)).toBeGreaterThan(bossSpriteExtent(50));
    expect(bossIntroDuration(60)).toBeGreaterThan(bossIntroDuration(50));
  });
});
