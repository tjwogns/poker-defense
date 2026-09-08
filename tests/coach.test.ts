import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import { firstRunCoachHint, retryRunLabel } from '../src/game/coach';
import { h } from './helpers';
import { setLocale } from '../src/i18n';
import { readFileSync } from 'node:fs';

describe('첫 3라운드 인터랙티브 안내', () => {
  test('홀드 여부와 배치 대기에 맞춰 첫 라운드 문구를 바꾼다', () => {
    const game = new Game(1);
    game.hand = h('2S 3S 4S 7H 9D');
    expect(firstRunCoachHint(game)?.title).toBe('카드 선택');
    game.holds[0] = true;
    expect(firstRunCoachHint(game)?.title).toBe('HOLD 완료');
    game.handConfirmed = true;
    game.pendingUnits.push(HandRank.HighCard);
    expect(firstRunCoachHint(game)?.title).toBe('유닛 배치');
  });

  test('3라운드가 지나면 안내를 끝낸다', () => {
    const game = new Game(2);
    game.round = 4;
    expect(firstRunCoachHint(game)).toBeNull();
  });

  test('영어 행동형 안내를 제공한다', () => {
    setLocale('en');
    const game = new Game(3);
    game.hand = h('2S 3S 4S 7H 9D');
    expect(firstRunCoachHint(game)).toMatchObject({ title: 'CHOOSE CARDS' });
    game.handConfirmed = true;
    game.pendingUnits.push(HandRank.Pair);
    expect(firstRunCoachHint(game)).toMatchObject({ title: 'PLACE YOUR UNIT' });
    setLocale('ko');
  });

  test('portrait coach는 wave card 전용 layout과 불투명 배경을 사용한다', () => {
    const source = readFileSync(new URL('../src/game/FirstRunCoach.ts', import.meta.url), 'utf8');
    expect(source).toContain('portraitCoachLayout(portraitSceneHeight(scene))');
    expect(source).toContain('layout.panel.width, layout.panel.height, UI.panelRaised, 1');
  });

  test.each([1, 2, 3])('R%s follows actual suit → confirm → place → combat actions', (round) => {
    const game = new Game(1, 'life-economy');
    game.round = round;
    game.hand = h('TS KS JH QH AD');
    game.selectedDominantSuit = null;
    expect(firstRunCoachHint(game)?.title).toBe('대표 문양 선택');
    expect(game.selectDominantSuit('S')).toBe(true);
    expect(firstRunCoachHint(game)?.title).toBe('카드 선택');
    game.exchangesUsed = game.maxExchangesNow;
    expect(firstRunCoachHint(game)?.title).toBe('패 확정');
    expect(game.confirmHand(true)).not.toBeNull();
    expect(firstRunCoachHint(game)?.title).toBe('유닛 배치');
    while (game.pendingUnits.length) {
      const x = 3 + game.field.units.length;
      expect(game.placeUnit(x, 2)).toBe(true);
    }
    expect(firstRunCoachHint(game)?.title).toBe('전투 시작');
    expect(game.startCombat()).toBe(true);
    game.gold = 0;
    expect(firstRunCoachHint(game)?.title).toBe('전투 관찰');
    game.gold = game.upgradeCostNow;
    expect(firstRunCoachHint(game)?.title).toBe('전투 중 강화');
  });

  test('rewards and ended runs have no action hint', () => {
    const game = new Game(1);
    game.relicChoices = ['royal_seal'];
    expect(firstRunCoachHint(game)).toBeNull();
    game.relicChoices = [];
    for (const phase of ['victory', 'defeat'] as const) {
      game.phase = phase;
      expect(firstRunCoachHint(game)).toBeNull();
    }
  });

  test('retry labels distinguish new standard seeds from the same daily challenge', () => {
    expect(retryRunLabel(false)).toBe('새 원정 시작');
    expect(retryRunLabel(true)).toBe('같은 일일 도전');
    setLocale('en');
    try {
      expect(retryRunLabel(false)).toBe('NEW RUN');
      expect(retryRunLabel(true)).toBe('SAME DAILY CHALLENGE');
    } finally { setLocale('ko'); }
    const source = readFileSync(new URL('../src/game/PlayScene.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('RETRY SAME RUN');
    expect(source).toContain("this.mode === 'daily' ? this.seedValue : (this.seedValue * 31 + 17) >>> 0");
    for (const modal of ['wagerOverlay', 'guideOverlay', 'deckOverlay', 'oddsOverlay', 'relicOverlay', 'maintenanceOverlay', 'exitOverlay']) {
      expect(source.slice(source.indexOf('this.firstRunCoach.refresh'), source.indexOf('private onHandAction'))).toContain(`!this.${modal}`);
    }
  });
});
