import { describe, expect, test } from 'vitest';
import { BATTLEFIELD_MAP_IDS, GRID_H, GRID_W, TILE, isInCrossroadIntersection, isPathTile, isPlaceable, pathContact, pathCorners, pathLength, pointAt, recommendedPlacementTiles, tileCanReachPath, tileCenter } from '../src/core/map';
import { Game } from '../src/core/game';
import { UNIT_DEFS } from '../src/core/units';
import { spawnEnemy } from '../src/core/combat';
import { BATTLEFIELD_DEFAULT_SEED, battlefieldExperiment, battlefieldRunLabel, createBattlefieldSandbox } from '../src/game/experiment';
import { defaultProfile, discoverHiddenHand, loadProfile, PROFILE_KEY, recordRun, saveProfile } from '../src/meta/profile';
import { Analytics, ANALYTICS_KEY } from '../src/meta/analytics';
import { HandRank } from '../src/core/cards/types';
import { relicUnitDamageResult } from '../src/core/relics';

describe('battlefield core integration', () => {
  test('experimental boards share aligned outer bounds and have no length-padding tails', () => {
    for (const mapId of BATTLEFIELD_MAP_IDS.slice(1)) {
      const path = pathCorners(mapId);
      expect([Math.min(...path.map(p => p.x)), Math.max(...path.map(p => p.x)), Math.min(...path.map(p => p.y)), Math.max(...path.map(p => p.y))]).toEqual([2, 14, 1, 9]);
    }
    const corridor = pathCorners('parallel-corridors');
    expect(corridor).toHaveLength(10);
    expect(corridor.filter((_, i) => i % 2 === 0).map(p => p.y)).toEqual([1, 3, 5, 7, 9]);
    expect(new Set(corridor.map(p => p.x))).toEqual(new Set([2, 14]));
    expect(corridor.at(-1)).toEqual({ x: 14, y: 9 });
    const gardens = pathCorners('twin-gardens');
    expect(gardens.slice(6)).toEqual(gardens.slice(0, 6).map(p => ({ x: 16 - p.x, y: p.y })));
    for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) {
      expect(isPathTile(x, y, 'twin-gardens')).toBe(isPathTile(16 - x, y, 'twin-gardens'));
      expect(isPlaceable(x, y, 'twin-gardens')).toBe(isPlaceable(16 - x, y, 'twin-gardens'));
    }
    const spiral = pathCorners('inward-spiral');
    expect(spiral.map(p => p.x % 2)).toEqual(Array(spiral.length).fill(0));
    expect(spiral.map(p => p.y % 2)).toEqual(Array(spiral.length).fill(1));
    expect(spiral.at(-1)).toEqual({ x: 10, y: 5 });
  });
  test.each(BATTLEFIELD_MAP_IDS)('%s is an orthogonal LIFE path with identical center mark', (mapId) => {
    const corners = pathCorners(mapId);
    expect(pathLength(mapId)).toBe(({ 'cross-road': 80, 'parallel-corridors': 68, 'twin-gardens': 52, 'inward-spiral': 68 })[mapId] * TILE);
    for (const [i, p] of corners.entries()) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThan(GRID_W);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThan(GRID_H);
      if (i) expect(Number(p.x === corners[i - 1].x) + Number(p.y === corners[i - 1].y)).toBe(1);
    }
    expect(pointAt(-100, mapId)).toEqual(tileCenter(corners[0].x, corners[0].y));
    const end = corners[corners.length - 1];
    expect(pointAt(1e8, mapId)).toEqual(tileCenter(end.x, end.y));
    expect(isPathTile(8, 5, mapId)).toBe(true);
    const atCenter = Array.from({ length: pathLength(mapId) / TILE + 1 }, (_, i) => i * TILE).find((d) => {
      const p = pointAt(d, mapId); const c = tileCenter(8, 5); return p.x === c.x && p.y === c.y;
    })!;
    expect(isInCrossroadIntersection(atCenter, mapId)).toBe(true);
    const g = new Game(12345, 'life-economy', 0, mapId);
    expect(g.field.mapId).toBe(mapId);
    g.confirmHand();
    const tier = g.pendingUnits[0];
    const candidates = recommendedPlacementTiles(UNIT_DEFS[tier].range, [], 3, mapId);
    expect(candidates).toHaveLength(3);
    expect(g.placeUnit(candidates[0].x, candidates[0].y)).toBe(true);
    expect(g.field.units[0]).toMatchObject({ tx: candidates[0].x, ty: candidates[0].y });
    const target = spawnEnemy(g.field, 'normal', 10, { dist: atCenter });
    expect(relicUnitDamageResult(['crossroad_mark'], g.field.units[0], target, g.field)).toEqual({ multiplier: 1.25, active: ['crossroad_mark'] });
    expect(recommendedPlacementTiles(3, candidates, 3, mapId)).not.toContainEqual(candidates[0]);
    expect(recommendedPlacementTiles(3, [], 0, mapId)).toEqual([]);
    for (const p of candidates) expect(isPlaceable(p.x, p.y, mapId)).toBe(true);
  });

  test.each(BATTLEFIELD_MAP_IDS)('%s ordinary escape costs one life and boss escape defeats', (mapId) => {
    for (const boss of [false, true]) {
      const g = new Game(1, 'life-economy', 0, mapId);
      g.confirmHand(); g.pendingUnits = []; g.startCombat();
      const enemy = spawnEnemy(g.field, boss ? 'boss' : 'normal', 1000);
      enemy.dist = pathLength(mapId) - 1;
      const lives = g.lives;
      g.tickCombat(1 / 30);
      if (boss) expect(g.defeatReason).toBe('boss-escaped');
      else expect(g.lives).toBe(lives - 1);
    }
  });

  test.each(BATTLEFIELD_MAP_IDS.slice(1))('%s recommends early actual contact for short and long ranges', (mapId) => {
    for (const range of [1.5, 3, 6]) {
      const [p] = recommendedPlacementTiles(range, [], 1, mapId);
      expect(tileCanReachPath(p.x, p.y, range, mapId)).toBe(true);
      expect(pathContact(p.x, p.y, range, mapId).firstContact).toBeLessThan(2);
    }
  });

  test('default and invalid/classic override preserve original map and deal/economy', () => {
    for (const seed of [1, 12345, 20260909, 0xffffffff]) {
      const normal = new Game(seed, 'life-economy');
      for (const mapId of BATTLEFIELD_MAP_IDS) {
        const lab = new Game(seed, 'life-economy', 0, mapId);
        expect([lab.hand, lab.gold, lab.lives, lab.nextWave()]).toEqual([normal.hand, normal.gold, normal.lives, normal.nextWave()]);
      }
      expect(normal.mapId).toBe('cross-road');
      expect(new Game(seed, 'classic', 0, 'inward-spiral').mapId).toBe('classic-ring');
      expect(new Game(seed, 'life-economy', 0, 'invalid' as never).mapId).toBe('cross-road');
    }
  });
});

test('experiment query is explicit, validates map/uint32 seed and excludes daily/classic', () => {
  expect(battlefieldRunLabel('parallel-corridors', false)).toBe('실험 · 평행 회랑');
  expect(battlefieldRunLabel('inward-spiral', true)).toBe('LAB · SPIRAL');
  expect(battlefieldExperiment('')).toBeNull();
  expect(battlefieldExperiment('?map=inward-spiral')).toBeNull();
  for (const suffix of ['&daily=2026-09-09', '&ruleset=classic']) expect(battlefieldExperiment(`?experiment=battlefields${suffix}`)).toBeNull();
  expect(battlefieldExperiment('?experiment=battlefields', '/classic/')).toBeNull();
  for (const seed of ['-1', 'Infinity', '4294967296', '1.5', 'abc']) {
    expect(battlefieldExperiment(`?experiment=battlefields&map=invalid&seed=${seed}`)).toEqual({ mapId: 'cross-road', seed: BATTLEFIELD_DEFAULT_SEED });
  }
  expect(battlefieldExperiment('?experiment=battlefields&map=twin-gardens&seed=0')).toEqual({ mapId: 'cross-road', seed: 0 });
  expect(battlefieldExperiment('?experiment=battlefields&map=inward-spiral&seed=0')).toEqual({ mapId: 'inward-spiral', seed: 0 });
});

test('actual profile discovery/tutorial/sound/run writes and analytics remain in memory only', () => {
  const values = new Map<string, string>();
  const real = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
  saveProfile(real, defaultProfile());
  const singleton = new Analytics(real); singleton.setConsent('granted');
  const before = [...values.entries()];
  const { storage, analytics } = createBattlefieldSandbox(real);
  let profile = discoverHiddenHand(loadProfile(storage), HandRank.FiveKind).profile;
  profile.tutorialDone = true; profile.soundEnabled = !profile.soundEnabled;
  profile = recordRun(profile, new Game(1, 'life-economy', 0, 'inward-spiral').summary(), 'standard', '2026-09-09');
  saveProfile(storage, profile);
  analytics.beginRun({ mode: 'standard' }); analytics.track('run_finished');
  expect([...values.entries()]).toEqual(before);
  expect(storage.getItem(PROFILE_KEY)).not.toEqual(real.getItem(PROFILE_KEY));
  expect(analytics.consent).toBe('denied'); expect(analytics.remoteEnabled).toBe(false);
  expect(JSON.parse(storage.getItem(ANALYTICS_KEY)!).events).toEqual([]);
  expect(singleton.consent).toBe('granted');
});
