import Phaser from 'phaser';
import { Game } from '../core/game';
import { Unit, aliveEnemies } from '../core/combat';
import { UNIT_DEFS, UnitDef } from '../core/units';
import { HAND_NAMES_KO, SUIT_GLYPHS, HandRank } from '../core/cards/types';
import {
  FINAL_BOSS_MAX_TIME, LIFE_MODE_BREACH_THRESHOLD, LIFE_MODE_STARTING_LIVES,
  ROUNDS, SELL_REFUND, upgradeMultiplier,
} from '../core/balance';
import { RELIC_DEFS, RELIC_SLOT_CAP, RelicId } from '../core/relics';
import { RunMode } from '../meta/profile';
import { Button, FONT, FONT_DISPLAY, FONT_MONO, UI, makeButton, makeText } from './ui';
import { PANEL_SECTIONS, UiRect, portraitSceneHeight, portraitY } from './layout';
import { threatBand, threatLabel, threatTitle } from './threat';
import { createRelicIcon } from './relicAssets';
import { MASTERABLE_HANDS } from '../core/mastery';
import {
  HAND_VARIANT_LABELS, suitIdentityLabel, SUIT_TRAIT_LABELS, variantUnitName,
} from '../core/cards/handIdentity';
import { isPortraitLayout } from './device';

const SPEEDS = [1, 2, 4] as const;

export interface PanelCallbacks {
  onStart(): void;
  onSpeed(n: number): void;
  onUpgrade(): void;
  onSell(): void;
  onMove(): void;
  onFuse(): void;
  onPause(): void;
  onSound(): void;
  onHome(): void;
  onGuide(): void;
  onDeck(): void;
}

function traitLabel(def: UnitDef): string {
  const t = def.traits;
  if (t.splash) return `광역 ${t.splash}칸`;
  if (t.chain) return `체인 ${t.chain.count}기`;
  if (t.slow) return `감속 ${t.slow.pct * 100}%`;
  if (t.aura) return `공격 오라 +${t.aura.dmgPct * 100}%`;
  if (t.execute) return '체력 비례 피해';
  if (t.ignoreDefense) return '방어 무시';
  return '단일 공격';
}

function railCard(scene: Phaser.Scene, rect: UiRect, dashed = false): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(UI.panel, 0.98).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(1, dashed ? UI.goldNum : 0xf2ede3, dashed ? 0.4 : 0.09);
  if (!dashed) {
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    return g;
  }
  const segment = 8;
  for (let x = rect.x; x < rect.x + rect.width; x += segment * 2) {
    g.lineBetween(x, rect.y, Math.min(x + segment, rect.x + rect.width), rect.y);
    g.lineBetween(x, rect.y + rect.height, Math.min(x + segment, rect.x + rect.width), rect.y + rect.height);
  }
  for (let y = rect.y; y < rect.y + rect.height; y += segment * 2) {
    g.lineBetween(rect.x, y, rect.x, Math.min(y + segment, rect.y + rect.height));
    g.lineBetween(rect.x + rect.width, y, rect.x + rect.width, Math.min(y + segment, rect.y + rect.height));
  }
  return g;
}

const WAVE_HINTS = {
  normal: '표준 병력 · 균형 잡힌 기본 웨이브',
  fast: '이동이 빠름 · 입구와 코너 화력 집중',
  tank: '받는 피해 −25% · 이동 느림 · 광역이 유리',
  regen: '체력을 회복함 · 한 지점에 화력 집중',
  splitter: '처치 시 분열 · 광역과 연쇄 공격이 유리',
  boss: '강력한 우두머리 · 기믹과 제한시간 확인',
} as const;

export class SidePanel {
  private scene: Phaser.Scene;
  private game: Game;
  private roundText!: Phaser.GameObjects.Text;
  private roundSub!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private threatTitle!: Phaser.GameObjects.Text;
  private gaugeFg!: Phaser.GameObjects.Rectangle;
  private gaugeText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private waveName!: Phaser.GameObjects.Text;
  private waveCount!: Phaser.GameObjects.Text;
  private waveHint!: Phaser.GameObjects.Text;
  private settlementText!: Phaser.GameObjects.Text;
  private bossCountdown!: Phaser.GameObjects.Text;
  private directiveTitle!: Phaser.GameObjects.Text;
  private directiveBody!: Phaser.GameObjects.Text;
  private startBtn!: Button;
  private interestText!: Phaser.GameObjects.Text;
  private upgradeSub!: Phaser.GameObjects.Text;
  private upgradeBtn!: Button;
  private buildCount!: Phaser.GameObjects.Text;
  private buildText!: Phaser.GameObjects.Text;
  private deckBtn!: Button;
  private guideBtn!: Button;
  private speedBtn!: Button;
  private relicIcons: Phaser.GameObjects.Container[] = [];
  private relicIconIds = '';
  private relicTriggerText!: Phaser.GameObjects.Text;
  private combatText!: Phaser.GameObjects.Text;
  private lastThreatBand: 'safe' | 'warning' | 'critical' = 'safe';
  private inspectorObjects: Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible> = [];
  private inspectorName!: Phaser.GameObjects.Text;
  private inspectorMeta!: Phaser.GameObjects.Text;
  private inspectorStats!: Phaser.GameObjects.Text;
  private sellBtn!: Button;
  private moveBtn!: Button;
  private fuseBtn!: Button;
  private portrait = false;
  private placementBg?: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, game: Game, cb: PanelCallbacks) {
    this.scene = scene;
    this.game = game;
    this.portrait = isPortraitLayout();
    if (this.portrait) {
      this.createPortrait(scene, cb);
      return;
    }

    const top = scene.add.graphics();
    top.fillStyle(UI.panelDeep, 1).fillRect(0, 0, 1280, 60);
    top.lineStyle(1, UI.goldNum, 0.14).lineBetween(0, 59, 1280, 59);
    this.roundText = scene.add.text(24, 9, '', {
      fontFamily: FONT_DISPLAY, fontSize: '28px', fontStyle: 'bold', color: UI.text,
    });
    this.roundSub = scene.add.text(178, 24, '', {
      fontFamily: FONT_MONO, fontSize: '13px', color: UI.textFaint,
    });
    this.modeText = scene.add.text(224, 20, '', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.textDim,
      backgroundColor: '#17171f', padding: { x: 7, y: 3 }, letterSpacing: 1.4,
    });
    this.threatTitle = scene.add.text(400, 12, 'FIELD THREAT', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.textDim, letterSpacing: 2,
    });
    scene.add.rectangle(400, 40, 400, 10, UI.panelRaised, 1).setOrigin(0, 0.5);
    this.gaugeFg = scene.add.rectangle(400, 40, 0, 10, UI.safe, 1).setOrigin(0, 0.5);
    scene.add.rectangle(640, 49, 1, 4, UI.goldNum, 0.4);
    scene.add.rectangle(720, 49, 1, 4, UI.danger, 0.5);
    this.gaugeText = scene.add.text(800, 8, '', {
      fontFamily: FONT_MONO, fontSize: '15px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    this.scoreText = scene.add.text(1085, 21, '', {
      fontFamily: FONT_MONO, fontSize: '15px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    this.goldText = scene.add.text(1200, 17, '', {
      fontFamily: FONT_MONO, fontSize: '21px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);
    makeButton(scene, 1236, 30, 36, 36, '×', cb.onHome, {
      fill: UI.panelDeep, textColor: UI.textDim, fontSize: 16, radius: 18, strokeAlpha: 0.16,
    });

    railCard(scene, PANEL_SECTIONS.nextWave);
    railCard(scene, PANEL_SECTIONS.directive, true);
    railCard(scene, PANEL_SECTIONS.economy);
    railCard(scene, PANEL_SECTIONS.build);
    railCard(scene, PANEL_SECTIONS.utility);

    makeText(scene, 816, 84, 'NEXT WAVE', 10, UI.textDim, true).setLetterSpacing(2);
    this.bossCountdown = makeText(scene, 1238, 84, '', 10, UI.dangerText, true).setOrigin(1, 0);
    this.waveName = makeText(scene, 816, 108, '', 25, UI.text, true);
    this.waveCount = scene.add.text(930, 111, '', {
      fontFamily: FONT_MONO, fontSize: '19px', fontStyle: 'bold', color: UI.gold,
    });
    this.waveHint = makeText(scene, 816, 144, '', 12, UI.textDim).setWordWrapWidth(410, true);
    this.settlementText = makeText(scene, 816, 162, '', 10, UI.gold, true).setWordWrapWidth(420, true);

    scene.add.circle(832, 228, 18, UI.goldNum, 0.15).setStrokeStyle(1, UI.goldNum, 0.35);
    makeText(scene, 832, 228, '◆', 12, UI.gold, true).setOrigin(0.5);
    this.directiveTitle = makeText(scene, 862, 207, '', 15, UI.text, true);
    this.directiveBody = makeText(scene, 862, 230, '', 11, UI.textDim);
    this.startBtn = makeButton(scene, 1027, 228, 438, 60, '', cb.onStart, {
      fill: UI.panelRaised, textColor: UI.text, fontSize: 15, radius: 8, stroke: UI.goldNum, strokeAlpha: 0.2,
    });
    this.startBtn.container.setVisible(false);

    makeText(scene, 816, 292, 'GOLD SPEND', 10, UI.textDim, true).setLetterSpacing(2);
    this.interestText = makeText(scene, 1238, 292, '', 11, UI.textFaint).setOrigin(1, 0);
    scene.add.rectangle(1027, 320, 422, 1, 0xf2ede3, 0.07);
    makeText(scene, 816, 338, '전역 공격 강화', 14, UI.text, true);
    this.upgradeSub = makeText(scene, 816, 361, '', 11, UI.textDim);
    this.upgradeBtn = makeButton(scene, 1208, 354, 68, 40, '', cb.onUpgrade, {
      fill: UI.panelRaised, textColor: UI.gold, fontSize: 13, radius: 6, stroke: UI.goldNum, strokeAlpha: 0.5,
    });

    makeText(scene, 816, 424, 'BUILD', 10, UI.textDim, true).setLetterSpacing(2);
    this.buildCount = scene.add.text(1238, 424, '', {
      fontFamily: FONT_MONO, fontSize: '11px', color: UI.textFaint,
    }).setOrigin(1, 0);
    this.buildText = makeText(scene, 816, 508, '', 11, UI.textDim, true)
      .setWordWrapWidth(410, true).setLineSpacing(4);
    this.relicTriggerText = makeText(scene, 816, 540, '', 10, UI.gold, true).setAlpha(0).setDepth(7);

    this.deckBtn = makeButton(scene, 872, 595, 140, 48, '덱 · D', cb.onDeck, {
      fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 0, strokeAlpha: 0.14,
    });
    this.guideBtn = makeButton(scene, 1027, 595, 140, 48, '도감 · H', cb.onGuide, {
      fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 0, strokeAlpha: 0.14,
    });
    this.speedBtn = makeButton(scene, 1182, 595, 140, 48, '×1  ×2  ×4', () => {
      const current = SPEEDS.indexOf((this.speedBtn.container.getData('speed') ?? 1) as 1 | 2 | 4);
      cb.onSpeed(SPEEDS[(current + 1) % SPEEDS.length]);
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 12, radius: 0, strokeAlpha: 0.14 });
    this.combatText = makeText(scene, 816, 638, '', 11, UI.textDim).setWordWrapWidth(420, true);

    const inspectorBg = scene.add.rectangle(646, 382, 240, 172, UI.panelDeep, 0.98)
      .setStrokeStyle(1, UI.goldNum, 0.28).setDepth(10);
    this.inspectorName = makeText(scene, 542, 310, '', 16, UI.text, true).setDepth(11);
    this.inspectorMeta = makeText(scene, 542, 336, '', 11, UI.textDim).setDepth(11);
    this.inspectorStats = scene.add.text(542, 360, '', {
      fontFamily: FONT_MONO, fontSize: '12px', fontStyle: 'bold', color: UI.text, lineSpacing: 5,
    }).setDepth(11);
    this.moveBtn = makeButton(scene, 598, 430, 104, 36, '재배치', cb.onMove, {
      fill: UI.panelDeep, textColor: UI.text, fontSize: 11, radius: 0, strokeAlpha: 0.18,
    });
    this.sellBtn = makeButton(scene, 710, 430, 104, 36, '판매', cb.onSell, {
      fill: UI.panelDeep, textColor: UI.dangerText, fontSize: 11, radius: 0, stroke: UI.danger, strokeAlpha: 0.5,
    });
    this.fuseBtn = makeButton(scene, 654, 470, 216, 34, '동일 3기 합성', cb.onFuse, {
      fill: UI.panelRaised, textColor: '#cda8e6', fontSize: 11, radius: 0, stroke: 0x9f74cf, strokeAlpha: 0.42,
    });
    this.moveBtn.container.setDepth(11);
    this.sellBtn.container.setDepth(11);
    this.fuseBtn.container.setDepth(11);
    this.inspectorObjects = [
      inspectorBg, this.inspectorName, this.inspectorMeta, this.inspectorStats,
      this.moveBtn.container, this.sellBtn.container, this.fuseBtn.container,
    ] as Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible>;
    this.inspectorObjects.forEach((object) => object.setVisible(false));
  }

  private createPortrait(scene: Phaser.Scene, cb: PanelCallbacks): void {
    const portraitHeight = portraitSceneHeight(scene);
    const py = (value: number) => portraitY(portraitHeight, value);
    const top = scene.add.graphics();
    top.fillStyle(UI.panelDeep, 1).fillRect(0, 0, 390, 96);
    top.lineStyle(1, UI.goldNum, 0.16).lineBetween(0, 95, 390, 95);
    this.roundText = scene.add.text(16, 57, '', {
      fontFamily: FONT_DISPLAY, fontSize: '21px', fontStyle: 'bold', color: UI.text,
    });
    this.roundSub = scene.add.text(51, 65, '', {
      fontFamily: FONT_MONO, fontSize: '12px', color: UI.textFaint,
    });
    this.modeText = scene.add.text(0, 0, '').setVisible(false);
    this.threatTitle = scene.add.text(80, 55, 'THREAT', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#74727e', letterSpacing: 1.6,
    });
    scene.add.rectangle(80, 81, 180, 8, UI.panelRaised, 1).setOrigin(0, 0.5);
    this.gaugeFg = scene.add.rectangle(80, 81, 0, 8, UI.safe, 1).setOrigin(0, 0.5);
    this.gaugeText = scene.add.text(260, 55, '', {
      fontFamily: FONT_MONO, fontSize: '12px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    this.scoreText = scene.add.text(0, 0, '').setVisible(false);
    this.goldText = scene.add.text(374, 60, '', {
      fontFamily: FONT_MONO, fontSize: '19px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);

    railCard(scene, { x: 8, y: py(382), width: 374, height: 58 });
    makeText(scene, 22, py(391), '다음 웨이브', 12, UI.textDim);
    this.waveName = makeText(scene, 22, py(410), '', 18, UI.text, true);
    this.waveCount = scene.add.text(130, py(412), '', {
      fontFamily: FONT_MONO, fontSize: '16px', fontStyle: 'bold', color: UI.gold,
    });
    this.waveHint = makeText(scene, 368, py(414), '', 12, UI.textDim).setOrigin(1, 0);
    this.settlementText = makeText(scene, 368, py(391), '', 10, UI.gold, true).setOrigin(1, 0);
    this.bossCountdown = makeText(scene, 368, py(392), '', 12, UI.dangerText, true).setOrigin(1, 0);

    this.placementBg = scene.add.rectangle(195, py(702), 374, 56, UI.panelDeep, 0.98)
      .setStrokeStyle(1, UI.goldNum, 0.45).setDepth(4).setVisible(false);
    this.directiveTitle = makeText(scene, 195, py(684), '', 15, UI.text, true).setOrigin(0.5, 0).setDepth(5);
    this.directiveBody = makeText(scene, 195, py(709), '', 12, UI.textDim).setOrigin(0.5, 0).setDepth(5);
    this.startBtn = makeButton(scene, 195, py(702), 374, 56, '', () => {
      if (this.game.phase === 'combat') cb.onPause();
      else cb.onStart();
    }, { fill: UI.goldNum, textColor: UI.goldInk, fontSize: 17, radius: 8, stroke: UI.goldNum, strokeAlpha: 0.5 });

    this.interestText = scene.add.text(0, 0, '').setVisible(false);
    this.upgradeSub = scene.add.text(0, 0, '').setVisible(false);
    this.buildCount = scene.add.text(0, 0, '').setVisible(false);
    this.buildText = scene.add.text(0, 0, '').setVisible(false);
    this.combatText = scene.add.text(0, 0, '').setVisible(false);
    this.relicTriggerText = makeText(scene, 195, py(372), '', 12, UI.gold, true).setOrigin(0.5).setAlpha(0).setDepth(7);

    this.deckBtn = makeButton(scene, 53, py(769), 82, 50, '덱', cb.onDeck, {
      fill: UI.panelDeep, textColor: '#a8a5b2', fontSize: 13, radius: 4, strokeAlpha: 0.14,
    });
    this.guideBtn = makeButton(scene, 143, py(769), 82, 50, '도감', cb.onGuide, {
      fill: UI.panelDeep, textColor: '#a8a5b2', fontSize: 13, radius: 4, strokeAlpha: 0.14,
    });
    this.upgradeBtn = makeButton(scene, 248, py(769), 112, 50, '강화', cb.onUpgrade, {
      fill: UI.panelDeep, textColor: UI.gold, fontSize: 13, radius: 4, stroke: UI.goldNum, strokeAlpha: 0.4,
    });
    this.speedBtn = makeButton(scene, 345, py(769), 74, 50, '×1', () => {
      const current = SPEEDS.indexOf((this.speedBtn.container.getData('speed') ?? 1) as 1 | 2 | 4);
      cb.onSpeed(SPEEDS[(current + 1) % SPEEDS.length]);
    }, { fill: UI.panelDeep, textColor: '#a8a5b2', fontSize: 13, radius: 4, strokeAlpha: 0.14 });

    const sheetBg = scene.add.rectangle(195, py(744), 390, 200, UI.panelDeep, 0.99)
      .setStrokeStyle(1, UI.goldNum, 0.28).setDepth(12);
    const handle = scene.add.rectangle(195, py(652), 36, 4, 0xf2ede3, 0.2).setDepth(13);
    this.inspectorName = makeText(scene, 24, py(672), '', 18, UI.text, true).setDepth(13);
    this.inspectorMeta = makeText(scene, 24, py(700), '', 12, UI.textDim).setDepth(13);
    this.inspectorStats = scene.add.text(24, py(726), '', {
      fontFamily: FONT_MONO, fontSize: '12px', fontStyle: 'bold', color: UI.text, lineSpacing: 4,
    }).setDepth(13);
    this.moveBtn = makeButton(scene, 75, py(797), 102, 50, '재배치', cb.onMove, {
      fill: UI.panelDeep, textColor: UI.text, fontSize: 12, radius: 4, strokeAlpha: 0.18,
    });
    this.sellBtn = makeButton(scene, 195, py(797), 122, 50, '판매', cb.onSell, {
      fill: UI.panelDeep, textColor: UI.dangerText, fontSize: 12, radius: 4, stroke: UI.danger, strokeAlpha: 0.5,
    });
    this.fuseBtn = makeButton(scene, 325, py(797), 118, 50, '동일 3기 합성', cb.onFuse, {
      fill: UI.panelRaised, textColor: '#cda8e6', fontSize: 11, radius: 4, stroke: 0x9f74cf, strokeAlpha: 0.42,
    });
    [this.moveBtn, this.sellBtn, this.fuseBtn].forEach((button) => button.container.setDepth(13));
    this.inspectorObjects = [
      sheetBg, handle, this.inspectorName, this.inspectorMeta, this.inspectorStats,
      this.moveBtn.container, this.sellBtn.container, this.fuseBtn.container,
    ] as Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible>;
    this.inspectorObjects.forEach((object) => object.setVisible(false));
  }

  pulseRelics(ids: readonly RelicId[]): void {
    if (ids.length === 0) return;
    const names = ids.slice(0, 2).map((id) => RELIC_DEFS[id].name);
    const extra = ids.length > 2 ? ` 외 ${ids.length - 2}` : '';
    this.scene.tweens.killTweensOf(this.relicTriggerText);
    this.relicTriggerText.setText(`⚡ ${names.join(' · ')}${extra} 발동`).setAlpha(1).setScale(1.04);
    this.scene.tweens.add({
      targets: this.relicTriggerText, alpha: 0, scale: 1, delay: 650, duration: 450, ease: 'Cubic.Out',
    });
  }

  refresh(
    selectedUnit: Unit | null,
    speed: number,
    paused: boolean,
    soundEnabled: boolean,
    mode: RunMode,
    fusionActive = false,
    fusionSelectedCount = 0,
  ): void {
    if (this.portrait) {
      this.refreshPortrait(selectedUnit, speed, paused, mode, fusionActive, fusionSelectedCount);
      return;
    }
    const g = this.game;
    const inPrep = g.phase === 'prep';
    this.roundText.setText(`ROUND ${g.round}`);
    this.roundSub.setText(`/ ${ROUNDS}`);
    this.modeText.setText(g.lifeMode ? 'LIFE LAB' : mode === 'daily' ? 'DAILY' : 'STANDARD');

    const alive = aliveEnemies(g.field).length;
    const ratio = g.lifeMode
      ? Math.max(0, Math.min(1, g.lives / LIFE_MODE_STARTING_LIVES))
      : Math.min(1, alive / g.fieldCap);
    const band = g.lifeMode
      ? g.lives <= 5 ? 'critical' : g.lives <= 10 ? 'warning' : 'safe'
      : threatBand(alive, g.fieldCap);
    const threatColor = band === 'critical' ? UI.danger : band === 'warning' ? UI.goldNum : UI.safe;
    this.gaugeFg.width = 400 * ratio;
    this.gaugeFg.setFillStyle(threatColor);
    this.threatTitle.setText(g.lifeMode ? '왕국 라이프 · 적 한 바퀴 완주 시 감소' : threatTitle(g.fieldCap));
    this.gaugeText.setText(
      g.lifeMode ? `♥ ${g.lives}/${LIFE_MODE_STARTING_LIVES} · 침투 ${g.breach}/${LIFE_MODE_BREACH_THRESHOLD}` : threatLabel(alive, g.fieldCap),
    );
    if (band !== this.lastThreatBand && band !== 'safe') {
      this.scene.tweens.killTweensOf(this.gaugeText);
      this.gaugeText.setScale(1.12);
      this.scene.tweens.add({ targets: this.gaugeText, scale: 1, duration: 260, ease: 'Back.Out' });
    }
    this.lastThreatBand = band;
    this.scoreText.setText(`SCORE  ${g.score.toLocaleString()}`);
    this.goldText.setText(`G  ${g.gold.toLocaleString()}`);

    const wave = g.nextWave();
    this.waveName.setText(wave.name);
    this.waveCount.setText(`×${wave.count}`);
    const settlement = g.lastRoundSettlement;
    const otherIncome = settlement
      ? settlement.income.diamond + settlement.income.relic + settlement.income.sales
      : 0;
    this.waveHint.setText(inPrep && settlement
      ? `처치 +${settlement.income.bounty} · 클리어 +${settlement.income.clear} · 이자 +${settlement.income.interest}`
        + `${otherIncome > 0 ? ` · 기타 +${otherIncome}` : ''}`
        + `${settlement.escaped > 0 ? ` · 탈출 ${settlement.escaped}${settlement.lifeDamage > 0 ? ` / ♥−${settlement.lifeDamage}` : ''}` : ''}`
      : WAVE_HINTS[wave.kind]);
    this.settlementText.setText(inPrep && settlement
      ? `R${settlement.round} 결산  +${settlement.incomeTotal}G · −${settlement.spendTotal}G · 잔액 ${settlement.goldEnd}G · 다음 강화 ${settlement.nextUpgradeCost}G`
      : '');
    const nextBoss = Math.ceil(g.round / 10) * 10;
    const bossDistance = nextBoss - g.round;
    this.bossCountdown.setText(wave.kind === 'boss' ? 'BOSS ROUND' : `R${nextBoss} 보스까지 ${bossDistance}`);

    const readyToStart = inPrep && g.handConfirmed && g.pendingUnits.length === 0;
    this.startBtn.container.setVisible(readyToStart);
    this.directiveTitle.setVisible(!readyToStart);
    this.directiveBody.setVisible(!readyToStart);
    if (!inPrep) {
      this.directiveTitle.setText(paused ? '전투가 일시정지되었습니다' : '전투 진행 중');
      this.directiveBody.setText(paused ? 'SPACE로 계속합니다' : `×${speed} 배속 · SPACE 일시정지`);
    } else if (!g.handConfirmed) {
      this.directiveTitle.setText('패를 확정하세요');
      this.directiveBody.setText('카드를 HOLD하고 교환한 뒤 군단을 선택합니다');
    } else if (g.pendingUnits.length > 0) {
      const unitName = UNIT_DEFS[g.pendingUnits[0]].name;
      this.directiveTitle.setText(`${unitName} ${g.pendingUnits.length}기를 배치하세요`);
      this.directiveBody.setText('금색 점선 칸이 추천 위치입니다');
    } else {
      this.directiveTitle.setText('전투 준비 완료');
      this.directiveBody.setText('다음 웨이브를 시작할 수 있습니다');
    }
    this.startBtn.setFill(UI.goldNum, UI.goldInk);
    this.startBtn.setLabel('전투 시작  ▶');

    this.interestText.setText(`다음 이자 +${g.interestNow}G`);
    this.upgradeSub.setText(`Lv${g.upgradeLevel} · ×${g.dmgMult.toFixed(2)} → ×${upgradeMultiplier(g.upgradeLevel + 1).toFixed(2)}`);
    this.upgradeBtn.setLabel(`${g.upgradeCostNow}G`);
    this.upgradeBtn.setEnabled(inPrep && g.gold >= g.upgradeCostNow);

    this.buildCount.setText(`${g.relics.length} / ${RELIC_SLOT_CAP}`);
    const relicIconIds = g.relics.join(',');
    if (relicIconIds !== this.relicIconIds) {
      this.relicIcons.forEach((icon) => icon.destroy(true));
      this.relicIcons = g.relics.map((id, index) => createRelicIcon(this.scene, id, 834 + index * 46, 468, 36).setDepth(3));
      this.relicIconIds = relicIconIds;
    }
    const masteries = MASTERABLE_HANDS.filter((rank) => g.handMastery[rank] > 0).slice(0, 2)
      .map((rank) => `${HAND_NAMES_KO[rank]} Lv${g.handMastery[rank]}`);
    this.buildText.setText(masteries.join('   ') || '연마 효과가 여기에 표시됩니다');

    this.speedBtn.container.setData('speed', speed);
    this.speedBtn.setLabel(`×1  ${speed === 2 ? '×2 ●' : '×2'}  ${speed === 4 ? '×4 ●' : '×4'}`);
    this.deckBtn.setEnabled(true);
    this.guideBtn.setEnabled(true);
    const remaining = g.combatTimeRemaining;
    this.combatText.setText(
      g.phase !== 'combat' ? ''
        : g.escapeWarningCount > 0 ? `⚠ 탈출 임박 ${g.escapeWarningCount}기 · 출구 화력 집중`
        : g.round >= ROUNDS
          ? remaining === null ? `최종 보스 등장 중 · 제한시간 ${FINAL_BOSS_MAX_TIME}초` : `최종 보스 제한시간 ${Math.ceil(remaining)}초`
          : g.lifeMode && remaining === null
            ? '전원 처치 또는 탈출까지 진행'
            : remaining === null ? `적 등장 중 · ${soundEnabled ? 'SOUND ON' : 'SOUND OFF'}` : `라운드 종료까지 ${Math.ceil(remaining)}초`,
    );

    this.refreshInspector(selectedUnit, inPrep, fusionActive, fusionSelectedCount);
  }

  private refreshPortrait(
    selectedUnit: Unit | null,
    speed: number,
    paused: boolean,
    mode: RunMode,
    fusionActive: boolean,
    fusionSelectedCount: number,
  ): void {
    const g = this.game;
    const inPrep = g.phase === 'prep';
    this.roundText.setText(`R${g.round}`);
    this.roundSub.setText(`/${ROUNDS}`);
    this.modeText.setText(g.lifeMode ? 'LIFE LAB' : mode === 'daily' ? 'DAILY' : 'STANDARD');
    const alive = aliveEnemies(g.field).length;
    const ratio = g.lifeMode
      ? Math.max(0, Math.min(1, g.lives / LIFE_MODE_STARTING_LIVES))
      : Math.min(1, alive / g.fieldCap);
    const band = g.lifeMode
      ? g.lives <= 5 ? 'critical' : g.lives <= 10 ? 'warning' : 'safe'
      : threatBand(alive, g.fieldCap);
    const threatColor = band === 'critical' ? UI.danger : band === 'warning' ? UI.goldNum : UI.safe;
    this.gaugeFg.width = 180 * ratio;
    this.gaugeFg.setFillStyle(threatColor);
    this.threatTitle.setText(g.lifeMode ? 'LIFE' : 'THREAT');
    this.gaugeText.setText(
      g.lifeMode ? `♥ ${g.lives} · 침투 ${g.breach}/${LIFE_MODE_BREACH_THRESHOLD}` : threatLabel(alive, g.fieldCap),
    );
    this.goldText.setText(`G ${g.gold.toLocaleString()}`);

    const wave = g.nextWave();
    this.waveName.setText(wave.name);
    this.waveCount.setText(`×${wave.count}`);
    const nextBoss = Math.ceil(g.round / 10) * 10;
    this.bossCountdown.setText(wave.kind === 'boss' ? 'BOSS ROUND' : `R${nextBoss} 보스까지 ${nextBoss - g.round}`);
    this.waveHint.setText(wave.kind === 'tank' || wave.kind === 'splitter' ? '광역이 유리' : WAVE_HINTS[wave.kind].split(' · ')[1] ?? '화력 집중');
    const settlement = g.lastRoundSettlement;
    this.settlementText.setText(inPrep && settlement
      ? `R${settlement.round} +${settlement.incomeTotal} / −${settlement.spendTotal}G`
      : '');
    this.bossCountdown.setVisible(!(inPrep && settlement));

    const readyToStart = inPrep && g.handConfirmed && g.pendingUnits.length === 0;
    const placing = inPrep && g.handConfirmed && g.pendingUnits.length > 0;
    const inCombat = g.phase === 'combat';
    this.startBtn.container.setVisible(readyToStart || inCombat);
    this.placementBg?.setVisible(placing);
    this.directiveTitle.setVisible(placing);
    this.directiveBody.setVisible(placing);
    if (placing) {
      this.directiveTitle.setText(`◆ ${UNIT_DEFS[g.pendingUnits[0]].name} ${g.pendingUnits.length}기를 배치하세요`);
      this.directiveBody.setText('금색 점선 칸이 추천 위치입니다');
    }
    this.startBtn.setFill(inCombat ? UI.panelRaised : UI.goldNum, inCombat ? UI.text : UI.goldInk);
    this.startBtn.setLabel(inCombat ? paused ? '전투 계속 ▶' : `일시정지 · ×${speed}` : '전투 시작 ▶');

    this.upgradeBtn.setLabel(`강화 ${g.upgradeCostNow}G`);
    this.upgradeBtn.setEnabled(inPrep && g.gold >= g.upgradeCostNow);
    this.speedBtn.container.setData('speed', speed);
    this.speedBtn.setLabel(`×${speed}`);
    this.deckBtn.setEnabled(true);
    this.guideBtn.setEnabled(true);
    this.refreshInspector(selectedUnit, inPrep, fusionActive, fusionSelectedCount);
  }

  private refreshInspector(
    selectedUnit: Unit | null,
    inPrep: boolean,
    fusionActive: boolean,
    fusionSelectedCount: number,
  ): void {
    const visible = selectedUnit !== null;
    this.inspectorObjects.forEach((object) => object.setVisible(visible));
    if (!selectedUnit) return;
    const def = UNIT_DEFS[selectedUnit.tier];
    const variant = selectedUnit.variant ? ` · ${HAND_VARIANT_LABELS[selectedUnit.variant]}` : '';
    const suit = selectedUnit.suit ? `${SUIT_GLYPHS[selectedUnit.suit]} ${suitIdentityLabel(selectedUnit.suit)}` : '무문양';
    this.inspectorName.setText(`${variantUnitName(def.name, selectedUnit.variant)}   ${selectedUnit.suit ? SUIT_GLYPHS[selectedUnit.suit] : ''}`);
    this.inspectorMeta.setText(`${HAND_NAMES_KO[def.tier]}${variant} · ${suit}`);
    this.inspectorStats.setText(
      `DPS  ${def.dps} × ${this.game.unitDpsMult(selectedUnit).toFixed(2)}\n`
      + `사거리  ${def.range.toFixed(1)}    ${traitLabel(def)}`
      + `${selectedUnit.suit ? `\n${SUIT_TRAIT_LABELS[selectedUnit.suit]}` : ''}`,
    );
    this.sellBtn.setLabel(`판매 +${SELL_REFUND[selectedUnit.tier]}G`);
    this.sellBtn.setEnabled(inPrep);
    this.moveBtn.setEnabled(inPrep);
    const canFuse = selectedUnit.tier < HandRank.RoyalFlush
      && this.game.fusionCandidates(selectedUnit.tier).length >= 3;
    this.fuseBtn.container.setVisible(canFuse);
    this.fuseBtn.setEnabled(inPrep && canFuse);
    this.fuseBtn.setLabel(fusionActive
      ? fusionSelectedCount === 3 ? '선택 3/3 · 합성 확정' : `재료 선택 ${fusionSelectedCount}/3`
      : '동일 3기 선택 합성');
  }
}
