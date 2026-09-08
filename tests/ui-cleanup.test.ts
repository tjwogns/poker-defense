import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/core/game';
import { HandRank } from '../src/core/cards/types';

vi.mock('phaser', () => ({ default: {} }));
import { SidePanel } from '../src/game/SidePanel';
import { HandBar } from '../src/game/HandBar';

// Rendering-free component checks: run the actual refresh methods against text/button sinks.
function view(): any {
  const state: any = { visible: true, text: '' };
  return new Proxy(state, { get(target, key) {
    if (key in target) return target[key];
    return (...args: any[]) => {
      if (key === 'setText') target.text = args[0];
      if (key === 'setVisible') target.visible = args[0];
      return state.proxy;
    };
  } });
}
function sink(): any {
  const result = view();
  result.proxy = result;
  return result;
}
function panel(game: Game, portrait: boolean): any {
  const result: any = Object.create(SidePanel.prototype);
  result.game = game;
  result.portrait = portrait;
  for (const key of ['settlementText', 'formationMasteryText', 'buildText', 'buildCount',
    'buildCard', 'buildTitle', 'roundText', 'roundSub', 'modeText', 'gaugeFg',
    'threatTitle', 'gaugeText', 'scoreText', 'goldText', 'directiveTitle', 'directiveBody',
    'interestText', 'upgradeSub', 'combatText']) result[key] = sink();
  for (const key of ['startBtn', 'upgradeBtn', 'speedBtn', 'deckBtn', 'guideBtn']) {
    result[key] = { container: sink(), setLabel: vi.fn(), setEnabled: vi.fn(), setFill: vi.fn() };
  }
  result.relicIconIds = '';
  result.inspectorObjects = [];
  result.lastThreatBand = 'safe';
  return result;
}

describe('quiet play UI', () => {
  test('both layouts remove wave forecasts and permanent reroll advice from rendering', () => {
    const panelSource = readFileSync(new URL('../src/game/SidePanel.ts', import.meta.url), 'utf8');
    for (const removed of ['NEXT WAVE', '보스까지', 'nextEnemyPreview', 'formationPreview', 'waveCount', 'waveHint']) {
      expect(panelSource).not.toContain(removed);
    }
    const hand = readFileSync(new URL('../src/game/HandBar.ts', import.meta.url), 'utf8');
    expect(hand).not.toContain('oddsText');
    expect(hand).not.toContain('rerollGuidance');
    expect(hand).toContain("tr('확률 보기', 'ODDS')");
    expect(hand).toContain('onOdds(this.cachedOdds)');
  });

  test.each([false, true])('current status is phase-specific, portrait=%s', (portrait) => {
    const game = new Game(250, 'life-economy');
    const ui = panel(game, portrait);
    for (const round of [1, 5, 13, 24, 60]) {
      game.round = round;
      game.phase = 'prep';
      ui.refreshCurrentStatus();
      expect(ui.settlementText.visible).toBe(false);
      expect(ui.formationMasteryText.visible).toBe(false);
      game.phase = 'combat';
      ui.refreshCurrentStatus();
      expect(ui.formationMasteryText.visible).toBe(game.nextWave().formation !== null);
    }
    game.lastRoundSettlement = { round: 24, incomeTotal: 50, spendTotal: 10 } as any;
    game.phase = 'prep';
    ui.refreshCurrentStatus();
    expect(ui.settlementText.text).toContain('+50G / −10G');
    expect(ui.settlementText.visible).toBe(true);
    expect(ui.formationMasteryText.visible).toBe(false);
    game.phase = 'combat';
    ui.refreshCurrentStatus();
    expect(ui.settlementText.visible).toBe(false);
  });

  test.each([false, true])('life HUD keeps current life, not cumulative escapes, portrait=%s', (portrait) => {
    const game = new Game(250, 'life-economy');
    game.escapedEnemies = 3;
    const ui = panel(game, portrait);
    ui.refresh(null, 1, false, true, 'normal');
    expect(ui.gaugeText.text).toContain('♥ 20');
    expect(ui.gaugeText.text).not.toMatch(/탈출|ESCAPED/);
    if (!portrait) {
      expect(ui.buildCard.visible).toBe(false);
      expect(ui.buildTitle.visible).toBe(false);
      expect(ui.buildText.visible).toBe(false);
      game.handMastery[HandRank.Pair] = 1;
      ui.refresh(null, 1, false, true, 'normal');
      expect(ui.buildCard.visible).toBe(true);
      expect(ui.buildText.visible).toBe(true);
    }
  });

  test('odds button retains hold-sensitive probabilities and hides when unavailable', () => {
    const game = new Game(1);
    const hand: any = Object.create(HandBar.prototype);
    hand.game = game;
    hand.oddsBtn = { container: sink() };
    hand.refreshOdds(true);
    const before = hand.cachedOdds;
    game.holds[0] = true;
    hand.refreshOdds(true);
    expect(hand.oddsBtn.container.visible).toBe(true);
    expect(hand.cachedOdds).not.toBe(before);
    hand.refreshOdds(false);
    expect(hand.oddsBtn.container.visible).toBe(false);
  });

  test.each([false, true])('upgrade button shares core eligibility in combat including pause, portrait=%s', (portrait) => {
    const game = new Game(250, 'life-economy');
    const ui = panel(game, portrait);
    game.gold = 1000;
    game.phase = 'combat';
    for (const paused of [false, true]) {
      ui.refresh(null, 1, paused, true, 'normal');
      expect(ui.upgradeBtn.setEnabled).toHaveBeenLastCalledWith(true);
    }
    game.gold = 0;
    ui.refresh(null, 1, true, true, 'normal');
    expect(ui.upgradeBtn.setEnabled).toHaveBeenLastCalledWith(false);
    game.gold = 1000;
    const maintenance = vi.spyOn(game, 'maintenancePending', 'get').mockReturnValue(true);
    ui.refresh(null, 1, false, true, 'normal');
    expect(ui.upgradeBtn.setEnabled).toHaveBeenLastCalledWith(false);
    maintenance.mockRestore();
    game.phase = 'defeat';
    ui.refresh(null, 1, false, true, 'normal');
    expect(ui.upgradeBtn.setEnabled).toHaveBeenLastCalledWith(false);
  });
});
