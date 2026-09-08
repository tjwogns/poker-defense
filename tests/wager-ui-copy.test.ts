import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('royal wager UI regression', () => {
  const playScene = readFileSync(new URL('../src/game/PlayScene.ts', import.meta.url), 'utf8');
  const sidePanel = readFileSync(new URL('../src/game/SidePanel.ts', import.meta.url), 'utf8');

  test('R10 이전 종료는 달성 대기와 미완료를 구분한다', () => {
    expect(playScene).toContain('REWARD AT R10');
    expect(playScene).toContain('ROYAL WAGER UNFINISHED');
  });

  test('정산 알림은 정비소 위에서 보상 종류·수량을 표시한다', () => {
    expect(playScene).toContain('ROYAL WAGER CLEARED');
    expect(playScene).toContain('SEAL ×${definition.reward.amount} AWARDED');
    expect(playScene).toMatch(/ROYAL WAGER FAILED[\s\S]*?\n\s+60,\n\s+\{/);
  });

  test('짧은 결산은 총수입을 표시하고 내기 상태와 보상 알림은 유지한다', () => {
    expect(sidePanel).toContain('settlement.incomeTotal');
    expect(sidePanel).toContain('setWagerStatus');
    expect(playScene).toContain('ROYAL WAGER CLEARED');
  });
});
