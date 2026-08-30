import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import {
  dominantSuitChoices, handVariant, suitDamageMultiplier, suitPeriodMultiplier,
  variantDamageMultiplier, variantPeriodMultiplier,
  variantUnitName,
} from '../src/core/cards/handIdentity';
import { Game } from '../src/core/game';
import { addUnit, createField, spawnEnemy, tick } from '../src/core/combat';
import { killGold } from '../src/core/balance';
import { h } from './helpers';

describe('hand identity and suit traits', () => {
  test('마운틴과 백스트레이트를 기존 족보 위의 변형 태그로 구분한다', () => {
    expect(handVariant(h('TS JH QD KC AH'), HandRank.Straight)).toBe('mountain');
    expect(handVariant(h('AS 2H 3D 4C 5S'), HandRank.Straight)).toBe('back-straight');
    expect(handVariant(h('TS JS QS KS AS'), HandRank.RoyalFlush)).toBeNull();
    expect(variantUnitName('저격수', 'mountain')).toBe('왕실 저격수');
    expect(variantUnitName('저격수', 'back-straight')).toBe('선봉 저격수');
  });

  test('가장 많은 문양을 대표 후보로 삼고 2-2-1 동률은 둘 다 반환한다', () => {
    expect(dominantSuitChoices(h('AS KS QS JH 2D'))).toEqual(['S']);
    expect(dominantSuitChoices(h('AS KS QH JH 2D'))).toEqual(['S', 'H']);
  });

  test('UI 확정 모드는 동률 문양 선택을 요구하고 선택한 문양과 변형을 유닛에 전달한다', () => {
    const game = new Game(810);
    game.hand = h('TS KS JH QH AD');
    expect(game.confirmHand(true)).toBeNull();
    expect(game.selectDominantSuit('H')).toBe(true);
    expect(game.confirmHand(true)).toBe(HandRank.Straight);
    expect(game.lastHandVariant).toBe('mountain');
    expect(game.lastHandSuit).toBe('H');
    expect(game.placeUnit(5, 2)).toBe(true);
    expect(game.field.units[0]).toMatchObject({ suit: 'H', variant: 'mountain' });
  });

  test('문양과 특수 스트레이트 배율은 대상과 공격 주기에 맞게 분리된다', () => {
    expect(suitDamageMultiplier('S', true)).toBe(1.12);
    expect(suitDamageMultiplier('S', false)).toBe(1);
    expect(suitDamageMultiplier('C', false)).toBe(1.1);
    expect(suitDamageMultiplier('C', true)).toBe(1);
    expect(suitPeriodMultiplier('H')).toBe(0.9);
    expect(variantDamageMultiplier('mountain')).toBe(1.25);
    expect(variantPeriodMultiplier('back-straight')).toBe(0.85);
  });

  test('클로버와 마운틴 배율이 실제 전투 피해에 함께 적용된다', () => {
    const field = createField();
    const enemy = spawnEnemy(field, 'normal', 20, { dist: 2 * 44, hpOverride: 1000 });
    addUnit(field, HandRank.Pair, 3, 2, false, 'C', 'mountain');

    const result = tick(field, 1 / 30, 1);

    expect(result.attacks[0].damage).toBeCloseTo(11.2 * 1.1 * 1.25);
    expect(1000 - enemy.hp).toBeCloseTo(11.2 * 1.1 * 1.25);
  });

  test('다이아 유닛의 처치 골드는 한 라운드 최대 3G다', () => {
    const game = new Game(811);
    game.gold = 0;
    addUnit(game.field, HandRank.Trips, 3, 2, false, 'D');
    for (let index = 0; index < 5; index++) {
      spawnEnemy(game.field, 'normal', 1, { dist: 2 * 44, hpOverride: 1 });
    }
    game.phase = 'combat';

    const result = game.tickCombat(1 / 30)!;

    expect(result.deaths).toHaveLength(5);
    expect(result.goldEarned).toBe(killGold(1) * 5 + 3);
  });

  test('동일 문양 3기 합성만 문양을 계승하고 특수 태그는 계승하지 않는다', () => {
    const same = new Game(812);
    const sameIds = [
      addUnit(same.field, HandRank.Pair, 4, 4, false, 'S', 'mountain').id,
      addUnit(same.field, HandRank.Pair, 5, 4, false, 'S').id,
      addUnit(same.field, HandRank.Pair, 6, 4, false, 'S').id,
    ];
    expect(same.fuseUnits(sameIds)).toBe(true);
    expect(same.field.units[0]).toMatchObject({ tier: HandRank.TwoPair, suit: 'S', variant: null });

    const mixed = new Game(813);
    const mixedIds = [
      addUnit(mixed.field, HandRank.Pair, 4, 4, false, 'S').id,
      addUnit(mixed.field, HandRank.Pair, 5, 4, false, 'H').id,
      addUnit(mixed.field, HandRank.Pair, 6, 4, false, 'S').id,
    ];
    expect(mixed.fuseUnits(mixedIds)).toBe(true);
    expect(mixed.field.units[0]).toMatchObject({ tier: HandRank.TwoPair, suit: null, variant: null });
  });
});
