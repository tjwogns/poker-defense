import { describe, expect, test } from 'vitest';
import { isLifeLabLocation } from '../src/game/experiment';

describe('LIFE LAB route', () => {
  test('별도 /lab/ 주소에서만 공개 실험 모드를 활성화한다', () => {
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/lab/', search: '' })).toBe(true);
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/', search: '' })).toBe(false);
    expect(isLifeLabLocation({ hostname: 'tjwogns.github.io', pathname: '/poker-defense/', search: '?experiment=life' })).toBe(false);
  });

  test('localhost에서는 개발 편의를 위해 쿼리 주소도 허용한다', () => {
    expect(isLifeLabLocation({ hostname: '127.0.0.1', pathname: '/', search: '?experiment=life' })).toBe(true);
    expect(isLifeLabLocation({ hostname: 'localhost', pathname: '/', search: '' })).toBe(false);
  });
});
