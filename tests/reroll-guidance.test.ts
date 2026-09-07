import { describe, expect, test } from 'vitest';
import { rerollOdds } from '../src/core/cards/odds';
import { Card } from '../src/core/cards/types';
import { rerollGuidance } from '../src/game/rerollGuidance';
import { setLocale } from '../src/i18n';

function h(text: string): Card[] {
  return text.split(' ').map((token) => {
    const ranks = '23456789TJQKA';
    return { rank: ranks.indexOf(token[0]) + 2, suit: token[1] as Card['suit'] };
  });
}

describe('reroll guidance', () => {
  test('확률의 용도를 교환 판단과 상위 족보 노림수로 설명한다', () => {
    const odds = rerollOdds(h('8S 8H KC 5D 2S'), [true, true, false, false, false]);
    const copy = rerollGuidance(odds, (value) => `${Math.round(value * 100)}%`);
    expect(copy.title).toBe('리롤 판단 · 3장 교환');
    expect(copy.decision).toContain('상향');
    expect(copy.targets).toMatch(/^노림수: (투페어|트리플)/);
    expect(copy.targets).not.toContain('원페어');
  });

  test('전부 HOLD하면 교환 후보를 다시 고르라고 안내한다', () => {
    const odds = rerollOdds(h('AS AH 7C 5D 2S'), [true, true, true, true, true]);
    const copy = rerollGuidance(odds, (value) => `${Math.round(value * 100)}%`);
    expect(copy.title).toContain('교환할 카드 없음');
    expect(copy.decision).toContain('HOLD를 풀어');
  });

  test('uses the active English locale at call time', () => {
    const odds = rerollOdds(h('8S 8H KC 5D 2S'), [true, true, false, false, false]);
    setLocale('en');
    const english = rerollGuidance(odds, (value) => `${Math.round(value * 100)}%`);
    setLocale('ko');
    const korean = rerollGuidance(odds, (value) => `${Math.round(value * 100)}%`);

    expect(english.title).toBe('Reroll advice · Exchange 3');
    expect(english.decision).toContain('Improve');
    expect(english.targets).toMatch(/^Targets: (Two Pair|Three of a Kind)/);
    expect(korean.title).toBe('리롤 판단 · 3장 교환');
  });
});
