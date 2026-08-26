import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { challengeUrl, dailyDateFromSearch, runShareUrl, shareText } from '../src/meta/share';

const summary = {
  seed: 1234,
  result: 'victory' as const,
  score: 987654,
  round: 60,
  kills: 1800,
  bestHand: HandRank.FourKind,
  upgradeLevel: 12,
  relics: ['royal_seal', 'war_chest'] as const,
};

describe('share helpers', () => {
  test('결과 공유 문구에 점수·라운드·족보·시드를 포함한다', () => {
    const text = shareText(summary, 'daily', '2026-08-26');
    expect(text).toContain('987,654점');
    expect(text).toContain('ROUND 60');
    expect(text).toContain('포카드');
    expect(text).toContain('SEED 1234');
    expect(text).toContain('2026-08-26 오늘의 도전');
  });

  test('도전 URL은 기존 쿼리를 보존하고 daily 날짜를 추가한다', () => {
    expect(challengeUrl('https://game.example/play?ref=friend', '2026-08-26')).toBe(
      'https://game.example/play?ref=friend&daily=2026-08-26',
    );
  });

  test('공유 링크의 유효한 데일리 날짜를 복원하고 잘못된 값은 오늘로 대체한다', () => {
    expect(dailyDateFromSearch('?daily=2026-08-26', '2026-09-01')).toBe('2026-08-26');
    expect(dailyDateFromSearch('?daily=2026-02-30', '2026-09-01')).toBe('2026-09-01');
    expect(dailyDateFromSearch('?daily=not-a-date', '2026-09-01')).toBe('2026-09-01');
  });

  test('일반 게임 공유 URL에서는 랜딩 페이지의 daily 파라미터를 제거한다', () => {
    expect(runShareUrl('https://game.example/?daily=2026-08-26&ref=friend', 'standard', '2026-08-26')).toBe(
      'https://game.example/?ref=friend',
    );
  });
});
