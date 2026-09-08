import { tr } from '../i18n';

/** Local personal record only: shared challenge acceptance always takes precedence. */
export function dailyChallengeLabel(daily: { date: string; bestScore: number } | null, date: string, hasChallenge: boolean): string {
  if (hasChallenge) return tr('도전 수락', 'ACCEPT CHALLENGE');
  const title = tr('오늘의 도전', 'DAILY CHALLENGE');
  if (!daily || daily.date !== date || !Number.isSafeInteger(daily.bestScore) || daily.bestScore < 0) return title;
  const score = daily.bestScore.toLocaleString('en-US');
  return `${title}\n${tr(`내 최고 ${score}점`, `MY BEST ${score}`)}`;
}
