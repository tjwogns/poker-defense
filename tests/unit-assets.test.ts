import { describe, expect, test } from 'vitest';
import { HandRank } from '../src/core/cards/types';
import {
  isPixelArtEnabled, PIXEL_UNIT_SPRITE_KEYS, PIXEL_UNIT_SPRITE_PATHS,
  pixelSpriteFacesLeft, unitAnimationFrameKey, unitSpriteKey,
} from '../src/game/unitArtStyle';

describe('픽셀아트 정식 모드', () => {
  test('픽셀아트를 기본으로 사용하고 art=classic에서만 이전 그래픽을 쓴다', () => {
    expect(isPixelArtEnabled('?art=pixel')).toBe(true);
    expect(isPixelArtEnabled('?art=classic')).toBe(false);
    expect(isPixelArtEnabled('')).toBe(true);
  });

  test('13개 족보 유닛 모두 픽셀 스프라이트를 사용한다', () => {
    expect(Object.keys(PIXEL_UNIT_SPRITE_KEYS)).toHaveLength(13);
    expect(Object.keys(PIXEL_UNIT_SPRITE_PATHS)).toHaveLength(29);
    for (const tier of Object.values(HandRank).filter((value): value is HandRank => typeof value === 'number')) {
      expect(unitSpriteKey(tier, '?art=pixel')).toContain('pixel');
    }
  });

  test('궁수와 성기사, 신성 드래곤은 준비·공격 자세가 서로 다른 프레임을 사용한다', () => {
    for (const tier of [HandRank.Pair, HandRank.FullHouse, HandRank.RoyalFlush]) {
      const idle = unitAnimationFrameKey(tier, 'idle', '?art=pixel');
      const windup = unitAnimationFrameKey(tier, 'windup', '?art=pixel');
      const attack = unitAnimationFrameKey(tier, 'attack', '?art=pixel');
      expect(new Set([idle, windup, attack]).size).toBe(3);
    }
    expect(unitAnimationFrameKey(HandRank.Trips, 'attack', '?art=pixel')).toContain('cast');
    expect(pixelSpriteFacesLeft(HandRank.RoyalFlush)).toBe(true);
    expect(pixelSpriteFacesLeft(HandRank.Pair)).toBe(false);
  });

  test('모든 픽셀 유닛이 대기와 다른 공격 프레임을 갖는다', () => {
    for (const tier of Object.values(HandRank).filter((value): value is HandRank => typeof value === 'number')) {
      expect(unitAnimationFrameKey(tier, 'attack', '?art=pixel'))
        .not.toBe(unitAnimationFrameKey(tier, 'idle', '?art=pixel'));
    }
  });
});
