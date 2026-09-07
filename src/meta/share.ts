import { HAND_NAMES_KO } from '../core/cards/types';
import { RELIC_DEFS } from '../core/relics';
import { RunSummary } from '../core/scoring';
import { RunMode } from './profile';
import { handName, relicName, tr } from '../i18n';

export function shareText(summary: RunSummary, mode: RunMode, date: string): string {
  const relics = summary.relics.length > 0
    ? summary.relics.map((id) => relicName(id, RELIC_DEFS[id].name)).join(' · ')
    : tr('유물 없음', 'NO RELICS');
  const modeLine = mode === 'daily' ? tr(`${date} 오늘의 도전`, `${date} DAILY CHALLENGE`) : 'STANDARD RUN';
  return [
    tr('🃏 포커 디펜스: Royal Siege', '🃏 POKER DEFENSE: Royal Siege'),
    tr(`${modeLine} · ${summary.score.toLocaleString('en-US')}점 · ROUND ${summary.round}`, `${modeLine} · ${summary.score.toLocaleString('en-US')} POINTS · ROUND ${summary.round}`),
    tr(`최고 족보 ${HAND_NAMES_KO[summary.bestHand]} · KILLS ${summary.kills}`, `BEST HAND ${handName(summary.bestHand, HAND_NAMES_KO[summary.bestHand])} · KILLS ${summary.kills}`),
    tr(`유물 ${relics}`, `RELICS ${relics}`),
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
