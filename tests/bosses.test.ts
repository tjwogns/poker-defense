import { describe, expect, test } from 'vitest';
import { bossDef, bossModifiers, featuredBoss } from '../src/core/bosses';
import { addUnit, createField, spawnEnemy, tick } from '../src/core/combat';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';

describe('boss identities', () => {
  test('R10부터 R60까지 서로 다른 보스 이름과 기믹을 정의한다', () => {
    const defs = [10, 20, 30, 40, 50, 60].map(bossDef);
    expect(new Set(defs.map((def) => def.id)).size).toBe(6);
    expect(defs.map((def) => def.name)).toEqual([
      '철갑 딜러', '혈월 여왕', '시간 도둑', '황금 폭군', '군단왕', '로열 조커',
    ]);
  });

  test('철갑 딜러는 일반 공격 피해를 35% 줄인다', () => {
    const field = createField();
    const boss = spawnEnemy(field, 'boss', 10, { hpOverride: 1000, dist: 0 });
    addUnit(field, HandRank.Pair, 2, 2);
    tick(field, 1 / 30, 1);
    expect(1000 - boss.hp).toBeCloseTo(11.2 * 0.65, 3);
  });

  test('혈월 여왕은 초당 최대 HP 2%를 회복한다', () => {
    const field = createField();
    const boss = spawnEnemy(field, 'boss', 20, { hpOverride: 100 });
    boss.hp = 50;
    tick(field, 1, 1);
    expect(boss.hp).toBeCloseTo(52);
  });

  test('시간 도둑은 기본 보스보다 60% 빠르다', () => {
    const field = createField();
    const boss = spawnEnemy(field, 'boss', 30, { hpOverride: 100 });
    tick(field, 1, 1);
    expect(boss.dist).toBeCloseTo(60 * 0.7 * 1.6);
  });

  test('황금 폭군은 전투 중 5초마다 5골드를 빼앗는다', () => {
    const game = bossGame(40);
    game.gold = 100;
    game.tickCombat(2);
    expect(game.bossAbilityCountdown(40)).toBeCloseTo(3, 5);
    const result = game.tickCombat(5.1)!;
    expect(game.gold).toBe(95);
    expect(result.bossEvents).toContainEqual({ type: 'tax', bossRound: 40, amount: 5 });
  });

  test('군단왕은 8초마다 일반 적 2기를 추가 소환한다', () => {
    const game = bossGame(50);
    const result = game.tickCombat(8.1)!;
    expect(game.field.enemies.filter((enemy) => enemy.kind === 'normal')).toHaveLength(12);
    expect(result.bossEvents).toContainEqual({ type: 'summon', bossRound: 50, count: 2 });
  });

  test('이월된 황금 폭군과 군단왕도 다음 라운드에서 기믹을 유지한다', () => {
    const tyrantGame = new Game(401);
    tyrantGame.round = 41;
    tyrantGame.gold = 100;
    spawnEnemy(tyrantGame.field, 'boss', 40, { hpOverride: 1_000_000 });
    tyrantGame.handConfirmed = true;
    tyrantGame.startCombat();
    tyrantGame.tickCombat(5.1);
    expect(tyrantGame.gold).toBe(95);

    const legionGame = new Game(501);
    legionGame.round = 51;
    spawnEnemy(legionGame.field, 'boss', 50, { hpOverride: 1_000_000 });
    legionGame.handConfirmed = true;
    legionGame.startCombat();
    legionGame.tickCombat(8.1);
    expect(legionGame.field.enemies.filter((enemy) => enemy.kind === 'normal' && enemy.round === 50)).toHaveLength(2);
  });

  test('로열 조커는 HP 절반 아래에서 더 빠르고 단단해진다', () => {
    expect(bossModifiers(60, 0.75)).toMatchObject({ speedMultiplier: 1, damageTakenMultiplier: 1 });
    expect(bossModifiers(60, 0.5)).toMatchObject({ speedMultiplier: 1.7, damageTakenMultiplier: 0.8 });
  });

  test('HUD 대상은 이월 보스보다 가장 높은 라운드의 새 보스를 우선한다', () => {
    const field = createField();
    const carried = spawnEnemy(field, 'boss', 10);
    const current = spawnEnemy(field, 'boss', 20);
    expect(featuredBoss(field.enemies)).toBe(current);
    current.alive = false;
    expect(featuredBoss(field.enemies)).toBe(carried);
  });
});

function bossGame(round: number): Game {
  const game = new Game(301 + round);
  game.round = round;
  game.handConfirmed = true;
  expect(game.startCombat()).toBe(true);
  return game;
}
