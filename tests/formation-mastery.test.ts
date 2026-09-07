import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnEnemy } from '../src/core/combat';
import { SPAWN_INTERVAL } from '../src/core/balance';
import { EnemyKindId, waveSpawnOrder } from '../src/core/enemies';
import {
  createFormationMasteryState, FORMATION_MASTERY_COPY, resolveFormationRound,
} from '../src/core/formationMastery';
import { Game } from '../src/core/game';
import { pathLength } from '../src/core/map';
import { scoreForRoundClear } from '../src/core/scoring';
import { h } from './helpers';

function ready(game: Game, round: number): void {
  game.round = round;
  if (game.maintenancePending) game.leaveMaintenance();
  game.hand = h('AS AH KD QC 2S');
  game.confirmHand();
  game.discardPendingUnit();
  expect(game.startCombat()).toBe(true);
}

function finishCurrentRound(game: Game): void {
  (game as unknown as { spawnQueue: EnemyKindId[] }).spawnQueue = [];
  for (const enemy of game.field.enemies) {
    if (enemy.round === game.round) enemy.alive = false;
  }
  game.tickCombat(0);
}

describe('formation mastery pure state', () => {
  test('진형 perfect는 streak에 따라 +100, +200을 주고 최고/횟수/원장을 갱신한다', () => {
    const first = resolveFormationRound(createFormationMasteryState(), true, true, 0);
    expect(first.result).toEqual({ perfect: true, streak: 1, scoreBonus: 100 });
    expect(first.state).toEqual({ streak: 1, bestStreak: 1, perfectCount: 1, score: 100 });
    const second = resolveFormationRound(first.state, true, true, 0);
    expect(second.result).toEqual({ perfect: true, streak: 2, scoreBonus: 200 });
    expect(second.state).toEqual({ streak: 2, bestStreak: 2, perfectCount: 2, score: 300 });
  });

  test('현재 라운드 침투나 미클리어 진형은 streak를 끊고 점수를 주지 않는다', () => {
    const state = { streak: 3, bestStreak: 4, perfectCount: 7, score: 1200 };
    expect(resolveFormationRound(state, true, true, 1)).toEqual({
      state: { ...state, streak: 0 }, result: { perfect: false, streak: 0, scoreBonus: 0 },
    });
    expect(resolveFormationRound(state, true, false, 0).state.streak).toBe(0);
  });

  test('비진형은 성공·실패 어느 쪽도 아니며 상태에 완전 중립이다', () => {
    const state = { streak: 2, bestStreak: 3, perfectCount: 5, score: 700 };
    expect(resolveFormationRound(state, false, false, 99)).toEqual({ state, result: null });
  });
});

describe('formation mastery Game integration', () => {
  test('prep preview는 원본 큐, combat preview는 실제 spawnQueue 소모 순서다', () => {
    const game = new Game(2801);
    game.round = 24;
    const order = waveSpawnOrder(game.seed, game.round);
    expect(game.nextEnemyPreview(8)).toEqual(order.slice(0, 8));
    ready(game, 24);
    expect(game.startCombat()).toBe(false);
    expect(game.nextEnemyPreview(8)).toEqual(order.slice(0, 8));
    game.tickCombat(0);
    expect(game.nextEnemyPreview(8)).toEqual(order.slice(1, 9));
  });

  test('큰 dt에서도 실제 생성 수와 남은 preview가 원본 30기 큐를 정확히 분할한다', () => {
    const game = new Game(2802);
    ready(game, 27);
    const order = waveSpawnOrder(game.seed, 27);
    game.tickCombat(SPAWN_INTERVAL * 11.4);
    const spawned = game.field.enemies.filter((enemy) => enemy.round === 27);
    const remaining = game.nextEnemyPreview(30);
    expect(spawned.map((enemy) => enemy.kind)).toEqual(order.slice(0, spawned.length));
    expect(remaining).toEqual(order.slice(spawned.length));
    expect(spawned.length + remaining.length).toBe(30);
  });

  test('연속 진형 perfect는 round clear와 별도 점수를 정확히 한 번 지급한다', () => {
    const game = new Game(2803);
    ready(game, 13);
    const beforeFirst = game.score;
    finishCurrentRound(game);
    expect(game.score - beforeFirst).toBe(scoreForRoundClear(13) + 100);
    expect(game.lastRoundSettlement?.formation).toEqual({ perfect: true, streak: 1, scoreBonus: 100 });
    expect(game.formationMastery).toEqual({ streak: 1, bestStreak: 1, perfectCount: 1, score: 100 });
    expect(game.goldIncome).not.toHaveProperty('formation');
    const afterFirst = game.score;
    expect(game.tickCombat(0)).toBeNull();
    expect(game.score).toBe(afterFirst);

    ready(game, 14);
    const beforeSecond = game.score;
    finishCurrentRound(game);
    expect(game.score - beforeSecond).toBe(scoreForRoundClear(14) + 200);
    expect(game.formationMastery).toEqual({ streak: 2, bestStreak: 2, perfectCount: 2, score: 300 });
  });

  test('현재 formation 출신 침투는 실패, carry-over 침투는 판정에서 격리한다', () => {
    const failed = new Game(2804, 'life-economy');
    failed.formationMastery = { streak: 2, bestStreak: 2, perfectCount: 2, score: 300 };
    ready(failed, 13);
    spawnEnemy(failed.field, 'normal', 13, { dist: pathLength(failed.mapId) + 1 });
    failed.tickCombat(0);
    expect(failed.currentFormationEscaped).toBe(true);
    finishCurrentRound(failed);
    expect(failed.lastRoundSettlement?.formation).toEqual({ perfect: false, streak: 0, scoreBonus: 0 });
    expect(failed.formationMastery.streak).toBe(0);

    const isolated = new Game(2805, 'life-economy');
    isolated.formationMastery = { streak: 2, bestStreak: 2, perfectCount: 2, score: 300 };
    ready(isolated, 13);
    spawnEnemy(isolated.field, 'normal', 12, { dist: pathLength(isolated.mapId) + 1 });
    isolated.tickCombat(0);
    expect(isolated.currentFormationEscaped).toBe(false);
    finishCurrentRound(isolated);
    expect(isolated.lastRoundSettlement?.formation).toEqual({ perfect: true, streak: 3, scoreBonus: 300 });
  });

  test('현재 formation의 치명적 침투는 endRound 없이 defeat여도 streak를 즉시 끊는다', () => {
    const game = new Game(2808, 'life-economy');
    game.formationMastery = { streak: 3, bestStreak: 3, perfectCount: 3, score: 600 };
    game.lives = 1;
    ready(game, 13);
    spawnEnemy(game.field, 'normal', 13, { dist: pathLength(game.mapId) + 1 });
    game.tickCombat(0);
    expect(game.phase).toBe('defeat');
    expect(game.currentFormationEscaped).toBe(true);
    expect(game.formationMastery).toEqual({ streak: 0, bestStreak: 3, perfectCount: 3, score: 600 });
  });

  test('비진형·보스·학습 라운드는 streak와 formation score에 중립이다', () => {
    for (const round of [11, 12, 20, 21]) {
      const game = new Game(2806);
      game.formationMastery = { streak: 2, bestStreak: 3, perfectCount: 4, score: 600 };
      ready(game, round);
      finishCurrentRound(game);
      expect(game.formationMastery).toEqual({ streak: 2, bestStreak: 3, perfectCount: 4, score: 600 });
      expect(game.lastRoundSettlement?.formation).toBeNull();
    }
  });

  test('R19→20→21→22에서 보스·학습은 streak를 보존하고 다음 진형만 증가시킨다', () => {
    const game = new Game(2809);
    for (const round of [19, 20, 21, 22]) {
      ready(game, round);
      const before = game.formationMastery.score;
      finishCurrentRound(game);
      if (round === 19) {
        expect(game.formationMastery).toMatchObject({ streak: 1, perfectCount: 1, score: 100 });
      } else if (round === 20 || round === 21) {
        expect(game.formationMastery.score).toBe(before);
        expect(game.formationMastery.streak).toBe(1);
      } else {
        expect(game.formationMastery).toMatchObject({ streak: 2, perfectCount: 2, score: 300 });
      }
    }
  });

  test('preview 조회는 카드 RNG와 다음 hand를 소비하지 않는다', () => {
    const previewed = new Game(2810);
    const untouched = new Game(2810);
    previewed.round = untouched.round = 24;
    for (let index = 0; index < 20; index++) previewed.nextEnemyPreview(index % 9);
    for (const game of [previewed, untouched]) {
      game.hand = h('AS AH KD QC 2S');
      game.confirmHand();
      game.discardPendingUnit();
      game.startCombat();
      finishCurrentRound(game);
    }
    expect(previewed.hand).toEqual(untouched.hand);
  });

  test('왕관은 preview/판정을 바꾸지 않고 새 run은 mastery를 초기화한다', () => {
    const standard = new Game(2807);
    const crown = new Game(2807, 'classic', 10);
    standard.round = crown.round = 24;
    expect(crown.nextEnemyPreview(30)).toEqual(standard.nextEnemyPreview(30));
    expect(new Game(2807).formationMastery).toEqual(createFormationMasteryState());
  });

  test('KO/EN HUD 핵심 문구가 모두 정의돼 있다', () => {
    for (const copy of Object.values(FORMATION_MASTERY_COPY)) {
      expect(copy.ko).not.toBe('');
      expect(copy.en).not.toBe('');
    }
  });

  test('HUD는 desktop 8기/portrait 5기 preview와 실제 역할 색을 사용한다', () => {
    const panel = readFileSync(new URL('../src/game/SidePanel.ts', import.meta.url), 'utf8');
    expect(panel).toContain('this.game.nextEnemyPreview(compact ? 5 : 8)');
    expect(panel).toContain('ENEMY_KINDS[kind].color');
    expect(panel).toContain('this.game.currentFormationEscaped');
    const play = readFileSync(new URL('../src/game/PlayScene.ts', import.meta.url), 'utf8');
    expect(play).toContain('PERFECT DEFENSE · STREAK ×${formation.streak} · +${formation.scoreBonus}');
    expect(play).toContain('PERFECT FORMATIONS ${mastery.perfectCount} · BEST ×${mastery.bestStreak}\\nFORMATION BONUS');
  });
});
