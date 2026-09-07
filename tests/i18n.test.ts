import { afterEach, describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import {
  bossMechanic, bossName, enemyName, guideRule, handName, handVariantName, LOCALE_STORAGE_KEY,
  relicDescription, relicName, resolveLocale, setLocale, suitIdentityName, tr, unitName,
} from '../src/i18n';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

afterEach(() => setLocale('ko', new MemoryStorage()));

describe('locale foundation', () => {
  test('query overrides storage and browser language', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCALE_STORAGE_KEY, 'ko');
    expect(resolveLocale('?lang=en', storage, ['ko-KR'])).toBe('en');
    expect(resolveLocale('', storage, ['en-US'])).toBe('ko');
  });

  test('falls back to browser language, defaulting globally to English', () => {
    expect(resolveLocale('', new MemoryStorage(), ['ko-KR', 'en-US'])).toBe('ko');
    expect(resolveLocale('', new MemoryStorage(), ['fr-FR'])).toBe('en');
  });

  test('translates common copy and domain display names without changing game data', () => {
    setLocale('en', new MemoryStorage());
    expect(tr('확정', 'CONFIRM')).toBe('CONFIRM');
    expect(handName(HandRank.Pair, '원 페어')).toBe('One Pair');
    expect(unitName(HandRank.Pair, '궁수')).toBe('Archer');
    expect(handVariantName('back-straight', '백스트레이트')).toBe('Wheel');
    expect(suitIdentityName('S', '♠ 스페이드')).toBe('♠ Spades');
    expect(suitIdentityName(null, '문양 없음')).toBe('No suit');
    expect(relicName('royal_seal', '왕가의 인장')).toBe('Royal Seal');
    expect(relicDescription('royal_seal', '모든 유닛 피해 +12%')).toBe('All unit damage +12%');
    expect(bossName('royal_joker', '로열 조커')).toBe('Royal Joker');
    expect(bossMechanic('royal_joker', '광폭화')).toContain('50%');
    expect(enemyName('fast', '칩 도둑')).toBe('Chip Thief');
    expect(guideRule(HandRank.FullHouse, '트리플 1개 + 페어 1개')).toBe('Three of a kind + a pair');
  });
});
