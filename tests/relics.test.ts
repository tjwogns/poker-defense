import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import {
  RelicId,
  relicChoices,
  relicModifiers,
} from '../src/core/relics';
import { h } from './helpers';

describe('relic offers', () => {
  test('같은 시드와 마일스톤은 중복 없는 동일한 선택지 3개를 만든다', () => {
    const first = relicChoices(20260826, 10, []);
    const replay = relicChoices(20260826, 10, []);

    expect(first).toEqual(replay);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
  });

  test('이미 획득한 유물은 다음 선택지에서 제외한다', () => {
    const owned: RelicId[] = ['royal_seal', 'war_chest', 'compound_ledger'];
    const choices = relicChoices(77, 20, owned);

    expect(choices).toHaveLength(3);
    for (const id of owned) expect(choices).not.toContain(id);
  });
});

describe('relic effects', () => {
  test('획득 유물의 전투·경제 보정치를 함께 집계한다', () => {
    const mods = relicModifiers([
      'royal_seal',
      'war_chest',
      'compound_ledger',
      'fortified_table',
      'swift_shuffle',
      'ace_up_sleeve',
    ]);

    expect(mods.damageMultiplier).toBe(1.12);
    expect(mods.bountyMultiplier).toBe(1.25);
    expect(mods.interestMultiplier).toBe(1.5);
    expect(mods.interestCapBonus).toBe(20);
    expect(mods.fieldCapBonus).toBe(10);
    expect(mods.freeExchanges).toBe(2);
    expect(mods.bossRankBonus).toBe(1);
  });
});

describe('Game relic flow', () => {
  test('유물 효과가 교환·피해·이자·필드 상한에 반영된다', () => {
    const game = new Game(90);
    game.relics.push('swift_shuffle', 'royal_seal', 'compound_ledger', 'fortified_table');
    game.gold = 100;

    expect(game.exchangeCostNow).toBe(0);
    game.doExchange();
    expect(game.exchangeCostNow).toBe(0);
    expect(game.dmgMult).toBeCloseTo(1.12);
    expect(game.interestNow).toBe(15);
    expect(game.fieldCap).toBe(90);
  });

  test('소매 속 에이스는 보스 라운드 족보를 한 단계 승급한다', () => {
    const game = new Game(92);
    game.round = 20;
    game.relics.push('ace_up_sleeve');
    game.hand = h('8S 8H KD 5C 2S');

    expect(game.confirmHand()).toBe(HandRank.TwoPair);
  });

  test('전쟁 금고는 보스 처치 골드를 25% 늘린다', () => {
    const game = new Game(93);
    game.round = 10;
    game.gold = 0;
    game.relics.push('war_chest');
    game.pendingUnits.push(HandRank.RoyalFlush);
    game.placeUnit(2, 2);
    game.confirmHand();
    game.startCombat();

    const result = game.tickCombat(1 / 30)!;
    expect(result.deaths.some((enemy) => enemy.kind === 'boss')).toBe(true);
    expect(result.goldEarned).toBe(150);
    expect(game.gold).toBe(150);
  });

  test('10라운드 종료 후 유물 선택 전에는 다음 전투를 시작할 수 없다', () => {
    const game = new Game(91);
    game.round = 10;
    game.confirmHand();
    expect(game.startCombat()).toBe(true);

    for (let i = 0; i < 5000 && game.phase === 'combat'; i++) {
      game.tickCombat(1 / 30);
    }

    expect(game.phase).toBe('prep');
    expect(game.round).toBe(11);
    expect(game.relicChoices).toHaveLength(3);
    game.confirmHand();
    expect(game.startCombat()).toBe(false);

    const selected = game.relicChoices[0];
    expect(game.chooseRelic(selected)).toBe(true);
    expect(game.relics).toContain(selected);
    expect(game.relicChoices).toEqual([]);
    expect(game.startCombat()).toBe(true);
  });
});
