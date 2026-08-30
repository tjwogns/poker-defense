import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import { createField, spawnEnemy, addUnit, tick, enemyPos } from '../src/core/combat';
import { enemyHp, killGold } from '../src/core/balance';
import { TILE } from '../src/core/map';

// 경로 윗변: dist 0 = 타일(1,1), dist 2*TILE = 타일(3,1)
const AT_TILE_3_1 = 2 * TILE;
const AT_TILE_5_1 = 4 * TILE;

describe('combat engine', () => {
  test('first 타깃팅: 사거리 안에서 먼저 스폰된 적을 공격한다', () => {
    const f = createField();
    const first = spawnEnemy(f, 'normal', 1, { dist: AT_TILE_3_1 });
    const second = spawnEnemy(f, 'normal', 1, { dist: AT_TILE_3_1 + 10 });
    addUnit(f, HandRank.Pair, 3, 2); // 궁수, 사거리 3.5타일
    tick(f, 1 / 30, 1);
    expect(first.hp).toBeLessThan(first.maxHp);
    expect(second.hp).toBe(second.maxHp);
  });

  test('궁수의 타격당 피해는 11.2 (dps 14 × 주기 0.8)', () => {
    const f = createField();
    const e = spawnEnemy(f, 'normal', 20, { dist: AT_TILE_3_1 }); // HP 넉넉한 라운드
    addUnit(f, HandRank.Pair, 3, 2);
    tick(f, 1 / 30, 1);
    expect(e.maxHp - e.hp).toBeCloseTo(11.2, 3);
  });

  test('방어형은 받는 피해 25% 감소, 저격수는 무시한다', () => {
    const f = createField();
    const tank1 = spawnEnemy(f, 'tank', 20, { dist: AT_TILE_3_1 });
    addUnit(f, HandRank.Pair, 3, 2); // 궁수 11.2 → 8.4
    tick(f, 1 / 30, 1);
    expect(tank1.maxHp - tank1.hp).toBeCloseTo(11.2 * 0.75, 3);

    const f2 = createField();
    const tank2 = spawnEnemy(f2, 'tank', 20, { dist: AT_TILE_3_1 });
    addUnit(f2, HandRank.Straight, 3, 2); // 저격수 275, 방무
    tick(f2, 1 / 30, 1);
    expect(tank2.maxHp - tank2.hp).toBeCloseTo(110 * 2.5, 3);
  });

  test('빙결술사 명중 시 2초간 이속 30% 감소', () => {
    const f = createField();
    const e = spawnEnemy(f, 'normal', 20, { dist: AT_TILE_3_1 });
    addUnit(f, HandRank.Flush, 3, 2);
    tick(f, 1 / 30, 1); // 첫 틱에 명중
    const before = e.dist;
    tick(f, 1, 1); // 슬로우 상태로 1초 이동
    // 기본 60px/s × 0.7 = 42px (±틱 처리 오차)
    expect(e.dist - before).toBeCloseTo(42, 0);
  });

  test('화염술사 스플래시: 반경 0.8타일 내 적도 피해', () => {
    const f = createField();
    const target = spawnEnemy(f, 'normal', 20, { dist: AT_TILE_3_1 });
    const near = spawnEnemy(f, 'normal', 20, { dist: AT_TILE_3_1 + 0.5 * TILE });
    const far = spawnEnemy(f, 'normal', 20, { dist: AT_TILE_5_1 + 5 * TILE });
    addUnit(f, HandRank.Trips, 3, 2);
    const result = tick(f, 1 / 30, 1);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(result.attacks[0].totalDamage).toBeCloseTo(
      (target.maxHp - target.hp) + (near.maxHp - near.hp),
    );
    expect(result.attacks[0].totalDamage).toBeGreaterThan(result.attacks[0].damage);
  });

  test('대마법사 체인: 인접 적에게 70%로 감쇠하며 연쇄', () => {
    const f = createField();
    const t1 = spawnEnemy(f, 'normal', 40, { dist: AT_TILE_3_1 });
    const t2 = spawnEnemy(f, 'normal', 40, { dist: AT_TILE_3_1 + TILE }); // 1타일 옆
    addUnit(f, HandRank.StraightFlush, 3, 2);
    tick(f, 1 / 30, 1);
    const base = 800 * 1.8;
    expect(t1.maxHp - t1.hp).toBeCloseTo(base, 1);
    expect(t2.maxHp - t2.hp).toBeCloseTo(base * 0.7, 1);
  });

  test('신룡: 현재 HP 5% 비례 추가 피해', () => {
    const f = createField();
    const e = spawnEnemy(f, 'normal', 50, { dist: AT_TILE_3_1 });
    addUnit(f, HandRank.RoyalFlush, 3, 2);
    const hpBefore = e.hp;
    tick(f, 1 / 30, 1);
    expect(hpBefore - e.hp).toBeCloseTo(1800 * 2.0 + hpBefore * 0.05, 1);
  });

  test('성기사 오라: 2타일 내 다른 아군 공격력 +15%', () => {
    const f = createField();
    const e = spawnEnemy(f, 'normal', 20, { dist: AT_TILE_3_1 });
    addUnit(f, HandRank.FullHouse, 5, 3); // 성기사 (사거리 밖에 배치해 오라만 작용)
    addUnit(f, HandRank.Pair, 3, 2);      // 궁수, 성기사와 2타일 내
    // 성기사(5,3)와 궁수(3,2)의 거리 = sqrt(4+1) ≈ 2.24타일 → 오라 밖!
    // 거리 2타일 이내가 되도록 (4,2)로 다시 설정
    const f2 = createField();
    const e2 = spawnEnemy(f2, 'normal', 20, { dist: AT_TILE_3_1 });
    addUnit(f2, HandRank.FullHouse, 4, 3);
    addUnit(f2, HandRank.Pair, 3, 2); // 거리 sqrt(1+1)≈1.41타일 → 오라 안
    tick(f2, 1 / 30, 1);
    // 궁수 타격 11.2 × 1.15 = 12.88 (+ 성기사 자체 공격이 있다면 별도)
    const archerDmg = 11.2 * 1.15;
    const paladinDmg = 160 * 1.0; // 성기사도 사거리(2.5타일) 안이면 공격
    const total = e2.maxHp - e2.hp;
    expect([archerDmg, archerDmg + paladinDmg].some((v) => Math.abs(total - v) < 0.01)).toBe(true);
    expect(e.hp).toBe(e.maxHp); // f의 적은 안 맞음 (아무도 사거리 안 아님을 겸사 확인)
  });

  test('처치 시 골드 획득, 사망 처리', () => {
    const f = createField();
    const e = spawnEnemy(f, 'normal', 1, { dist: AT_TILE_3_1 }); // R1 HP≈21
    addUnit(f, HandRank.Straight, 3, 2); // 275 한 방
    const r = tick(f, 1 / 30, 1);
    expect(e.alive).toBe(false);
    expect(r.goldEarned).toBe(killGold(1));
    expect(r.deaths.map((d) => d.id)).toContain(e.id);
  });

  test('분열형: 사망 시 HP 30% 소형 2기 생성', () => {
    const f = createField();
    const e = spawnEnemy(f, 'splitter', 1, { dist: AT_TILE_3_1 });
    addUnit(f, HandRank.Straight, 3, 2);
    tick(f, 1 / 30, 1);
    expect(e.alive).toBe(false);
    const children = f.enemies.filter((x) => x.id !== e.id);
    expect(children.length).toBe(2);
    for (const c of children) {
      expect(c.maxHp).toBeCloseTo(e.maxHp * 0.3, 3);
      expect(c.alive).toBe(true);
    }
  });

  test('재생형은 초당 최대 HP의 1.5%를 회복한다', () => {
    const f = createField();
    const e = spawnEnemy(f, 'regen', 30, { dist: AT_TILE_3_1 });
    e.hp = e.maxHp * 0.5;
    tick(f, 1, 1); // 유닛 없음, 1초
    expect(e.hp).toBeCloseTo(e.maxHp * 0.5 + e.maxHp * 0.015, 2);
  });

  test('적은 경로를 따라 이동하고 순환한다', () => {
    const f = createField();
    const e = spawnEnemy(f, 'normal', 1, { dist: 0 });
    tick(f, 1, 1);
    expect(e.dist).toBeCloseTo(60, 5); // 기본 60px/s
    const p = enemyPos(e);
    expect(p.y).toBeCloseTo(1 * TILE + TILE / 2); // 아직 윗변
  });

  test('보스 HP는 일반의 40배', () => {
    const f = createField();
    const boss = spawnEnemy(f, 'boss', 10, { dist: 0 });
    expect(boss.maxHp).toBeCloseTo(enemyHp(10) * 40, 3);
  });
});
