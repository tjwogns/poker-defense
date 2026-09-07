import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/core/game';
import { addUnit } from '../src/core/combat';
import {
  ENEMY_KINDS, FORMATION_COPY, waveComposition, waveEffectiveHpUnits, waveFormation, waveKind,
  waveSpawnOrder, enemyBreachPoints,
} from '../src/core/enemies';
import { spawnEnemy } from '../src/core/combat';
import { HandRank } from '../src/core/cards/types';
import { crownEnemyHpMultiplier, crownSpeedMultiplier, enemyHp, killGold } from '../src/core/balance';
import { scoreForKills, scoreForRoundClear } from '../src/core/scoring';
import { h } from './helpers';

function countsOf(queue: readonly string[]): Record<string, number> {
  return queue.reduce<Record<string, number>>((counts, kind) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    return counts;
  }, {});
}

describe('R11~R29 enemy formations', () => {
  test('학습·보스 라운드의 기존 단일 편성을 보존한다', () => {
    expect(waveComposition(11, 77)).toEqual([{ kind: waveKind(11), count: 30 }]);
    expect(waveKind(11)).toBe('fast');
    expect(waveComposition(12, 77)).toEqual([{ kind: 'tank', count: 30 }]);
    expect(waveComposition(20, 77)).toEqual([{ kind: 'boss', count: 1 }, { kind: 'normal', count: 10 }]);
    expect(waveComposition(21, 77)).toEqual([{ kind: 'regen', count: 30 }]);
    for (const round of [11, 12, 20, 21]) expect(waveFormation(77, round)).toBeNull();
  });

  test.each([13, 14, 15, 16, 17, 18, 19])('R%i는 해금된 normal/fast/tank 2종 30기다', (round) => {
    for (const seed of [1, 77, 999]) {
      const formation = waveFormation(seed, round)!;
      expect(formation.composition).toHaveLength(2);
      expect(formation.composition.reduce((sum, group) => sum + group.count, 0)).toBe(30);
      expect(formation.composition.every((group) => ['normal', 'fast', 'tank'].includes(group.kind))).toBe(true);
    }
  });

  test.each([22, 23, 24, 25, 26, 27, 28, 29])('R%i는 해금된 4역할 중 2~3종 30기다', (round) => {
    for (const seed of [2, 78, 1000]) {
      const composition = waveComposition(round, seed);
      expect(composition.length).toBeGreaterThanOrEqual(2);
      expect(composition.length).toBeLessThanOrEqual(3);
      expect(composition.reduce((sum, group) => sum + group.count, 0)).toBe(30);
      expect(composition.every((group) => ['normal', 'fast', 'tank', 'regen'].includes(group.kind))).toBe(true);
    }
  });

  test('모든 진형은 대표 단일 웨이브 대비 정적 유효 HP ±10% 이내다', () => {
    expect(waveEffectiveHpUnits([{ kind: 'tank', count: 1 }])).toBeCloseTo(1 / 0.75);
    for (let round = 13; round <= 29; round++) {
      if (round === 20 || round === 21) continue;
      for (const seed of [0, 1, 2, 77, 999, 0xffffffff]) {
        const baseline = waveEffectiveHpUnits([{ kind: waveKind(round), count: 30 }]);
        const actual = waveEffectiveHpUnits(waveComposition(round, seed));
        expect(Math.abs(actual / baseline - 1), `seed ${seed} R${round}`).toBeLessThanOrEqual(0.1 + 1e-9);
      }
    }
  });

  test('같은 seed+round는 같은 제안·순서이며 모든 그룹 count를 정확히 보존한다', () => {
    for (let round = 13; round <= 29; round++) {
      if (round === 20 || round === 21) continue;
      for (const seed of [3, 41, 250]) {
        expect(waveFormation(seed, round)).toEqual(waveFormation(seed, round));
        const first = waveSpawnOrder(seed, round);
        expect(first).toEqual(waveSpawnOrder(seed, round));
        expect(first).toHaveLength(30);
        const counts = countsOf(first);
        for (const group of waveComposition(round, seed)) expect(counts[group.kind]).toBe(group.count);
      }
    }
  });

  test('소수 역할은 전체 큐에 분산되고 3종도 서로 덮어쓰지 않는다', () => {
    for (let round = 13; round <= 29; round++) {
      if (round === 20 || round === 21) continue;
      for (const seed of [1, 77, 91, 999]) {
        const queue = waveSpawnOrder(seed, round);
        for (const group of waveComposition(round, seed).filter((candidate) => candidate.count <= 10)) {
          const slots = queue.flatMap((kind, index) => kind === group.kind ? [index] : []);
          const gaps = slots.map((slot, index) => (slots[(index + 1) % slots.length] - slot + 30) % 30);
          expect(Math.max(...gaps), `seed ${seed} R${round} ${group.kind}`).toBeLessThanOrEqual(Math.ceil(30 / group.count) + 4);
        }
      }
    }
  });

  test('Game HUD composition과 실제 큐가 동일하며 조회가 카드 RNG를 소비하지 않는다', () => {
    const observed = new Set<string>();
    for (const seed of [5, 6, 7, 8, 9, 10]) {
      const game = new Game(seed);
      game.round = 24;
      const wave = game.nextWave();
      observed.add(`${wave.formation?.id}:${wave.composition.map((group) => `${group.kind}${group.count}`).join(',')}`);
      expect(countsOf(waveSpawnOrder(seed, 24))).toEqual(countsOf(
        wave.composition.flatMap((group) => Array(group.count).fill(group.kind)),
      ));
    }
    expect(observed.size).toBeGreaterThan(1);

    const control = new Game(404);
    const queried = new Game(404);
    queried.round = 24;
    for (let index = 0; index < 20; index++) queried.nextWave();
    queried.round = 1;
    expect(queried.doExchange()).toBe(control.doExchange());
    expect(queried.hand).toEqual(control.hand);
  });

  test('Game 실제 spawn은 중복 start와 큰 dt에도 진형 count 30을 정확히 지킨다', () => {
    const game = new Game(707);
    game.round = 24;
    game.hand = h('AS AH KD QC 2S');
    game.confirmHand();
    game.discardPendingUnit();
    expect(game.startCombat()).toBe(true);
    expect(game.startCombat()).toBe(false);
    game.tickCombat(30 * 0.45);
    const current = game.field.enemies.filter((enemy) => enemy.round === 24);
    expect(current).toHaveLength(30);
    expect(new Set(current.map((enemy) => enemy.id)).size).toBe(30);
    expect(countsOf(current.map((enemy) => enemy.kind))).toEqual(countsOf(
      game.nextWave().composition.flatMap((group) => Array(group.count).fill(group.kind)),
    ));
  });

  test('진형 30기 처치 bounty/score는 기존 계약이고 왕관 배율은 적별 한 번만 적용된다', () => {
    const game = new Game(708, 'classic', 1);
    game.round = 13;
    game.hand = h('AS AH KD QC 2S');
    game.confirmHand();
    game.discardPendingUnit();
    const scoreBefore = game.score;
    expect(game.startCombat()).toBe(true);
    game.tickCombat(30 * 0.45);
    const spawned = game.field.enemies.filter((enemy) => enemy.round === 13);
    expect(spawned).toHaveLength(30);
    for (const enemy of spawned) {
      expect(enemy.maxHp).toBeCloseTo(
        enemyHp(13) * ENEMY_KINDS[enemy.kind].hpMult * crownEnemyHpMultiplier(1),
      );
      expect(enemy.speedMultiplier).toBe(crownSpeedMultiplier(1));
    }
    for (let index = 0; index < 10; index++) addUnit(game.field, HandRank.RoyalFlush, 3 + index, 2);
    for (let guard = 0; guard < 5000 && game.phase === 'combat'; guard++) game.tickCombat(1 / 30);
    expect(game.kills).toBe(30);
    expect(game.goldIncome.bounty).toBe(30 * killGold(13));
    expect(game.score - scoreBefore).toBe(scoreForKills(13, 30) + scoreForRoundClear(13));
  });

  test('ruleset·왕관과 무관하게 같은 seed+round 진형이다', () => {
    const standard = new Game(709);
    const crown = new Game(709, 'classic', 10);
    const life = new Game(709, 'life-economy', 3);
    for (const game of [standard, crown, life]) game.round = 27;
    expect(crown.nextWave()).toMatchObject({
      formation: standard.nextWave().formation,
      composition: standard.nextWave().composition,
    });
    expect(life.nextWave()).toMatchObject({
      formation: standard.nextWave().formation,
      composition: standard.nextWave().composition,
    });
  });

  test('tank/regen의 기존 침투 게이지 계약을 유지한다', () => {
    expect(enemyBreachPoints('normal')).toBe(1);
    expect(enemyBreachPoints('fast')).toBe(1);
    expect(enemyBreachPoints('tank')).toBe(2);
    expect(enemyBreachPoints('regen')).toBe(2);
  });

  test('carry-over가 있어도 current 진형 30기를 소진하고 R20 정비 경계로 한 번만 넘어간다', () => {
    const game = new Game(710);
    game.round = 19;
    const carry = spawnEnemy(game.field, 'normal', 18, { dist: 2 * 42, hpOverride: 1 });
    game.hand = h('AS AH KD QC 2S');
    game.confirmHand();
    game.discardPendingUnit();
    expect(game.startCombat()).toBe(true);
    game.tickCombat(30 * 0.45);
    expect(game.field.enemies.filter((enemy) => enemy.round === 19)).toHaveLength(30);
    expect(carry.alive).toBe(true);
    for (let index = 0; index < 10; index++) addUnit(game.field, HandRank.RoyalFlush, 3 + index, 2);
    for (let guard = 0; guard < 5000 && game.phase === 'combat'; guard++) game.tickCombat(1 / 30);
    expect(game.phase).toBe('prep');
    expect(game.round).toBe(20);
    expect(game.maintenancePending).toBe(true);
  });

  test('모든 진형은 KO/EN 이름과 한 줄 힌트를 가진다', () => {
    for (const copy of Object.values(FORMATION_COPY)) {
      expect(copy.ko).not.toBe('');
      expect(copy.en).not.toBe('');
      expect(copy.hintKo).not.toBe('');
      expect(copy.hintEn).not.toBe('');
    }
  });

  test('portrait 두 자리 라운드는 /60을 렌더링 폭 뒤에 배치한다', () => {
    const source = readFileSync(new URL('../src/game/SidePanel.ts', import.meta.url), 'utf8');
    expect(source).toContain('this.roundSub.setX(this.roundText.x + this.roundText.width + 4)');
  });
});
