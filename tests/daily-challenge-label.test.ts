import { afterEach, expect, test } from 'vitest';
import { dailyChallengeLabel } from '../src/game/dailyChallengeLabel';
import { setLocale } from '../src/i18n';
import { readFileSync } from 'node:fs';

afterEach(() => setLocale('ko'));
test('only the exact challenge date gets a local personal best, including zero', () => {
  expect(dailyChallengeLabel(null, '2026-09-08', false)).toBe('오늘의 도전');
  expect(dailyChallengeLabel({ date: '2026-09-07', bestScore: 12340 }, '2026-09-08', false)).toBe('오늘의 도전');
  expect(dailyChallengeLabel({ date: '2026-09-08', bestScore: 12340 }, '2026-09-08', false)).toBe('오늘의 도전\n내 최고 12,340점');
  expect(dailyChallengeLabel({ date: '2026-09-08', bestScore: 0 }, '2026-09-08', false)).toContain('내 최고 0점');
});
test('shared challenge takes priority; large valid scores stay exact and English fits two lines', () => {
  const daily = { date: '2026-09-08', bestScore: Number.MAX_SAFE_INTEGER };
  expect(dailyChallengeLabel(daily, daily.date, true)).toBe('도전 수락');
  setLocale('en');
  expect(dailyChallengeLabel(daily, daily.date, true)).toBe('ACCEPT CHALLENGE');
  expect(dailyChallengeLabel(daily, daily.date, false)).toBe('DAILY CHALLENGE\nMY BEST 9,007,199,254,740,991');
  expect(dailyChallengeLabel({ ...daily, bestScore: Infinity }, daily.date, false)).toBe('DAILY CHALLENGE');
});
test('local fixture changes the label only, not the persisted profile or daily run arguments', () => {
  const source = readFileSync(new URL('../src/game/MenuScene.ts', import.meta.url), 'utf8');
  expect(source).toContain("['localhost', '127.0.0.1'].includes(window.location.hostname)");
  expect(source).toContain("get('visualTest') === 'daily-best-menu'");
  expect(source).toContain('dailyChallengeLabel(dailyForLabel, challengeDate, hasChallenge)');
  expect(source).not.toContain('profile.daily = dailyForLabel');
  expect(source).toContain("seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate");
});
