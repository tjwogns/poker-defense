import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { defaultProfile, ensureLeaderboardIdentity } from '../src/meta/profile';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('English onboarding copy regression', () => {
  test('new English profiles get an English leaderboard name while existing identity stays untouched', () => {
    const created = ensureLeaderboardIdentity(defaultProfile(), () => 'english-player-id', 'en');
    expect(created.leaderboardName).toMatch(/^[A-Za-z]+ [A-Za-z]+ \d{2}$/);

    const existing = { ...created, leaderboardName: '고요한 스페이드 01' };
    expect(ensureLeaderboardIdentity(existing, () => 'replacement-id', 'en')).toEqual(existing);

    const partial = { ...defaultProfile(), leaderboardPlayerId: 'preserved-player-id' };
    expect(ensureLeaderboardIdentity(partial, () => 'replacement-id', 'en').leaderboardPlayerId)
      .toBe('preserved-player-id');
  });

  test('menu, R1-R3 panel, inspector, and placement/fusion feedback keep English branches', () => {
    const menu = read('../src/game/MenuScene.ts');
    expect(menu).toContain("tr('왕관 기록', 'CROWN RECORD')");
    expect(menu).toContain("tr('업적', 'ACHIEVEMENTS')");
    expect(menu).toContain("tr('패치 NEW', 'PATCH NEW')");

    const panel = read('../src/game/SidePanel.ts');
    for (const copy of [
      'AREA DAMAGE WORKS WELL', 'COMBAT IN PROGRESS', 'SELECT 3 MATCHING UNITS',
      'IGNORES DEFENSE', 'SELL +', 'englishSuitTrait', 'handName(rank, HAND_NAMES_KO[rank])',
      "tr('왕국 라이프 · 적 한 바퀴 완주 시 감소', 'KINGDOM LIVES')",
    ]) expect(panel).toContain(copy);

    const play = read('../src/game/PlayScene.ts');
    for (const copy of [
      'THE PATH IS OUT OF RANGE', 'RED TILES CANNOT REACH THE PATH',
      'FUSION SELECTION CANCELED', 'FUSION MATERIALS', 'SELECT 2 MATCHING UNITS',
      'FUSED!', 'BOSS ESCAPED · DEFEAT', 'ENEMY BREACHED', 'RELIC BONUS',
      'handVariantName', 'suitIdentityName',
    ]) expect(play).toContain(copy);

    const field = read('../src/game/FieldRenderer.ts');
    expect(field).toContain('NEAR EXIT');
  });
});
