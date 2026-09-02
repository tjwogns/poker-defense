import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const overlayFiles = [
  'GuideOverlay.ts',
  'DeckOverlay.ts',
  'OddsOverlay.ts',
  'MaintenanceOverlay.ts',
  'PatchNotesOverlay.ts',
  'LeaderboardOverlay.ts',
  'ExitConfirmOverlay.ts',
];

describe('portrait overlays', () => {
  test.each(overlayFiles)('%s는 세로 화면 높이를 기준으로 배치한다', (file) => {
    const source = readFileSync(new URL(`../src/game/${file}`, import.meta.url), 'utf8');
    expect(source).toContain('isPortraitLayout');
    expect(source).toContain('portraitSceneHeight');
  });
});
