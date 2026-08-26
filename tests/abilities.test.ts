import { describe, expect, test } from 'vitest';
import { dominantSuit } from '../src/core/abilities';
import { Game } from '../src/core/game';
import { spawnEnemy, tick } from '../src/core/combat';
import { h } from './helpers';

describe('dominant suit', () => {
  test('가장 많은 무늬를 선택한다', () => {
    expect(dominantSuit(h('2H 5H 8H AS KC'))).toBe('H');
  });

  test('동률이면 가장 높은 카드의 무늬를 선택한다', () => {
    expect(dominantSuit(h('AS KH 9S 4H 2D'))).toBe('S');
  });
});

describe('suit power charges', () => {
  test('족보 확정 시 우세 무늬를 충전하고 최대 3회만 저장한다', () => {
    const game = new Game(201);
    for (let i = 0; i < 4; i++) {
      game.hand = h('AH KH 9H 4S 2D');
      game.handConfirmed = false;
      game.confirmHand();
    }
    expect(game.powerCharges.H).toBe(3);
    expect(game.lastPowerSuit).toBe('H');
  });
});

describe('active suit powers', () => {
  test('스페이드는 일반 적 현재 HP 22%, 보스 6% 피해를 준다', () => {
    const game = combatGame('S');
    const normal = spawnEnemy(game.field, 'normal', 10, { hpOverride: 100 });
    const boss = spawnEnemy(game.field, 'boss', 10, { hpOverride: 200 });

    const result = game.useSuitPower('S');

    expect(result?.affected).toBe(2);
    expect(normal.hp).toBeCloseTo(78);
    expect(boss.hp).toBeCloseTo(188);
    expect(game.powerCharges.S).toBe(0);
  });

  test('하트는 최근 비보스 적 최대 6기를 보상 없이 퇴장시킨다', () => {
    const game = combatGame('H');
    const normals = Array.from({ length: 8 }, () => spawnEnemy(game.field, 'normal', 10));
    const boss = spawnEnemy(game.field, 'boss', 10);
    const goldBefore = game.gold;

    const result = game.useSuitPower('H');

    expect(result?.affected).toBe(6);
    expect(normals.filter((enemy) => enemy.alive)).toHaveLength(2);
    expect(boss.alive).toBe(true);
    expect(game.gold).toBe(goldBefore);
  });

  test('다이아는 라운드에 비례한 즉시 골드를 지급한다', () => {
    const game = combatGame('D');
    game.round = 12;
    game.gold = 0;

    const result = game.useSuitPower('D');

    expect(result?.goldEarned).toBe(61);
    expect(game.gold).toBe(61);
  });

  test('클럽은 모든 적을 3초 동안 이동하지 못하게 한다', () => {
    const game = combatGame('C');
    const enemy = spawnEnemy(game.field, 'normal', 10);
    game.useSuitPower('C');

    tick(game.field, 1, 1);
    expect(enemy.dist).toBe(0);
    tick(game.field, 3, 1);
    expect(enemy.dist).toBeGreaterThan(0);
  });

  test('준비 단계거나 충전이 없으면 스킬을 사용할 수 없다', () => {
    const game = new Game(202);
    game.powerCharges.S = 1;
    expect(game.useSuitPower('S')).toBeNull();
    game.phase = 'combat';
    game.powerCharges.S = 0;
    expect(game.useSuitPower('S')).toBeNull();
  });
});

function combatGame(suit: 'S' | 'H' | 'D' | 'C'): Game {
  const game = new Game(200);
  game.phase = 'combat';
  game.powerCharges[suit] = 1;
  return game;
}
