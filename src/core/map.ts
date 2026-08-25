/**
 * 그리드/경로 정의. 적은 (1,1)→(15,1)→(15,10)→(1,10)→(1,1) 사각 링을
 * 시계방향으로 순환한다. 경로가 아닌 그리드 타일은 유닛 배치 가능.
 */

export const GRID_W = 17;
export const GRID_H = 12;
export const TILE = 44; // px

export interface Pt { x: number; y: number }

/** 경로 코너 (타일 좌표, 시계방향, 시작 = 스폰 지점) */
export const PATH_CORNERS: Pt[] = [
  { x: 1, y: 1 },
  { x: 15, y: 1 },
  { x: 15, y: 10 },
  { x: 1, y: 10 },
];

export function tileCenter(x: number, y: number): Pt {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

/** 코너 간 픽셀 구간 길이 (시계방향 순서) */
const SEGMENTS = PATH_CORNERS.map((c, i) => {
  const next = PATH_CORNERS[(i + 1) % PATH_CORNERS.length];
  const a = tileCenter(c.x, c.y);
  const b = tileCenter(next.x, next.y);
  return { a, b, len: Math.abs(b.x - a.x) + Math.abs(b.y - a.y) };
});

export const PATH_LENGTH = SEGMENTS.reduce((s, seg) => s + seg.len, 0);

/** 경로상 거리(px) → 픽셀 좌표. 거리는 순환한다. */
export function pointAt(dist: number): Pt {
  let d = dist % PATH_LENGTH;
  if (d < 0) d += PATH_LENGTH;
  for (const seg of SEGMENTS) {
    if (d <= seg.len) {
      const t = seg.len === 0 ? 0 : d / seg.len;
      return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
    }
    d -= seg.len;
  }
  return { ...SEGMENTS[0].a };
}

const [TL, TR, BR, BL] = [PATH_CORNERS[0], PATH_CORNERS[1], PATH_CORNERS[2], PATH_CORNERS[3]];

/** 해당 타일이 경로 링 위인지 */
export function isPathTile(x: number, y: number): boolean {
  const onH = (y === TL.y || y === BL.y) && x >= TL.x && x <= TR.x;
  const onV = (x === TL.x || x === TR.x) && y >= TL.y && y <= BR.y;
  return onH || onV;
}

/** 그리드 안이면서 경로가 아닌 타일 = 배치 가능 */
export function isPlaceable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
  return !isPathTile(x, y);
}
