import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { Game } from '../src/core/game';
import { addUnit, spawnEnemy } from '../src/core/combat';
import { createHandTactic } from '../src/core/handTactics';
import { HAND_MASTERY_DAMAGE_PER_LEVEL } from '../src/core/mastery';
import { LIFE_MODE_BOUNTY_MULTIPLIER } from '../src/core/balance';
import { ENEMY_KINDS } from '../src/core/enemies';
import { h } from './helpers';

describe('hand tactics Game integration', () => {
  test('확정한 패의 전술을 만들고 Full House 구역은 최종 prep 배치로 startCombat에서 잠근다', () => {
    const game = new Game(601);
    game.round = 6;
    const tl = addUnit(game.field, HandRank.Pair, 2, 2);
    const tr1 = addUnit(game.field, HandRank.Pair, 10, 2);
    const tr2 = addUnit(game.field, HandRank.Pair, 11, 2);
    game.hand = h('AS AH AD KC KD');
    expect(game.confirmHand()).toBe(HandRank.FullHouse);
    expect(game.handTactic).toMatchObject({ id: 'stronghold', round: 6, lockedZone: null });
    game.discardPendingUnit();
    expect(game.moveUnit(tr1.id, 2, 8)).toBe(true);
    expect(game.moveUnit(tr2.id, 3, 8)).toBe(true);
    expect(game.startCombat()).toBe(true);
    expect(game.handTactic?.lockedZone).toBe(2);
    expect(game.moveUnit(tl.id, 4, 8)).toBe(false);
    expect(game.handTactic?.lockedZone).toBe(2);
  });

  test('Pair 이하 확정은 전술이 없고 새 확정은 이전 전술 상태를 지운다', () => {
    const game = new Game(602);
    game.hand = h('AS AH KD KC 2S');
    expect(game.confirmHand()).toBe(HandRank.TwoPair);
    expect(game.handTactic?.id).toBe('volley');
    game.handConfirmed = false;
    game.hand = h('AS AH KD QC 2S');
    expect(game.confirmHand()).toBe(HandRank.Pair);
    expect(game.handTactic).toBeNull();
  });

  test('startCombat 뒤 late spawn된 현재 라운드 적에는 적용하고 carry-over 적은 제외한다', () => {
    const game = new Game(606);
    game.round = 5;
    const carry = spawnEnemy(game.field, 'normal', 4);
    game.hand = h('9S 8H 7D 6C 5S');
    expect(game.confirmHand()).toBe(HandRank.Straight);
    game.discardPendingUnit();
    expect(game.startCombat()).toBe(true);
    game.tickCombat(1 / 30);
    const current = game.field.enemies.find((enemy) => enemy.round === 5)!;
    expect(carry.dist).toBeCloseTo(2, 6);
    expect(current.dist).toBeCloseTo(60 * ENEMY_KINDS[current.kind].speedMult * 0.9 / 30, 6);
  });

  test('Royal 피해는 전역 유물·문양·숙련과 각각 한 번씩 곱연산한다', () => {
    const game = new Game(603);
    game.round = 20;
    game.phase = 'combat';
    game.relics.push('royal_seal');
    game.handMastery[HandRank.Pair] = 1;
    game.handTactic = createHandTactic(HandRank.RoyalFlush, 20, 'C');
    const enemy = spawnEnemy(game.field, 'normal', 20, { dist: 2 * 42 });
    addUnit(game.field, HandRank.Pair, 3, 2, false, 'C');
    const before = enemy.hp;
    game.tickCombat(1 / 30);
    expect(before - enemy.hp).toBeCloseTo(
      11.2 * 1.12 * (1 + HAND_MASTERY_DAMAGE_PER_LEVEL) * 1.1 * 1.2,
      6,
    );
  });

  test.each([
    ['classic', 'classic', 1] as const,
    ['life', 'life-economy', LIFE_MODE_BOUNTY_MULTIPLIER] as const,
  ])('Royal 처치 골드는 %s 규칙과 전쟁 금고에 곱연산되어 ledger에 반영된다', (_label, ruleset, lifeMult) => {
    const game = new Game(604, ruleset);
    game.round = 5;
    game.phase = 'combat';
    game.gold = 0;
    game.relics.push('war_chest');
    game.handTactic = createHandTactic(HandRank.RoyalFlush, 5, 'S');
    for (let i = 0; i < 10; i++) {
      spawnEnemy(game.field, 'normal', 5, { dist: 2 * 42, hpOverride: 1 });
      addUnit(game.field, HandRank.Pair, 3, 2);
    }
    const result = game.tickCombat(1 / 30)!;
    const expected = Math.floor(10 * 3 * 1.25 * lifeMult)
      + Math.floor(10 * 3 * 0.1 * 1.25 * lifeMult + 1e-9);
    expect(result.deaths).toHaveLength(10);
    expect(result.goldEarned).toBe(expected);
    expect(game.goldIncome.bounty).toBe(expected);
    expect(game.handTactic).toBeNull();
  });

  test('Royal 중 이월 적만 처치하면 LIFE/전쟁 금고의 기존 tick floor보다 골드가 늘지 않는다', () => {
    const setup = (withTactic: boolean) => {
      const game = new Game(605, 'life-economy');
      game.round = 5;
      game.phase = 'combat';
      game.gold = 0;
      game.relics.push('war_chest');
      game.handTactic = withTactic ? createHandTactic(HandRank.RoyalFlush, 5, 'S') : null;
      for (let i = 0; i < 10; i++) {
        spawnEnemy(game.field, 'normal', 4, { dist: 2 * 42, hpOverride: 1 });
        addUnit(game.field, HandRank.Pair, 3, 2);
      }
      return game;
    };
    const control = setup(false);
    const royal = setup(true);
    expect(royal.tickCombat(1 / 30)!.goldEarned).toBe(control.tickCombat(1 / 30)!.goldEarned);
    expect(royal.goldIncome.bounty).toBe(control.goldIncome.bounty);
  });
});
