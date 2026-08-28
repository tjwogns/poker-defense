import { describe, expect, test } from 'vitest';
import { Card, HandRank } from '../src/core/cards/types';
import { Game } from '../src/core/game';
import { DECK_SEAL_COSTS } from '../src/core/balance';

function key(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function cardOutsideHand(game: Game): Card {
  const hand = new Set(game.hand.map(key));
  return game.deckSnapshot().find((card) => !hand.has(key(card)))!;
}

describe('덱 개조 인장', () => {
  test('새 런은 52장 덱과 인장 0개로 시작한다', () => {
    const game = new Game(101);
    expect(game.deckSize).toBe(52);
    expect(game.deckSnapshot()).toHaveLength(52);
    expect(game.deckSeals).toEqual({ banish: 0, duplicate: 0 });
  });

  test('현재 패 밖의 카드를 추방하면 덱과 인장이 각각 1 줄어든다', () => {
    const game = new Game(102);
    const card = cardOutsideHand(game);
    game.grantDeckSeal('banish');

    expect(game.deckEditStatus('banish', card)).toBe('ready');
    expect(game.applyDeckSeal('banish', card)).toBe(true);
    expect(game.deckSize).toBe(51);
    expect(game.deckCardCount(card)).toBe(0);
    expect(game.deckSeals.banish).toBe(0);
  });

  test('현재 패의 유일한 사본은 추방할 수 없고 인장도 유지된다', () => {
    const game = new Game(103);
    const card = game.hand[0];
    game.grantDeckSeal('banish');

    expect(game.deckEditStatus('banish', card)).toBe('hand_copy_protected');
    expect(game.applyDeckSeal('banish', card)).toBe(false);
    expect(game.deckSize).toBe(52);
    expect(game.deckSeals.banish).toBe(1);
  });

  test('카드를 복제하면 실제 사본 수가 늘고 인장을 소비한다', () => {
    const game = new Game(104);
    const card = game.hand[0];
    game.grantDeckSeal('duplicate');

    expect(game.applyDeckSeal('duplicate', card)).toBe(true);
    expect(game.deckSize).toBe(53);
    expect(game.deckCardCount(card)).toBe(2);
    expect(game.deckSeals.duplicate).toBe(0);
  });

  test('교환 시작·패 확정·전투 중에는 덱을 바꿀 수 없다', () => {
    const exchanged = new Game(105);
    exchanged.grantDeckSeal('duplicate', 3);
    expect(exchanged.doExchange()).toBe(true);
    expect(exchanged.deckEditStatus('duplicate', exchanged.hand[0])).toBe('exchange_started');

    const confirmed = new Game(106);
    confirmed.grantDeckSeal('duplicate');
    confirmed.confirmHand();
    expect(confirmed.deckEditStatus('duplicate', confirmed.hand[0])).toBe('hand_locked');

    const combat = new Game(107);
    combat.grantDeckSeal('duplicate');
    combat.phase = 'combat';
    expect(combat.deckEditStatus('duplicate', combat.hand[0])).toBe('wrong_phase');
  });

  test('인장은 양의 정수만 지급할 수 있다', () => {
    const game = new Game(108);
    expect(() => game.grantDeckSeal('banish', 0)).toThrow('positive integer');
    expect(() => game.grantDeckSeal('banish', 1.5)).toThrow('positive integer');
  });

  test('9라운드 종료 후 10라운드 보스전 전에 정비소가 한 번 열린다', () => {
    const game = reachFirstMaintenance();
    expect(game.round).toBe(10);
    expect(game.maintenancePending).toBe(true);
    expect(game.confirmHand()).toBeNull();
    expect(game.startCombat()).toBe(false);

    expect(game.leaveMaintenance()).toBe(true);
    expect(game.maintenancePending).toBe(false);
    expect(game.leaveMaintenance()).toBe(false);
    expect(game.confirmHand()).not.toBeNull();
  });

  test('정비소는 여섯 보스전 직전에만 예약된다', () => {
    for (const roundBefore of [9, 19, 29, 39, 49, 59]) {
      const game = reachMaintenance(roundBefore);
      expect(game.round).toBe(roundBefore + 1);
      expect(game.maintenancePending).toBe(true);
      expect(game.leaveMaintenance()).toBe(true);
      expect(game.maintenancePending).toBe(false);
    }
  });

  test('정비소에서는 각 인장을 한 번만 구매하고 골드를 정확히 지불한다', () => {
    const game = reachFirstMaintenance();
    game.gold = 100;

    expect(game.maintenanceOffer('banish')).toEqual({
      cost: DECK_SEAL_COSTS.banish,
      purchased: false,
      affordable: true,
    });
    expect(game.buyMaintenanceSeal('banish')).toBe(true);
    expect(game.buyMaintenanceSeal('banish')).toBe(false);
    expect(game.buyMaintenanceSeal('duplicate')).toBe(true);
    expect(game.gold).toBe(100 - DECK_SEAL_COSTS.banish - DECK_SEAL_COSTS.duplicate);
    expect(game.deckSeals).toEqual({ banish: 1, duplicate: 1 });
    expect(game.maintenanceOffer('banish').purchased).toBe(true);
  });

  test('골드가 부족한 정비소 구매는 상태를 바꾸지 않는다', () => {
    const game = reachFirstMaintenance();
    game.gold = DECK_SEAL_COSTS.duplicate - 1;
    expect(game.buyMaintenanceSeal('duplicate')).toBe(false);
    expect(game.deckSeals.duplicate).toBe(0);
    expect(game.gold).toBe(DECK_SEAL_COSTS.duplicate - 1);
  });
});

function reachFirstMaintenance(): Game {
  return reachMaintenance(9);
}

function reachMaintenance(roundBefore: number): Game {
  const game = new Game(109);
  game.round = roundBefore;
  game.gold = 1000;
  game.upgradeLevel = 30;
  game.pendingUnits.push(HandRank.RoyalFlush);
  expect(game.placeUnit(8, 5)).toBe(true);
  game.handConfirmed = true;
  expect(game.startCombat()).toBe(true);
  for (let i = 0; i < 5000 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);
  expect(game.phase).toBe('prep');
  return game;
}
