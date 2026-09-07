import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import { firstRunCoachHint } from '../src/game/coach';
import { setLocale } from '../src/i18n';
import { readFileSync } from 'node:fs';

describe('첫 3라운드 인터랙티브 안내', () => {
  test('홀드 여부와 배치 대기에 맞춰 첫 라운드 문구를 바꾼다', () => {
    const game = new Game(1);
    expect(firstRunCoachHint(game)?.title).toBe('카드 선택');
    game.holds[0] = true;
    expect(firstRunCoachHint(game)?.title).toBe('HOLD 완료');
    game.handConfirmed = true;
    game.pendingUnits.push(HandRank.HighCard);
    expect(firstRunCoachHint(game)?.title).toBe('첫 유닛 배치');
  });

  test('3라운드가 지나면 안내를 끝낸다', () => {
    const game = new Game(2);
    game.round = 4;
    expect(firstRunCoachHint(game)).toBeNull();
  });

  test('영어 행동형 안내를 제공한다', () => {
    setLocale('en');
    const game = new Game(3);
    expect(firstRunCoachHint(game)).toMatchObject({ title: 'CHOOSE CARDS' });
    game.handConfirmed = true;
    game.pendingUnits.push(HandRank.Pair);
    expect(firstRunCoachHint(game)).toMatchObject({ title: 'PLACE YOUR FIRST UNIT' });
    setLocale('ko');
  });

  test('portrait coach는 wave card 전용 layout과 불투명 배경을 사용한다', () => {
    const source = readFileSync(new URL('../src/game/FirstRunCoach.ts', import.meta.url), 'utf8');
    expect(source).toContain('portraitCoachLayout(portraitSceneHeight(scene))');
    expect(source).toContain('layout.panel.width, layout.panel.height, UI.panelRaised, 1');
  });
});
