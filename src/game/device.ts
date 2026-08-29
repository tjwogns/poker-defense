export function compactTouchLayout(width: number, height: number, coarsePointer: boolean): boolean {
  return coarsePointer && width < 960 && height < 600;
}

export function isCompactTouchDevice(): boolean {
  return compactTouchLayout(
    window.innerWidth,
    window.innerHeight,
    window.matchMedia('(pointer: coarse)').matches,
  );
}
