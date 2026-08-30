import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { Game } from '../src/core/game';
import {
  createHandMasteryLevels, handMasteryCost, handMasteryMultiplier, handMasteryOffer,
  HAND_MASTERY_MAX_LEVEL, MASTERABLE_HANDS,
} from '../src/core/mastery';

describe('hand mastery', () => {
  test('레벨당 피해가 15%씩 곱연산되고 최대 레벨은 5다', () => {
    const levels = createHandMasteryLevels();
    levels[HandRank.Pair] = 5;
    expect(handMasteryMultiplier(levels, HandRank.Pair)).toBeCloseTo(1.15 ** 5);
    expect(HAND_MASTERY_MAX_LEVEL).toBe(5);
    expect(handMasteryMultiplier(levels, HandRank.Trips)).toBe(1);
  });

  test('같은 시드·라운드는 같은 미완성 족보를 진열하고 최대 레벨은 제외한다', () => {
    const levels = createHandMasteryLevels();
    const offered = handMasteryOffer(77, 10, levels)!;
    expect(handMasteryOffer(77, 10, levels)).toBe(offered);
    levels[offered] = HAND_MASTERY_MAX_LEVEL;
    expect(handMasteryOffer(77, 10, levels)).not.toBe(offered);

    for (const rank of MASTERABLE_HANDS) levels[rank] = HAND_MASTERY_MAX_LEVEL;
    expect(handMasteryOffer(77, 10, levels)).toBeNull();
  });

  test('낮은 족보 연마가 고급 족보보다 저렴하다', () => {
    expect(handMasteryCost(HandRank.Pair)).toBe(30);
    expect(handMasteryCost(HandRank.Pair)).toBeLessThan(handMasteryCost(HandRank.FullHouse));
    expect(handMasteryCost(HandRank.FullHouse)).toBe(80);
  });

  test('정비소에서 한 번만 구매하고 기존 동일 족보 유닛 피해에도 즉시 적용한다', () => {
    const game = reachFirstMaintenance();
    const offer = game.maintenanceMasteryOffer()!;
    const before = game.unitDamageMult(offer.rank);
    const goldBefore = game.gold;

    expect(game.buyMaintenanceMastery()).toBe(true);
    expect(game.handMastery[offer.rank]).toBe(offer.nextLevel);
    expect(game.unitDamageMult(offer.rank)).toBeCloseTo(before * 1.15);
    expect(game.gold).toBe(goldBefore - offer.cost);
    expect(game.buyMaintenanceMastery()).toBe(false);
  });

  test('골드가 부족하면 연마 레벨과 골드가 변하지 않는다', () => {
    const game = reachFirstMaintenance();
    const offer = game.maintenanceMasteryOffer()!;
    game.gold = offer.cost - 1;
    expect(game.buyMaintenanceMastery()).toBe(false);
    expect(game.handMastery[offer.rank]).toBe(offer.level);
    expect(game.gold).toBe(offer.cost - 1);
  });
});

function reachFirstMaintenance(): Game {
  const game = new Game(701);
  game.round = 9;
  game.gold = 1000;
  game.upgradeLevel = 30;
  game.pendingUnits.push(HandRank.RoyalFlush);
  expect(game.placeUnit(8, 5)).toBe(true);
  game.handConfirmed = true;
  expect(game.startCombat()).toBe(true);
  for (let i = 0; i < 5000 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);
  expect(game.phase).toBe('prep');
  expect(game.maintenancePending).toBe(true);
  return game;
}
