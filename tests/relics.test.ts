import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import {
  RelicId,
  RELIC_DEFS,
  RELIC_IDS,
  RELIC_SLOT_CAP,
  relicChoices,
  relicSellPrice,
  relicShopChoice,
  relicModifiers,
  relicUnitDamageMultiplier,
} from '../src/core/relics';
import { h } from './helpers';
import { addUnit, createField, spawnEnemy, tick } from '../src/core/combat';

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

  test('상점 유물은 같은 시드에서 같고 보스 보상과 별도 추첨한다', () => {
    expect(relicShopChoice(551, 20, [])).toBe(relicShopChoice(551, 20, []));
    expect(relicShopChoice(551, 20, [])).not.toBeNull();
  });

  test('등급 먼저 추첨해 전체 후보 수와 무관하게 60:30:10에 가깝다', () => {
    const counts = { common: 0, rare: 0, legendary: 0 };
    for (let seed = 1; seed <= 5000; seed++) {
      counts[RELIC_DEFS[relicChoices(seed, 10, [], 1)[0]].rarity]++;
    }
    expect(counts.common / 5000).toBeGreaterThan(0.56);
    expect(counts.common / 5000).toBeLessThan(0.64);
    expect(counts.rare / 5000).toBeGreaterThan(0.26);
    expect(counts.rare / 5000).toBeLessThan(0.34);
    expect(counts.legendary / 5000).toBeGreaterThan(0.07);
    expect(counts.legendary / 5000).toBeLessThan(0.13);
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
    expect(mods.fourSuitGoldBonus).toBe(0);
    expect(mods.pairBonusUnit).toBe(false);
  });

  test('압축 애호가는 덱 45장 이하에서만 무료 교환을 추가한다', () => {
    expect(relicModifiers(['compression_enthusiast'], 46).freeExchanges).toBe(1);
    expect(relicModifiers(['compression_enthusiast'], 45).freeExchanges).toBe(2);
  });

  test('조건부 피해 유물은 유닛·배치·적 상태를 판정하고 ×3에서 제한한다', () => {
    const field = createField();
    field.time = 10;
    const enemy = spawnEnemy(field, 'normal', 30);
    enemy.slowUntil = 11;
    const unit = addUnit(field, HandRank.Pair, 8, 5, true);
    expect(relicUnitDamageMultiplier(['underdog_banner'], unit, enemy, field)).toBe(1.75);
    expect(relicUnitDamageMultiplier(['royal_bloodline'], unit, enemy, field)).toBe(0.8);
    expect(relicUnitDamageMultiplier(['rear_position'], unit, enemy, field)).toBe(1.25);
    expect(relicUnitDamageMultiplier(['pristine_oath'], unit, enemy, field)).toBe(1.6);
    expect(relicUnitDamageMultiplier(['delay_tactics'], unit, enemy, field)).toBe(1.25);
    const royal = addUnit(field, HandRank.FullHouse, 8, 5);
    expect(relicUnitDamageMultiplier(['royal_bloodline'], royal, enemy, field)).toBe(1.5);
    const mult = relicUnitDamageMultiplier([
      'underdog_banner', 'rear_position', 'pristine_oath', 'delay_tactics',
    ], unit, enemy, field);
    expect(mult).toBe(3);

    enemy.slowUntil = 0;
    expect(relicUnitDamageMultiplier(['delay_tactics'], unit, enemy, field)).toBe(1);
  });

  test('조건부 유물 배수가 실제 전투 피해 경로에 적용된다', () => {
    const field = createField();
    const enemy = spawnEnemy(field, 'normal', 20, { dist: 2 * 44 });
    addUnit(field, HandRank.Pair, 3, 2);
    tick(field, 1 / 30, 1, [], (unit, target, current) => (
      relicUnitDamageMultiplier(['underdog_banner'], unit, target, current)
    ));
    expect(enemy.maxHp - enemy.hp).toBeCloseTo(11.2 * 1.75, 3);
  });
});

describe('Game relic flow', () => {
  test('보스 보상은 유물 5슬롯 상한을 넘지 않는다', () => {
    const game = new Game(89);
    game.relics.push(...RELIC_IDS.slice(0, RELIC_SLOT_CAP));
    const offered = RELIC_IDS[RELIC_SLOT_CAP];
    game.relicChoices = [offered];

    expect(game.relicSlotsRemaining).toBe(0);
    expect(game.chooseRelic(offered)).toBe(false);
    expect(game.relics).toHaveLength(RELIC_SLOT_CAP);
    expect(game.relicChoices).toEqual([offered]);
  });

  test('정비소에서 유물을 판매하면 슬롯과 골드를 돌려받는다', () => {
    const game = reachMaintenanceWithRelic();
    const goldBefore = game.gold;

    expect(game.sellRelic('royal_seal')).toBe(true);
    expect(game.relics).not.toContain('royal_seal');
    expect(game.relicSlotsRemaining).toBe(RELIC_SLOT_CAP);
    expect(game.gold).toBe(goldBefore + relicSellPrice('royal_seal'));
    expect(game.sellRelic('royal_seal')).toBe(false);
  });

  test('정비소 유물을 구매하고 풀 슬롯에서는 원자적으로 교체한다', () => {
    const game = reachMaintenanceWithRelic();
    const offer = game.maintenanceRelicOffer()!;
    game.relics.push(...RELIC_IDS.filter((id) => id !== offer.id && id !== 'royal_seal').slice(0, 4));
    expect(game.relics).toHaveLength(RELIC_SLOT_CAP);
    const replaced = game.relics[0];
    const goldBefore = game.gold;

    expect(game.buyMaintenanceRelic()).toBe(false);
    expect(game.buyMaintenanceRelic(replaced)).toBe(true);
    expect(game.relics).toHaveLength(RELIC_SLOT_CAP);
    expect(game.relics).toContain(offer.id);
    expect(game.relics).not.toContain(replaced);
    expect(game.gold).toBe(goldBefore - offer.cost + relicSellPrice(replaced));
  });

  test('골드가 순비용보다 적으면 풀 슬롯 교체가 아무것도 변경하지 않는다', () => {
    const game = reachMaintenanceWithRelic();
    const offer = game.maintenanceRelicOffer()!;
    game.relics.push(...RELIC_IDS.filter((id) => id !== offer.id && id !== 'royal_seal').slice(0, 4));
    const replaced = game.relics.find((id) => relicSellPrice(id) < offer.cost) ?? game.relics[0];
    const before = [...game.relics];
    game.gold = 0;

    expect(game.buyMaintenanceRelic(replaced)).toBe(offer.cost <= relicSellPrice(replaced));
    if (offer.cost > relicSellPrice(replaced)) expect(game.relics).toEqual(before);
  });

  test('가득 찬 보스 보상은 기존 유물 교체와 판매금 지급으로 완료한다', () => {
    const game = new Game(890);
    game.relics.push(...RELIC_IDS.slice(0, RELIC_SLOT_CAP));
    const offered = RELIC_IDS[RELIC_SLOT_CAP];
    const replaced = game.relics[0];
    const goldBefore = game.gold;
    game.relicChoices = [offered];

    expect(game.chooseRelic(offered, replaced)).toBe(true);
    expect(game.relics).toHaveLength(RELIC_SLOT_CAP);
    expect(game.relics).toContain(offered);
    expect(game.gold).toBe(goldBefore + relicSellPrice(replaced));
  });

  test('빈 슬롯이 있는데 교체 대상을 넘기면 보스 보상을 거부한다', () => {
    const game = new Game(892);
    game.relics.push('royal_seal');
    game.relicChoices = ['war_chest'];
    expect(game.chooseRelic('war_chest', 'royal_seal')).toBe(false);
    expect(game.relics).toEqual(['royal_seal']);
  });

  test('무교환 서약 출처와 페어 중개인·4색 문장 확정 효과를 보존한다', () => {
    const game = new Game(891);
    game.relics.push('pristine_oath', 'pair_broker', 'four_suit_crest');
    game.hand = h('8S 8H KD 5C 2D');
    const goldBefore = game.gold;

    expect(game.confirmHand()).toBe(HandRank.Pair);
    expect(game.pendingUnits).toEqual([HandRank.Pair, HandRank.Pair]);
    expect(game.lastPairBrokerBonus).toBe(true);
    expect(game.lastRelicGoldBonus).toBe(15);
    expect(game.lastRelicTriggers).toEqual(['pair_broker', 'four_suit_crest']);
    expect(game.gold).toBe(goldBefore + 15);
    expect(game.placeUnit(3, 2)).toBe(true);
    expect(game.field.units[0].pristine).toBe(true);
  });

  test('정비소 밖에서는 유물을 판매할 수 없다', () => {
    const game = new Game(88);
    game.relics.push('royal_seal');
    expect(game.sellRelic('royal_seal')).toBe(false);
    expect(game.relics).toEqual(['royal_seal']);
  });

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

  test('압축 애호가가 추가 무료 교환을 제공한 순간만 발동 기록을 남긴다', () => {
    const game = new Game(901);
    for (let i = 0; i < 7; i++) {
      const handKeys = new Set(game.hand.map((card) => `${card.rank}${card.suit}`));
      const target = game.deckSnapshot().find((card) => !handKeys.has(`${card.rank}${card.suit}`))!;
      game.grantDeckSeal('banish');
      expect(game.applyDeckSeal('banish', target)).toBe(true);
    }
    game.relics.push('compression_enthusiast');
    game.gold = 100;

    expect(game.deckSize).toBe(45);
    expect(game.doExchange()).toBe(true);
    expect(game.lastRelicTriggers).toEqual([]);
    expect(game.doExchange()).toBe(true);
    expect(game.lastRelicTriggers).toEqual(['compression_enthusiast']);
  });

  test('전투 결과는 실제 공격에 적용된 조건부 유물을 중복 없이 전달한다', () => {
    const game = new Game(902);
    game.relics.push('underdog_banner', 'pristine_oath');
    addUnit(game.field, HandRank.Pair, 3, 2, true);
    spawnEnemy(game.field, 'normal', 20, { dist: 2 * 44 });
    game.phase = 'combat';

    const result = game.tickCombat(1 / 30)!;
    expect(result.attacks).toHaveLength(1);
    expect(result.relicTriggers).toEqual(['underdog_banner', 'pristine_oath']);
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

  test('행운의 클로버는 피해와 필드 적 상한을 높인다', () => {
    const game = new Game(96);
    game.relics.push('frozen_clover');

    expect(game.dmgMult).toBeCloseTo(1.08);
    expect(game.fieldCap).toBe(85);
  });

  test('피의 계약은 피해를 높이는 대신 처치 골드를 낮춘다', () => {
    const mods = relicModifiers(['blood_contract']);

    expect(mods.damageMultiplier).toBeCloseTo(1.25);
    expect(mods.bountyMultiplier).toBeCloseTo(0.75);
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

function reachMaintenanceWithRelic(): Game {
  const game = new Game(87);
  game.round = 9;
  game.gold = 1000;
  game.upgradeLevel = 30;
  game.relics.push('royal_seal');
  game.pendingUnits.push(HandRank.RoyalFlush);
  expect(game.placeUnit(8, 5)).toBe(true);
  game.handConfirmed = true;
  expect(game.startCombat()).toBe(true);
  for (let i = 0; i < 5000 && game.phase === 'combat'; i++) game.tickCombat(1 / 30);
  expect(game.phase).toBe('prep');
  expect(game.maintenancePending).toBe(true);
  return game;
}
