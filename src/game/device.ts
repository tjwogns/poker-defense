export function compactTouchLayout(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && (width < 960 || height > width) && height < 960;
}

export type LayoutMode = 'desktop' | 'portrait' | 'landscape' | 'gate';

/** 브라우저 CSS viewport를 게임의 논리 캔버스 모드로 변환한다. */
export function layoutMode(width: number, height: number): LayoutMode {
  if (width >= 1100) return 'desktop';
  if (height > width && width >= 360) return 'portrait';
  if (width > height && width >= 600 && height >= 280) return 'landscape';
  return 'gate';
}

export function currentLayoutMode(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';
  return layoutMode(window.innerWidth, window.innerHeight);
}

export function isPortraitLayout(): boolean {
  return currentLayoutMode() === 'portrait';
}

export function isCompactTouchDevice(): boolean {
  return compactTouchLayout(
    window.innerWidth,
    window.innerHeight,
    window.matchMedia('(pointer: coarse)').matches,
  );
}
