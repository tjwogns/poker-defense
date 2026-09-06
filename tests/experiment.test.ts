import { describe, expect, test } from 'vitest';
import { isLifeLabLocation } from '../src/game/experiment';

describe('LIFE 정식 route', () => {
  test('루트와 기존 /lab/ 주소에서 LIFE 규칙을 기본 활성화한다', () => {
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/lab/', search: '' })).toBe(true);
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/', search: '' })).toBe(true);
  });

  test('classic 보존 주소와 쿼리에서만 이전 규칙을 활성화한다', () => {
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/classic/', search: '' })).toBe(false);
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/', search: '?ruleset=classic' })).toBe(false);
    expect(isLifeLabLocation({ hostname: 'localhost', pathname: '/', search: '?ruleset=classic' })).toBe(false);
    expect(isLifeLabLocation({ hostname: 'localhost', pathname: '/', search: '' })).toBe(true);
  });
});
