import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import {
  RelicId,
  relicChoices,
  relicModifiers,
} from '../src/core/relics';
import { h } from './helpers';
import { spawnEnemy } from '../src/core/combat';

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
    expect(mods.exchangeCostMultiplier).toBe(1);
    expect(mods.clubStunDuration).toBe(3);
    expect(mods.clubChargeCap).toBe(3);
    expect(mods.heartStrike).toBe(false);
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
    game.upgradeLevel = 5; // 철갑 딜러의 35% 피해 감소를 뚫을 화력
    game.relics.push('war_chest');
    game.pendingUnits.push(HandRank.RoyalFlush);
    game.placeUnit(2, 2);
    game.handConfirmed = true;
    game.startCombat();

    const result = game.tickCombat(1 / 30)!;
    expect(result.deaths.some((enemy) => enemy.kind === 'boss')).toBe(true);
    expect(result.goldEarned).toBe(150);
    expect(game.gold).toBe(150);
  });

  test('탐욕의 장부는 이자를 두 배로 늘리고 유료 교환 비용을 50% 올린다', () => {
    const game = new Game(94);
    game.relics.push('greedy_ledger');
    game.gold = 100;

    expect(game.interestNow).toBe(20);
    expect(game.exchangeCostNow).toBe(0);
    game.doExchange();
    expect(game.exchangeCostNow).toBe(15);
  });

  test('유리 왕관은 큰 피해 보너스 대신 적 상한을 낮춘다', () => {
    const game = new Game(95);
    game.relics.push('glass_crown');

    expect(game.dmgMult).toBeCloseTo(1.35);
    expect(game.fieldCap).toBe(65);
  });

  test('얼어붙은 클로버는 충전 상한을 2로 낮추고 기절을 4.5초로 늘린다', () => {
    const game = new Game(96);
    game.relics.push('frozen_clover');
    game.powerCharges.C = 2;
    game.hand = h('2C 4C 6C 8C KC');
    game.confirmHand();
    expect(game.powerCharges.C).toBe(2);

    const enemy = spawnEnemy(game.field, 'normal', 1);
    game.phase = 'combat';
    game.powerCharges.C = 1;
    game.useSuitPower('C');
    expect(enemy.stunUntil).toBeCloseTo(4.5);
  });

  test('피의 계약은 하트 스킬을 퇴장 대신 전체 현재 HP 피해로 바꾼다', () => {
    const game = new Game(97);
    game.relics.push('blood_contract');
    game.round = 19;
    game.handConfirmed = true;
    game.pendingUnits = [];
    game.startCombat();
    game.tickCombat(1 / 30);
    const enemy = game.field.enemies.find((item) => item.alive)!;
    const hpBefore = enemy.hp;
    game.powerCharges.H = 1;

    const result = game.useSuitPower('H');
    expect(result?.affected).toBeGreaterThan(0);
    expect(enemy.alive).toBe(true);
    expect(enemy.hp).toBeCloseTo(hpBefore * 0.88, 3);
  });

  test('보스를 처치하지 못하고 10라운드를 넘기면 아직 유물 선택지가 나오지 않는다', () => {
    const game = new Game(91);
    game.round = 10;
    game.confirmHand();
    game.pendingUnits = [];
    expect(game.startCombat()).toBe(true);

    for (let i = 0; i < 5000 && game.phase === 'combat'; i++) {
      game.tickCombat(1 / 30);
    }

    expect(game.phase).toBe('prep');
    expect(game.round).toBe(11);
    expect(game.field.enemies.some((enemy) => enemy.kind === 'boss' && enemy.alive)).toBe(true);
    expect(game.relicChoices).toEqual([]);
  });

  test('이월된 보스를 다음 라운드에 처치해도 유물 선택지가 나온다', () => {
    const game = new Game(92);
    game.round = 10;
    game.confirmHand();
    game.pendingUnits = [];
    expect(game.startCombat()).toBe(true);

    for (let i = 0; i < 5000 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);
    expect(game.round).toBe(11);
    const carriedBoss = game.field.enemies.find(
      (enemy) => enemy.kind === 'boss' && enemy.round === 10 && enemy.alive,
    )!;

    game.confirmHand();
    game.pendingUnits = [];
    expect(game.startCombat()).toBe(true);
    carriedBoss.alive = false;
    for (let i = 0; i < 5000 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);

    expect(game.phase).toBe('prep');
    expect(game.round).toBe(12);
    expect(game.relicChoices).toHaveLength(3);
    const selected = game.relicChoices[0];
    expect(game.chooseRelic(selected)).toBe(true);
    expect(game.relics).toContain(selected);
    expect(game.relicChoices).toEqual([]);
  });

  test('10라운드 보스를 처치하면 유물 선택 전에는 다음 전투를 시작할 수 없다', () => {
    const game = new Game(98);
    game.round = 10;
    game.confirmHand();
    game.pendingUnits = [];
    expect(game.startCombat()).toBe(true);

    for (let i = 0; i < 30 * 10 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);
    const boss = game.field.enemies.find((enemy) => enemy.kind === 'boss' && enemy.round === 10)!;
    boss.alive = false;
    for (let i = 0; i < 5000 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);

    expect(game.phase).toBe('prep');
    expect(game.round).toBe(11);
    expect(game.relicChoices).toHaveLength(3);
    game.confirmHand();
    expect(game.startCombat()).toBe(false);
    game.pendingUnits = [];

    const selected = game.relicChoices[0];
    expect(game.chooseRelic(selected)).toBe(true);
    expect(game.relics).toContain(selected);
    expect(game.relicChoices).toEqual([]);
    expect(game.startCombat()).toBe(true);
  });
});
