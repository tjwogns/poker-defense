export type ThreatBand = 'safe' | 'warning' | 'critical';

export function threatBand(alive: number, cap: number): ThreatBand {
  const ratio = cap > 0 ? alive / cap : 1;
  if (ratio >= 0.8) return 'critical';
  if (ratio >= 0.6) return 'warning';
  return 'safe';
}

export function threatLabel(alive: number, cap: number): string {
  const prefix = threatBand(alive, cap) === 'safe' ? '' : '⚠ ';
  return `${prefix}필드 적 ${alive} / ${cap}`;
}

export function threatTitle(cap: number): string {
  return `필드 위험도 · ${cap}기 초과 시 패배`;
}
