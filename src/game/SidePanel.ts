import Phaser from 'phaser';
import { Game } from '../core/game';
import { Unit, aliveEnemies } from '../core/combat';
import { UNIT_DEFS, UnitDef } from '../core/units';
import { HAND_NAMES_KO, SUIT_GLYPHS, HandRank } from '../core/cards/types';
import {
  FINAL_BOSS_MAX_TIME, LIFE_MODE_STARTING_LIVES,
  ROUNDS, SELL_REFUND, upgradeMultiplier,
} from '../core/balance';
import { RELIC_DEFS, RELIC_SLOT_CAP, RelicId } from '../core/relics';
import { RunMode } from '../meta/profile';
import { Button, FONT, FONT_DISPLAY, FONT_MONO, UI, makeButton, makeText } from './ui';
import { PANEL_SECTIONS, UiRect, portraitCombatInspectorBounds, portraitSceneHeight, portraitY } from './layout';
import { threatBand, threatLabel, threatTitle } from './threat';
import { createRelicIcon } from './relicAssets';
import { MASTERABLE_HANDS } from '../core/mastery';
import {
  HAND_VARIANT_LABELS, suitIdentityLabel, SUIT_TRAIT_LABELS, variantUnitName,
} from '../core/cards/handIdentity';
import { isPortraitLayout } from './device';
import { FORMATION_MASTERY_COPY } from '../core/formationMastery';
import { getLocale, handName, relicName, tr, unitName } from '../i18n';

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
  onCloseInspector(): void;
}

function traitLabel(def: UnitDef): string {
  const t = def.traits;
  if (t.splash) return tr(`광역 ${t.splash}칸`, `AREA ${t.splash} TILES`);
  if (t.chain) return tr(`체인 ${t.chain.count}기`, `CHAIN ${t.chain.count}`);
  if (t.slow) return tr(`감속 ${t.slow.pct * 100}%`, `SLOW ${t.slow.pct * 100}%`);
  if (t.aura) return tr(`공격 오라 +${t.aura.dmgPct * 100}%`, `DAMAGE AURA +${t.aura.dmgPct * 100}%`);
  if (t.execute) return tr('체력 비례 피해', 'HEALTH-SCALED DAMAGE');
  if (t.ignoreDefense) return tr('방어 무시', 'IGNORES DEFENSE');
  return tr('단일 공격', 'SINGLE TARGET');
}

function englishSuitName(suit: string): string {
  return ({ S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' } as Record<string, string>)[suit] ?? 'No suit';
}

function englishSuitTrait(suit: string): string {
  return ({ S: 'Long-range focus', H: 'Sustain focus', D: 'Gold on kills', C: 'Control focus' } as Record<string, string>)[suit] ?? '';
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
  private settlementText!: Phaser.GameObjects.Text;
  private directiveTitle!: Phaser.GameObjects.Text;
  private directiveBody!: Phaser.GameObjects.Text;
  private startBtn!: Button;
  private interestText!: Phaser.GameObjects.Text;
  private upgradeSub!: Phaser.GameObjects.Text;
  private upgradeBtn!: Button;
  private buildCard?: Phaser.GameObjects.Graphics;
  private buildTitle?: Phaser.GameObjects.Text;
  private buildCount!: Phaser.GameObjects.Text;
  private buildText!: Phaser.GameObjects.Text;
  private deckBtn!: Button;
  private guideBtn!: Button;
  private speedBtn!: Button;
  private relicIcons: Phaser.GameObjects.Container[] = [];
  private relicIconIds = '';
  private relicTriggerText!: Phaser.GameObjects.Text;
  private combatText!: Phaser.GameObjects.Text;
  private tacticText!: Phaser.GameObjects.Text;
  private wagerText!: Phaser.GameObjects.Text;
  private formationMasteryText!: Phaser.GameObjects.Text;
  private lastThreatBand: 'safe' | 'warning' | 'critical' = 'safe';
  private inspectorObjects: Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible> = [];
  private inspectorName!: Phaser.GameObjects.Text;
  private inspectorMeta!: Phaser.GameObjects.Text;
  private inspectorStats!: Phaser.GameObjects.Text;
  private combatInspectorObjects: Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible> = [];
  private combatInspectorName?: Phaser.GameObjects.Text;
  private combatInspectorMeta?: Phaser.GameObjects.Text;
  private combatInspectorStats?: Phaser.GameObjects.Text;
  private sellBtn!: Button;
  private moveBtn!: Button;
  private fuseBtn!: Button;
  private portrait = false;
  private placementBg?: Phaser.GameObjects.Rectangle;
  private statusChipsSuppressed = false;
  private wagerStatusVisible = false;
  private tacticStatusVisible = false;

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

    railCard(scene, PANEL_SECTIONS.directive, true);
    railCard(scene, PANEL_SECTIONS.economy);
    this.buildCard = railCard(scene, PANEL_SECTIONS.build).setVisible(false);
    railCard(scene, PANEL_SECTIONS.utility);

    this.settlementText = makeText(scene, 900, 84, '', 11, UI.gold, true).setWordWrapWidth(352, true);
    this.formationMasteryText = makeText(scene, 900, 84, '', 11, '#8fd8ff', true).setWordWrapWidth(352, true);


    this.directiveTitle = makeText(scene, 900, 417, '', 14, UI.text, true).setWordWrapWidth(352, true);
    this.directiveBody = makeText(scene, 900, 440, '', 10, UI.textDim).setWordWrapWidth(352, true);
    this.startBtn = makeButton(scene, 1076, 436, 376, 56, '', () => {
      if (this.game.phase === 'combat') cb.onPause(); else cb.onStart();
    }, {
      fill: UI.panelRaised, textColor: UI.text, fontSize: 15, radius: 8, stroke: UI.goldNum, strokeAlpha: 0.2,
    });
    this.startBtn.container.setVisible(false);

    this.interestText = makeText(scene, 1148, 488, '', 9, UI.textFaint).setOrigin(1, 0);
    makeText(scene, 900, 488, tr('전역 공격 강화', 'GLOBAL DAMAGE'), 12, UI.text, true);
    this.upgradeSub = makeText(scene, 900, 508, '', 10, UI.textDim);
    this.upgradeBtn = makeButton(scene, 1212, 506, 80, 40, '', cb.onUpgrade, {
      fill: UI.panelRaised, textColor: UI.gold, fontSize: 13, radius: 6, stroke: UI.goldNum, strokeAlpha: 0.5,
    });

    this.buildTitle = makeText(scene, 900, 554, 'BUILD', 9, UI.textDim, true).setLetterSpacing(2).setVisible(false);
    this.buildCount = scene.add.text(1252, 554, '', {
      fontFamily: FONT_MONO, fontSize: '11px', color: UI.textFaint,
    }).setOrigin(1, 0);
    this.buildText = makeText(scene, 900, 609, '', 10, UI.textDim, true)
      .setWordWrapWidth(352, true).setLineSpacing(0);
    this.relicTriggerText = makeText(scene, 900, 629, '', 10, UI.gold, true).setAlpha(0).setDepth(7);

    this.deckBtn = makeButton(scene, 948, 668, 116, 48, tr('덱 · D', 'DECK · D'), cb.onDeck, {
      fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 0, strokeAlpha: 0.14,
    });
    this.guideBtn = makeButton(scene, 1076, 668, 116, 48, tr('도감 · H', 'GUIDE · H'), cb.onGuide, {
      fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 0, strokeAlpha: 0.14,
    });
    this.speedBtn = makeButton(scene, 1204, 668, 116, 48, '×1  ×2  ×4', () => {
      const current = SPEEDS.indexOf((this.speedBtn.container.getData('speed') ?? 1) as 1 | 2 | 4);
      cb.onSpeed(SPEEDS[(current + 1) % SPEEDS.length]);
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 12, radius: 0, strokeAlpha: 0.14 });
    this.combatText = makeText(scene, 24, 697, '', 10, UI.textDim).setWordWrapWidth(842, true);
    this.tacticText = makeText(scene, 16, 64, '', 10, '#b7e5ff', true).setWordWrapWidth(510, true);
    this.wagerText = makeText(scene, 536, 64, '', 10, UI.gold, true).setWordWrapWidth(330, true);

    const inspectorBg = scene.add.rectangle(646, 382, 240, 172, UI.panelDeep, 0.98)
      .setStrokeStyle(1, UI.goldNum, 0.28).setDepth(10);
    this.inspectorName = makeText(scene, 542, 310, '', 16, UI.text, true).setDepth(11);
    this.inspectorMeta = makeText(scene, 542, 336, '', 11, UI.textDim).setDepth(11);
    this.inspectorStats = scene.add.text(542, 360, '', {
      fontFamily: FONT_MONO, fontSize: '12px', fontStyle: 'bold', color: UI.text, lineSpacing: 5,
    }).setDepth(11);
    this.moveBtn = makeButton(scene, 598, 430, 104, 36, tr('재배치', 'MOVE'), cb.onMove, {
      fill: UI.panelDeep, textColor: UI.text, fontSize: 11, radius: 0, strokeAlpha: 0.18,
    });
    this.sellBtn = makeButton(scene, 710, 430, 104, 36, tr('판매', 'SELL'), cb.onSell, {
      fill: UI.panelDeep, textColor: UI.dangerText, fontSize: 11, radius: 0, stroke: UI.danger, strokeAlpha: 0.5,
    });
    this.fuseBtn = makeButton(scene, 654, 470, 216, 34, tr('동일 3기 합성', 'FUSE 3 MATCHING UNITS'), cb.onFuse, {
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
    this.createCombatInspector(scene, cb);
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
    this.threatTitle = scene.add.text(90, 55, 'THREAT', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#74727e', letterSpacing: 1.6,
    });
    scene.add.rectangle(90, 81, 170, 8, UI.panelRaised, 1).setOrigin(0, 0.5);
    this.gaugeFg = scene.add.rectangle(90, 81, 0, 8, UI.safe, 1).setOrigin(0, 0.5);
    this.gaugeText = scene.add.text(260, 55, '', {
      fontFamily: FONT_MONO, fontSize: '12px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    this.scoreText = scene.add.text(0, 0, '').setVisible(false);
    this.goldText = scene.add.text(374, 60, '', {
      fontFamily: FONT_MONO, fontSize: '19px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);

    this.settlementText = makeText(scene, 22, py(401), '', 11, UI.gold, true).setWordWrapWidth(346, true);
    this.formationMasteryText = makeText(scene, 22, py(401), '', 11, '#8fd8ff', true);


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
    this.relicTriggerText = makeText(scene, 195, 22, '', 9, UI.gold, true).setOrigin(0.5).setAlpha(0).setDepth(7);
    this.wagerText = scene.add.text(195, 3, '', {
      fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: UI.gold,
      backgroundColor: '#0d0d13', padding: { x: 6, y: 2 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(6);
    this.tacticText = scene.add.text(195, 25, '', {
      fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#b7e5ff',
      backgroundColor: '#0d0d13', padding: { x: 6, y: 2 }, align: 'center',
    }).setOrigin(0.5, 0).setDepth(6);

    this.deckBtn = makeButton(scene, 53, py(769), 82, 50, tr('덱', 'DECK'), cb.onDeck, {
      fill: UI.panelDeep, textColor: '#a8a5b2', fontSize: 13, radius: 4, strokeAlpha: 0.14,
    });
    this.guideBtn = makeButton(scene, 143, py(769), 82, 50, tr('도감', 'GUIDE'), cb.onGuide, {
      fill: UI.panelDeep, textColor: '#a8a5b2', fontSize: 13, radius: 4, strokeAlpha: 0.14,
    });
    this.upgradeBtn = makeButton(scene, 248, py(769), 112, 50, tr('강화', 'UPGRADE'), cb.onUpgrade, {
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
    this.moveBtn = makeButton(scene, 75, py(797), 102, 50, tr('재배치', 'MOVE'), cb.onMove, {
      fill: UI.panelDeep, textColor: UI.text, fontSize: 12, radius: 4, strokeAlpha: 0.18,
    });
    this.sellBtn = makeButton(scene, 195, py(797), 122, 50, tr('판매', 'SELL'), cb.onSell, {
      fill: UI.panelDeep, textColor: UI.dangerText, fontSize: 12, radius: 4, stroke: UI.danger, strokeAlpha: 0.5,
    });
    this.fuseBtn = makeButton(scene, 325, py(797), 118, 50, tr('동일 3기 합성', 'FUSE 3'), cb.onFuse, {
      fill: UI.panelRaised, textColor: '#cda8e6', fontSize: 11, radius: 4, stroke: 0x9f74cf, strokeAlpha: 0.42,
    });
    [this.moveBtn, this.sellBtn, this.fuseBtn].forEach((button) => button.container.setDepth(13));
    this.inspectorObjects = [
      sheetBg, handle, this.inspectorName, this.inspectorMeta, this.inspectorStats,
      this.moveBtn.container, this.sellBtn.container, this.fuseBtn.container,
    ] as Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible>;
    this.inspectorObjects.forEach((object) => object.setVisible(false));
  }

  private createCombatInspector(scene: Phaser.Scene, cb: PanelCallbacks): void {
    const bounds = portraitCombatInspectorBounds(portraitSceneHeight(scene));
    const bg = scene.add.rectangle(bounds.x, bounds.y, bounds.width, bounds.height, UI.panelDeep, 0.99)
      .setOrigin(0).setStrokeStyle(1, UI.goldNum, 0.28).setDepth(12).setInteractive();
    bg.on('pointerdown', (_p: unknown, _x: number, _y: number, event: { stopPropagation(): void }) => event.stopPropagation());
    this.combatInspectorName = makeText(scene, 22, bounds.y + 12, '', 14, UI.text, true)
      .setWordWrapWidth(274, true).setDepth(13);
    this.combatInspectorMeta = makeText(scene, 22, bounds.y + 53, '', 11, UI.textDim)
      .setWordWrapWidth(344, true).setDepth(13);
    this.combatInspectorStats = makeText(scene, 22, bounds.y + 96, '', 12, UI.text)
      .setWordWrapWidth(344, true).setDepth(13);
    const close = makeButton(scene, 347, bounds.y + 25, 54, 36, tr('닫기', 'CLOSE'), cb.onCloseInspector, {
      fill: UI.panelRaised, fontSize: 10, textColor: UI.textDim,
    });
    close.container.setDepth(13);
    this.combatInspectorObjects = [bg, this.combatInspectorName, this.combatInspectorMeta, this.combatInspectorStats, close.container];
    this.combatInspectorObjects.forEach((object) => object.setVisible(false));
  }

  pulseRelics(ids: readonly RelicId[]): void {
    if (ids.length === 0) return;
    const names = ids.slice(0, 2).map((id) => relicName(id, RELIC_DEFS[id].name));
    const extra = ids.length > 2 ? tr(` 외 ${ids.length - 2}`, ` +${ids.length - 2} MORE`) : '';
    this.scene.tweens.killTweensOf(this.relicTriggerText);
    this.relicTriggerText.setText(tr(`⚡ ${names.join(' · ')}${extra} 발동`, `⚡ ${names.join(' · ')}${extra} TRIGGERED`)).setAlpha(1).setScale(1.04);
    this.scene.tweens.add({
      targets: this.relicTriggerText, alpha: 0, scale: 1, delay: 650, duration: 450, ease: 'Cubic.Out',
    });
  }

  setWagerStatus(text: string, visible: boolean): void {
    this.wagerStatusVisible = visible;
    this.wagerText.setText(text).setVisible(visible && !this.statusChipsSuppressed);
  }

  setTacticStatus(text: string, visible: boolean): void {
    this.tacticStatusVisible = visible;
    this.tacticText.setText(text).setVisible(visible && !this.statusChipsSuppressed);
  }

  setStatusChipsSuppressed(suppressed: boolean): void {
    this.statusChipsSuppressed = suppressed;
    this.wagerText.setVisible(!suppressed && this.wagerStatusVisible);
    this.tacticText.setVisible(!suppressed && this.tacticStatusVisible);
  }

  private refreshFormationMastery(formation: boolean): void {
    const copy = FORMATION_MASTERY_COPY;
    const locale = getLocale();
    const compact = this.portrait;
    const escaped = this.game.currentFormationEscaped;
    this.formationMasteryText
      .setText(!formation ? '' : escaped
        ? `${copy.lost[locale]} · ${compact ? '×0' : `${copy.streak[locale]} ×0`}`
        : `${copy.perfect[locale]} · ${compact ? `×${this.game.formationMastery.streak}` : `${copy.streak[locale]} ×${this.game.formationMastery.streak}`}`)
      .setColor(escaped ? '#ffaaa3' : '#8fd8ff')
      .setVisible(formation);

  }

  private refreshCurrentStatus(): void {
    const g = this.game;
    const settlement = g.phase === 'prep' ? g.lastRoundSettlement : null;
    this.settlementText.setText(settlement
      ? tr(`R${settlement.round} 결산 · +${settlement.incomeTotal}G / −${settlement.spendTotal}G`, `R${settlement.round} RESULT · +${settlement.incomeTotal}G / −${settlement.spendTotal}G`)
      : '').setVisible(Boolean(settlement));
    this.refreshFormationMastery(g.phase === 'combat' && g.nextWave().formation !== null);
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
    this.modeText.setText(g.lifeMode
      ? g.crownLevel > 0 ? `LIFE · ♛ CROWN ${g.crownLevel}` : mode === 'daily' ? 'LIFE · DAILY' : 'LIFE'
      : g.crownLevel > 0 ? `♛ CROWN ${g.crownLevel}` : mode === 'daily' ? 'DAILY' : 'CLASSIC');

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
    this.threatTitle.setText(g.lifeMode
      ? tr('왕국 라이프 · 적 한 바퀴 완주 시 감소', 'KINGDOM LIVES')
      : tr(threatTitle(g.fieldCap), 'FIELD THREAT'));
    this.gaugeText.setText(
      g.lifeMode ? `♥ ${g.lives}/${LIFE_MODE_STARTING_LIVES}` : tr(threatLabel(alive, g.fieldCap), `${alive} / ${g.fieldCap}`),
    );
    if (band !== this.lastThreatBand && band !== 'safe') {
      this.scene.tweens.killTweensOf(this.gaugeText);
      this.gaugeText.setScale(1.12);
      this.scene.tweens.add({ targets: this.gaugeText, scale: 1, duration: 260, ease: 'Back.Out' });
    }
    this.lastThreatBand = band;
    this.scoreText.setText(`SCORE  ${g.score.toLocaleString()}`);
    this.goldText.setText(`G  ${g.gold.toLocaleString()}`);

    this.refreshCurrentStatus();

    const readyToStart = inPrep && g.handConfirmed && g.pendingUnits.length === 0;
    this.startBtn.container.setVisible(readyToStart || g.phase === 'combat');
    this.directiveTitle.setVisible(inPrep && g.handConfirmed && !readyToStart);
    this.directiveBody.setVisible(inPrep && g.handConfirmed && !readyToStart);
    if (!inPrep) {
      this.directiveTitle.setText(paused ? tr('전투가 일시정지되었습니다', 'COMBAT PAUSED') : tr('전투 진행 중', 'COMBAT IN PROGRESS'));
      this.directiveBody.setText(paused ? tr('SPACE로 계속합니다', 'Press SPACE to resume') : tr(`×${speed} 배속 · SPACE 일시정지`, `×${speed} speed · SPACE to pause`));
    } else if (!g.handConfirmed) {
      this.directiveTitle.setText(tr('패를 확정하세요', 'CONFIRM YOUR HAND'));
      this.directiveBody.setText(tr('카드를 HOLD하고 교환한 뒤 군단을 선택합니다', 'HOLD cards, exchange the rest, then recruit your unit'));
    } else if (g.pendingUnits.length > 0) {
      const pendingName = unitName(g.pendingUnits[0], UNIT_DEFS[g.pendingUnits[0]].name);
      this.directiveTitle.setText(tr(`${pendingName} ${g.pendingUnits.length}기를 배치하세요`, `PLACE ${g.pendingUnits.length} ${pendingName.toUpperCase()}`));
      this.directiveBody.setText(tr('금색 점선 칸이 추천 위치입니다', 'Gold dashed tiles are recommended'));
    } else {
      this.directiveTitle.setText(tr('전투 준비 완료', 'READY FOR COMBAT'));
      this.directiveBody.setText(tr('다음 웨이브를 시작할 수 있습니다', 'Start the next wave when ready'));
    }
    this.startBtn.setFill(UI.goldNum, UI.goldInk);
    this.startBtn.setLabel(g.phase === 'combat' ? paused ? tr('전투 계속 ▶', 'RESUME ▶') : tr('전투 일시정지 Ⅱ', 'PAUSE Ⅱ') : tr('전투 시작  ▶', 'START COMBAT  ▶'));

    this.interestText.setText(tr(`다음 이자 +${g.interestNow}G`, `NEXT INTEREST +${g.interestNow}G`));
    this.upgradeSub.setText(`Lv${g.upgradeLevel} · ×${g.dmgMult.toFixed(2)} → ×${upgradeMultiplier(g.upgradeLevel + 1).toFixed(2)}`);
    this.upgradeBtn.setLabel(`${g.upgradeCostNow}G`);
    this.upgradeBtn.setEnabled(g.canBuyUpgrade);

    this.buildCount.setText(`${g.relics.length} / ${RELIC_SLOT_CAP}`);
    const relicIconIds = g.relics.join(',');
    if (relicIconIds !== this.relicIconIds) {
      this.relicIcons.forEach((icon) => icon.destroy(true));
      this.relicIcons = g.relics.map((id, index) => createRelicIcon(this.scene, id, 920 + index * 46, 586, 30).setDepth(3));
      this.relicIconIds = relicIconIds;
    }
    const masteries = MASTERABLE_HANDS.filter((rank) => g.handMastery[rank] > 0).slice(0, 2)
      .map((rank) => `${handName(rank, HAND_NAMES_KO[rank])} Lv${g.handMastery[rank]}`);
    this.buildText.setText(masteries.join('   ')).setVisible(masteries.length > 0);
    const hasBuild = g.relics.length > 0 || masteries.length > 0;
    this.buildCard?.setVisible(hasBuild);
    this.buildTitle?.setVisible(hasBuild);
    this.buildCount.setVisible(g.relics.length > 0);

    this.speedBtn.container.setData('speed', speed);
    this.speedBtn.setLabel(`×1  ${speed === 2 ? '×2 ●' : '×2'}  ${speed === 4 ? '×4 ●' : '×4'}`);
    this.deckBtn.setEnabled(true);
    this.guideBtn.setEnabled(true);
    const remaining = g.combatTimeRemaining;
    this.combatText.setText(
      g.phase !== 'combat' ? ''
        : g.escapeWarningCount > 0 ? tr(`⚠ 탈출 임박 ${g.escapeWarningCount}기 · 출구 화력 집중`, `⚠ ${g.escapeWarningCount} NEAR EXIT · FOCUS FIRE`)
        : g.round >= ROUNDS
          ? g.lifeMode ? tr('최종 보스 처치 시 승리 · 탈출 시 패배', 'FINAL BOSS: KILL TO WIN · ESCAPE = DEFEAT')
            : remaining === null ? tr(`최종 보스 등장 중 · 제한시간 ${FINAL_BOSS_MAX_TIME}초`, `FINAL BOSS INCOMING · ${FINAL_BOSS_MAX_TIME}s LIMIT`) : tr(`최종 보스 제한시간 ${Math.ceil(remaining)}초`, `FINAL BOSS · ${Math.ceil(remaining)}s LEFT`)
          : g.lifeMode && remaining === null
            ? tr('전원 처치 또는 탈출까지 진행', 'DEFEAT ALL ENEMIES OR WAIT FOR ESCAPES')
            : remaining === null ? tr(`적 등장 중 · ${soundEnabled ? 'SOUND ON' : 'SOUND OFF'}`, `ENEMIES INCOMING · ${soundEnabled ? 'SOUND ON' : 'SOUND OFF'}`) : tr(`라운드 종료까지 ${Math.ceil(remaining)}초`, `${Math.ceil(remaining)}s UNTIL ROUND END`),
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
    this.roundSub.setX(this.roundText.x + this.roundText.width + 4);
    this.modeText.setText(g.lifeMode
      ? g.crownLevel > 0 ? `LIFE CROWN ${g.crownLevel}` : mode === 'daily' ? 'LIFE DAILY' : 'LIFE'
      : g.crownLevel > 0 ? `CROWN ${g.crownLevel}` : mode === 'daily' ? 'DAILY' : 'CLASSIC');
    const alive = aliveEnemies(g.field).length;
    const ratio = g.lifeMode
      ? Math.max(0, Math.min(1, g.lives / LIFE_MODE_STARTING_LIVES))
      : Math.min(1, alive / g.fieldCap);
    const band = g.lifeMode
      ? g.lives <= 5 ? 'critical' : g.lives <= 10 ? 'warning' : 'safe'
      : threatBand(alive, g.fieldCap);
    const threatColor = band === 'critical' ? UI.danger : band === 'warning' ? UI.goldNum : UI.safe;
    this.gaugeFg.width = 170 * ratio;
    this.gaugeFg.setFillStyle(threatColor);
    this.threatTitle
      .setText(g.crownLevel > 0 ? `CROWN ${g.crownLevel}` : g.lifeMode ? 'LIFE' : 'THREAT')
      .setColor(g.crownLevel > 0 ? UI.gold : '#74727e');
    this.gaugeText.setText(
      g.lifeMode ? `♥ ${g.lives}` : tr(threatLabel(alive, g.fieldCap), `${alive}/${g.fieldCap}`),
    );
    this.goldText.setText(`G ${g.gold.toLocaleString()}`);

    this.refreshCurrentStatus();

    const readyToStart = inPrep && g.handConfirmed && g.pendingUnits.length === 0;
    const placing = inPrep && g.handConfirmed && g.pendingUnits.length > 0;
    const inCombat = g.phase === 'combat';
    this.startBtn.container.setVisible(readyToStart || inCombat);
    this.placementBg?.setVisible(placing);
    this.directiveTitle.setVisible(placing);
    this.directiveBody.setVisible(placing);
    if (placing) {
      const pendingName = unitName(g.pendingUnits[0], UNIT_DEFS[g.pendingUnits[0]].name);
      this.directiveTitle.setText(tr(`◆ ${pendingName} ${g.pendingUnits.length}기를 배치하세요`, `◆ PLACE ${g.pendingUnits.length} ${pendingName.toUpperCase()}`));
      this.directiveBody.setText(tr('금색 점선 칸이 추천 위치입니다', 'Gold dashed tiles are recommended'));
    }
    this.startBtn.setFill(inCombat ? UI.panelRaised : UI.goldNum, inCombat ? UI.text : UI.goldInk);
    this.startBtn.setLabel(inCombat ? paused ? tr('전투 계속 ▶', 'RESUME ▶') : tr(`일시정지 · ×${speed}`, `PAUSE · ×${speed}`) : tr('전투 시작 ▶', 'START COMBAT ▶'));

    this.upgradeBtn.setLabel(tr(`강화 ${g.upgradeCostNow}G`, `UPGRADE ${g.upgradeCostNow}G`));
    this.upgradeBtn.setEnabled(g.canBuyUpgrade);
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
    const compactCombat = this.portrait && this.game.phase === 'combat';
    this.inspectorObjects.forEach((object) => object.setVisible(visible && !compactCombat));
    this.combatInspectorObjects?.forEach((object) => object.setVisible(visible && compactCombat));
    if (!selectedUnit) return;
    const def = UNIT_DEFS[selectedUnit.tier];
    const variant = selectedUnit.variant && getLocale() === 'ko' ? ` · ${HAND_VARIANT_LABELS[selectedUnit.variant]}` : '';
    const suit = selectedUnit.suit
      ? `${SUIT_GLYPHS[selectedUnit.suit]} ${getLocale() === 'ko' ? suitIdentityLabel(selectedUnit.suit) : englishSuitName(selectedUnit.suit)}`
      : tr('무문양', 'No suit');
    if (compactCombat) {
      this.combatInspectorName?.setText(unitName(def.tier, variantUnitName(def.name, selectedUnit.variant)));
      this.combatInspectorMeta?.setText(`${handName(def.tier, HAND_NAMES_KO[def.tier])}${variant} · ${suit}`);
      this.combatInspectorStats?.setText(`DPS ${(def.dps * this.game.unitDpsMult(selectedUnit)).toFixed(1)} · ${tr('사거리', 'RANGE')} ${def.range.toFixed(1)}`);
      return;
    }
    this.inspectorName.setText(`${unitName(def.tier, variantUnitName(def.name, selectedUnit.variant))}   ${selectedUnit.suit ? SUIT_GLYPHS[selectedUnit.suit] : ''}`);
    this.inspectorMeta.setText(
      `${handName(def.tier, HAND_NAMES_KO[def.tier])}${variant} · ${suit}${selectedUnit.allIn ? tr(' · ● 최후의 승부', ' · ● LAST STAND') : ''}`,
    );
    this.inspectorStats.setText(
      `DPS  ${def.dps} × ${this.game.unitDpsMult(selectedUnit).toFixed(2)}\n`
      + `${tr('사거리', 'RANGE')}  ${def.range.toFixed(1)}    ${traitLabel(def)}`
      + `${selectedUnit.suit ? `\n${getLocale() === 'ko' ? SUIT_TRAIT_LABELS[selectedUnit.suit] : englishSuitTrait(selectedUnit.suit)}` : ''}`,
    );
    this.sellBtn.setLabel(tr(`판매 +${SELL_REFUND[selectedUnit.tier]}G`, `SELL +${SELL_REFUND[selectedUnit.tier]}G`));
    this.sellBtn.setEnabled(inPrep);
    this.moveBtn.setEnabled(inPrep);
    const canFuse = selectedUnit.tier < HandRank.RoyalFlush
      && this.game.fusionCandidates(selectedUnit.tier).length >= 3;
    this.fuseBtn.container.setVisible(canFuse);
    this.fuseBtn.setEnabled(inPrep && canFuse);
    this.fuseBtn.setLabel(fusionActive
      ? fusionSelectedCount === 3 ? tr('선택 3/3 · 합성 확정', 'SELECTED 3/3 · CONFIRM FUSION') : tr(`재료 선택 ${fusionSelectedCount}/3`, `SELECT MATERIALS ${fusionSelectedCount}/3`)
      : tr('동일 3기 선택 합성', 'SELECT 3 MATCHING UNITS'));
  }
}
