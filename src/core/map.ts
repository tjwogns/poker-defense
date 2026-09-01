/**
 * 그리드/경로 정의.
 * classic-ring은 기존 사각 순환 맵, cross-road는 LIFE LAB 전용 개방형 맵이다.
 */

export const GRID_W = 17;
export const GRID_H = 12;
export const TILE = 42; // px

export interface Pt { x: number; y: number }
export type MapId = 'classic-ring' | 'cross-road';

interface MapDefinition {
  corners: readonly Pt[];
  loop: boolean;
}

const MAPS: Record<MapId, MapDefinition> = {
  'classic-ring': {
    corners: [
      { x: 1, y: 1 },
      { x: 15, y: 1 },
      { x: 15, y: 10 },
      { x: 1, y: 10 },
    ],
    loop: true,
  },
  'cross-road': {
    // 5열 × 3행의 네 배치 구역을 감싸며 중앙 십자를 왕복하는 LIFE LAB 경로.
    corners: [
      { x: 2, y: 1 },  // S: 왼쪽 상단
      { x: 8, y: 1 },  // 중앙 상단
      { x: 8, y: 9 },  // 중앙 하단
      { x: 2, y: 9 },  // 왼쪽 하단
      { x: 2, y: 5 },  // 왼쪽 중단
      { x: 14, y: 5 }, // 오른쪽 중단
      { x: 14, y: 9 }, // 오른쪽 하단
      { x: 8, y: 9 },  // 중앙 하단 재진입
      { x: 8, y: 1 },  // 중앙 상단 재진입
      { x: 14, y: 1 }, // 오른쪽 상단
      { x: 14, y: 5 }, // 오른쪽 중단 재진입
      { x: 2, y: 5 },  // 왼쪽 중단 재진입
      { x: 2, y: 1 },  // E: 왼쪽 상단
    ],
    loop: false,
  },
};

/** 기존 API 호환용 classic 맵 코너. */
export const PATH_CORNERS: Pt[] = MAPS['classic-ring'].corners.map((point) => ({ ...point }));

export function tileCenter(x: number, y: number): Pt {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

function mapSegments(mapId: MapId): Array<{ a: Pt; b: Pt; len: number }> {
  const map = MAPS[mapId];
  const count = map.loop ? map.corners.length : map.corners.length - 1;
  return Array.from({ length: count }, (_, index) => {
    const a = tileCenter(map.corners[index].x, map.corners[index].y);
    const b = tileCenter(map.corners[(index + 1) % map.corners.length].x, map.corners[(index + 1) % map.corners.length].y);
    return { a, b, len: Math.abs(b.x - a.x) + Math.abs(b.y - a.y) };
  });
}

const MAP_SEGMENTS: Record<MapId, ReturnType<typeof mapSegments>> = {
  'classic-ring': mapSegments('classic-ring'),
  'cross-road': mapSegments('cross-road'),
};

export function pathCorners(mapId: MapId = 'classic-ring'): readonly Pt[] {
  return MAPS[mapId].corners;
}

export function pathLength(mapId: MapId = 'classic-ring'): number {
  return MAP_SEGMENTS[mapId].reduce((sum, segment) => sum + segment.len, 0);
}

export const PATH_LENGTH = pathLength('classic-ring');

/** 경로상 거리(px) → 픽셀 좌표. classic은 순환하고 cross-road는 끝점에서 멈춘다. */
export function pointAt(dist: number, mapId: MapId = 'classic-ring'): Pt {
  const segments = MAP_SEGMENTS[mapId];
  const total = pathLength(mapId);
  let d = MAPS[mapId].loop
    ? ((dist % total) + total) % total
    : Math.max(0, Math.min(total, dist));
  for (const segment of segments) {
    if (d <= segment.len) {
      const t = segment.len === 0 ? 0 : d / segment.len;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      };
    }
    d -= segment.len;
  }
  return { ...segments[segments.length - 1].b };
}

/** 해당 타일이 선택한 맵의 경로 위인지 판정한다. */
export function isPathTile(x: number, y: number, mapId: MapId = 'classic-ring'): boolean {
  const point = tileCenter(x, y);
  return MAP_SEGMENTS[mapId].some((segment) => distanceToSegment(point, segment.a, segment.b) < 0.01);
}

/** 그리드 안이면서 경로가 아닌 타일 = 배치 가능 */
export function isPlaceable(x: number, y: number, mapId: MapId = 'classic-ring'): boolean {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
  if (mapId === 'cross-road') {
    const inLeftBlock = x >= 3 && x <= 7;
    const inRightBlock = x >= 9 && x <= 13;
    const inTopBlock = y >= 2 && y <= 4;
    const inBottomBlock = y >= 6 && y <= 8;
    return (inLeftBlock || inRightBlock) && (inTopBlock || inBottomBlock);
  }
  return !isPathTile(x, y, mapId);
}

/** 해당 타일의 유닛 사거리가 선택한 경로에 한 지점이라도 닿는지 판정한다. */
export function tileCanReachPath(
  x: number,
  y: number,
  rangeTiles: number,
  mapId: MapId = 'classic-ring',
): boolean {
  if (!isPlaceable(x, y, mapId) || rangeTiles < 0) return false;
  const point = tileCenter(x, y);
  const rangePx = rangeTiles * TILE;
  return MAP_SEGMENTS[mapId].some((segment) => distanceToSegment(point, segment.a, segment.b) <= rangePx);
}

/** 타일 중심에서 가장 가까운 경로까지의 거리(타일 단위). */
export function distanceToPathTiles(x: number, y: number, mapId: MapId = 'classic-ring'): number {
  const point = tileCenter(x, y);
  return Math.min(...MAP_SEGMENTS[mapId].map((segment) => distanceToSegment(point, segment.a, segment.b))) / TILE;
}

/** 현재 사거리에서 경로에 닿는 빈 타일 중 중앙에 가까운 추천 후보를 반환한다. */
export function recommendedPlacementTiles(
  rangeTiles: number,
  occupied: readonly Pt[],
  limit = 3,
  mapId: MapId = 'classic-ring',
): Pt[] {
  const blocked = new Set(occupied.map((point) => `${point.x},${point.y}`));
  const centerX = (GRID_W - 1) / 2;
  const centerY = (GRID_H - 1) / 2;
  const candidates: Array<Pt & { pathDistance: number; centerDistance: number }> = [];
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      if (
        !isPlaceable(x, y, mapId)
        || blocked.has(`${x},${y}`)
        || !tileCanReachPath(x, y, rangeTiles, mapId)
      ) continue;
      candidates.push({
        x,
        y,
        pathDistance: distanceToPathTiles(x, y, mapId),
        centerDistance: Math.hypot(x - centerX, y - centerY),
      });
    }
  }
  return candidates
    .sort((a, b) => a.pathDistance - b.pathDistance
      || a.centerDistance - b.centerDistance
      || a.y - b.y
      || a.x - b.x)
    .slice(0, Math.max(0, limit))
    .map(({ x, y }) => ({ x, y }));
}

function distanceToSegment(point: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
