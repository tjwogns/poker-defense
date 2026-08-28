import { describe, expect, test } from 'vitest';
import {
  GRID_W, GRID_H, TILE, PATH_LENGTH,
  pointAt, recommendedPlacementTiles, tileCenter, isPathTile, isPlaceable, tileCanReachPath,
} from '../src/core/map';

describe('map & path', () => {
  test('경로 시작점은 (1,1) 타일 중심', () => {
    expect(pointAt(0)).toEqual(tileCenter(1, 1));
  });

  test('경로는 순환한다 (PATH_LENGTH에서 시작점으로 복귀)', () => {
    const start = pointAt(0);
    const wrapped = pointAt(PATH_LENGTH);
    expect(wrapped.x).toBeCloseTo(start.x);
    expect(wrapped.y).toBeCloseTo(start.y);
  });

  test('윗변을 따라 14타일 이동하면 (15,1) 코너', () => {
    expect(pointAt(14 * TILE)).toEqual(tileCenter(15, 1));
  });

  test('경로 타일 판정: 테두리 링만 경로', () => {
    expect(isPathTile(1, 1)).toBe(true);   // 코너
    expect(isPathTile(8, 1)).toBe(true);   // 윗변
    expect(isPathTile(15, 5)).toBe(true);  // 오른변
    expect(isPathTile(8, 5)).toBe(false);  // 내부
    expect(isPathTile(0, 0)).toBe(false);  // 링 바깥
  });

  test('배치 가능 판정: 그리드 안 + 경로가 아닌 타일', () => {
    expect(isPlaceable(8, 5)).toBe(true);   // 중앙
    expect(isPlaceable(0, 0)).toBe(true);   // 링 바깥
    expect(isPlaceable(1, 1)).toBe(false);  // 경로
    expect(isPlaceable(-1, 0)).toBe(false); // 그리드 밖
    expect(isPlaceable(GRID_W, 0)).toBe(false);
    expect(isPlaceable(0, GRID_H)).toBe(false);
  });
});

describe('unit path reachability', () => {
  test('경로에 가까운 타일은 짧은 사거리로도 공격할 수 있다', () => {
    expect(tileCanReachPath(6, 2, 1.5)).toBe(true);
  });

  test('필드 중앙은 사거리 3 유닛에게 무효 위치다', () => {
    expect(tileCanReachPath(6, 6, 3)).toBe(false);
  });

  test('장거리 유닛은 중앙에서도 경로에 닿는다', () => {
    expect(tileCanReachPath(6, 6, 6)).toBe(true);
  });
});

describe('추천 배치 타일', () => {
  test('사거리 안의 빈 타일만 최대 3개 추천한다', () => {
    const occupied = [{ x: 8, y: 2 }];
    const result = recommendedPlacementTiles(3, occupied);
    expect(result).toHaveLength(3);
    expect(result).not.toContainEqual(occupied[0]);
    for (const tile of result) {
      expect(isPlaceable(tile.x, tile.y)).toBe(true);
      expect(tileCanReachPath(tile.x, tile.y, 3)).toBe(true);
    }
  });
});
