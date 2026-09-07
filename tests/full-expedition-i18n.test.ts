import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { handbookRows } from '../src/game/guideData';
import { setLocale } from '../src/i18n';

afterEach(() => setLocale('ko'));

describe('full expedition localization', () => {
  test('guide rows resolve English at call time without changing hand IDs', () => {
    setLocale('en');
    const rows = handbookRows();
    expect(rows).toHaveLength(13);
    expect(rows[0]).toMatchObject({ rank: 0, hand: 'High Card', unit: 'Militia' });
    expect(rows.map((row) => `${row.hand} ${row.rule} ${row.unit} ${row.trait}`).join(' ')).not.toMatch(/[가-힣]/);
  });

  test('full-run UI modules do not cache tr() results at module top level', () => {
    const modules = [
      'MaintenanceOverlay.ts', 'GuideOverlay.ts', 'guideData.ts', 'DeckOverlay.ts', 'OddsOverlay.ts',
      'rerollGuidance.ts', 'ExitConfirmOverlay.ts', 'BossHud.ts', 'bossFeedback.ts',
      'LeaderboardOverlay.ts', 'ShareCard.ts', 'SidePanel.ts',
    ];
    for (const module of modules) {
      const source = readFileSync(new URL(`../src/game/${module}`, import.meta.url), 'utf8');
      expect(source, module).not.toMatch(/^(?:export\s+)?const\s+\w+\s*=\s*tr\(/m);
    }
  });
});
