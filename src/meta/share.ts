import { HAND_NAMES_KO } from '../core/cards/types';
import { RELIC_DEFS } from '../core/relics';
import { RunSummary } from '../core/scoring';
import { RunMode } from './profile';

export function shareText(summary: RunSummary, mode: RunMode, date: string): string {
  const relics = summary.relics.length > 0
    ? summary.relics.map((id) => RELIC_DEFS[id].name).join(' · ')
    : '유물 없음';
  const modeLine = mode === 'daily' ? `${date} 오늘의 도전` : 'STANDARD RUN';
  return [
    `🃏 포커 디펜스: Royal Siege`,
    `${modeLine} · ${summary.score.toLocaleString('en-US')}점 · ROUND ${summary.round}`,
    `최고 족보 ${HAND_NAMES_KO[summary.bestHand]} · KILLS ${summary.kills}`,
    `유물 ${relics}`,
    `SEED ${summary.seed}`,
  ].join('\n');
}

export function challengeUrl(base: string, date: string): string {
  const url = new URL(base);
  url.searchParams.set('daily', date);
  return url.toString();
}

export function runShareUrl(base: string, mode: RunMode, date: string): string {
  if (mode === 'daily') return challengeUrl(base, date);
  const url = new URL(base);
  url.searchParams.delete('daily');
  return url.toString();
}

/** 공유 URL에서 유효한 UTC 달력 날짜만 복원한다. */
export function dailyDateFromSearch(search: string, fallback: string): string {
  const candidate = new URLSearchParams(search).get('daily');
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return fallback;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) return fallback;
  return candidate;
}
