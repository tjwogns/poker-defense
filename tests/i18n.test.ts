import { afterEach, describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import {
  handName, handVariantName, LOCALE_STORAGE_KEY, resolveLocale, setLocale, suitIdentityName, tr, unitName,
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
  });
});
