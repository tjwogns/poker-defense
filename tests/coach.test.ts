import { describe, expect, test } from 'vitest';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';
import { firstRunCoachHint } from '../src/game/coach';

describe('첫 3라운드 인터랙티브 안내', () => {
  test('홀드 여부와 배치 대기에 맞춰 첫 라운드 문구를 바꾼다', () => {
    const game = new Game(1);
    expect(firstRunCoachHint(game)?.title).toBe('카드 선택');
    game.holds[0] = true;
    expect(firstRunCoachHint(game)?.title).toBe('HOLD 완료');
    game.handConfirmed = true;
    game.pendingUnits.push(HandRank.HighCard);
    expect(firstRunCoachHint(game)?.title).toBe('첫 유닛 배치');
  });

  test('3라운드가 지나면 안내를 끝낸다', () => {
    const game = new Game(2);
    game.round = 4;
    expect(firstRunCoachHint(game)).toBeNull();
  });
});
