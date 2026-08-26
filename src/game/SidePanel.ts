import Phaser from 'phaser';
import { Game } from '../core/game';
import { Unit, aliveEnemies } from '../core/combat';
import { UNIT_DEFS, UnitDef } from '../core/units';
import { HAND_NAMES_KO } from '../core/cards/types';
import { ROUNDS, SELL_REFUND, UNIT_CAP } from '../core/balance';
import { RELIC_DEFS } from '../core/relics';
import { RunMode } from '../meta/profile';
import { Button, UI, makeButton, makeText } from './ui';
import { PANEL_BOUNDS, PANEL_SECTIONS, UiRect } from './layout';

const PX = 808;
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
}

function traitLabel(def: UnitDef): string {
  const t = def.traits;
  if (t.splash) return `스플래시 ${t.splash}타일`;
  if (t.chain) return `체인 ${t.chain.count}체 (${t.chain.decay * 100}%)`;
  if (t.slow) return `슬로우 ${t.slow.pct * 100}% / ${t.slow.dur}s`;
  if (t.aura) return `오라: 아군 공격 +${t.aura.dmgPct * 100}%`;
  if (t.execute) return `현재 HP ${t.execute.pct * 100}% 추가피해`;
  if (t.ignoreDefense) return '방어 무시';
  return '단일 대상';
}

function panelCard(scene: Phaser.Scene, rect: UiRect): void {
  scene.add.rectangle(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2 + 2,
    rect.width,
    rect.height,
    0x000000,
    0.24,
  );
  scene.add.rectangle(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    rect.width,
    rect.height,
    UI.panelRaised,
    0.96,
  ).setStrokeStyle(1, UI.panelLine, 0.85);
}

/** 우측 정보/컨트롤 패널 */
export class SidePanel {
  private game: Game;
  private roundText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private gaugeFg: Phaser.GameObjects.Rectangle;
  private gaugeText: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private upgradeText: Phaser.GameObjects.Text;
  private upgradeBtn: Button;
  private pendingText: Phaser.GameObjects.Text;
  private unitName: Phaser.GameObjects.Text;
  private unitStats: Phaser.GameObjects.Text;
  private sellBtn: Button;
  private moveBtn: Button;
  private fuseBtn: Button;
  private startBtn: Button;
  private speedBtns: Button[] = [];
  private pauseBtn: Button;
  private soundBtn: Button;
  private relicText: Phaser.GameObjects.Text;
  private combatText: Phaser.GameObjects.Text;
  private helpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, game: Game, cb: PanelCallbacks) {
    this.game = game;

    const backdrop = scene.add.graphics();
    backdrop.fillGradientStyle(UI.panelDeep, UI.panelDeep, UI.panel, UI.panel, 1);
    backdrop.fillRoundedRect(PANEL_BOUNDS.x, PANEL_BOUNDS.y, PANEL_BOUNDS.width, PANEL_BOUNDS.height, 8);
    backdrop.lineStyle(1, UI.panelGlow, 0.7);
    backdrop.strokeRoundedRect(PANEL_BOUNDS.x, PANEL_BOUNDS.y, PANEL_BOUNDS.width, PANEL_BOUNDS.height, 8);
    Object.values(PANEL_SECTIONS).forEach((rect) => panelCard(scene, rect));

    this.roundText = makeText(scene, PX, 35, '', 20, UI.text, true);
    this.waveText = makeText(scene, PX, 65, '', 13, UI.textDim);
    makeButton(scene, 1208, 42, 72, 28, 'EXIT', cb.onHome, { fill: 0x34463c, fontSize: 10 });

    makeText(scene, PX, 92, 'THREAT', 10, UI.textDim, true);
    scene.add.rectangle(PX, 114, 370, 12, UI.panelDeep, 0.95).setOrigin(0, 0.5);
    this.gaugeFg = scene.add.rectangle(PX, 114, 0, 12, UI.accent).setOrigin(0, 0.5);
    this.gaugeText = makeText(scene, 1190, 105, '', 13, UI.text, true);

    this.goldText = makeText(scene, PX, 191, '', 19, UI.gold, true);
    this.scoreText = makeText(scene, 970, 194, '', 14, UI.text, true);
    this.upgradeText = makeText(scene, PX, 222, '', 12, UI.textDim);
    this.upgradeBtn = makeButton(scene, 1182, 216, 126, 34, '강화', cb.onUpgrade, { fontSize: 12 });

    makeText(scene, PX, 266, 'ARMY', 10, UI.textDim, true);
    this.pendingText = makeText(scene, PX, 283, '', 12, UI.accentText, true);
    this.unitName = makeText(scene, PX, 304, '', 15, UI.text, true);
    this.unitStats = makeText(scene, PX, 326, '', 11, UI.textDim).setWordWrapWidth(432, true).setLineSpacing(-2);
    this.sellBtn = makeButton(scene, 846, 360, 96, 32, '판매', cb.onSell, { fill: UI.danger, fontSize: 11 });
    this.moveBtn = makeButton(scene, 951, 360, 96, 32, '재배치', cb.onMove, { fontSize: 11 });
    this.fuseBtn = makeButton(scene, 1098, 360, 174, 32, '동일 3기 합성', cb.onFuse, { fill: 0x9f74cf, fontSize: 11 });

    this.startBtn = makeButton(scene, 1022, 424, 432, 48, '전투 시작  ▶', cb.onStart, { fontSize: 17 });
    SPEEDS.forEach((n, index) => {
      this.speedBtns.push(
        makeButton(scene, 831 + index * 78, 414, 68, 34, `×${n}`, () => cb.onSpeed(n), { fontSize: 12 }),
      );
    });
    this.pauseBtn = makeButton(scene, 1092, 414, 96, 34, '일시정지', cb.onPause, { fill: 0x5d91c5, fontSize: 11 });
    this.soundBtn = makeButton(scene, 1200, 414, 88, 34, 'SOUND', cb.onSound, { fill: 0x34463c, fontSize: 10 });
    this.combatText = makeText(scene, PX, 441, '', 11, UI.textDim);

    makeText(scene, PX, 560, 'RELIC BUILD', 10, UI.textDim, true);
    this.relicText = makeText(scene, PX, 580, '', 11, UI.textDim).setWordWrapWidth(430, true).setLineSpacing(2);

    this.helpText = makeText(
      scene, PX, 638,
      'Q/W/R/T 무늬 스킬  ·  1/2/4 배속  ·  SPACE 정지\n카드 → 유닛+스킬  ·  동일 유닛 3기 → 상위 합성\n필드 한도를 넘기기 전에 60라운드를 지키세요',
      11, UI.textDim,
    );
    this.helpText.setLineSpacing(4);
  }

  refresh(
    selectedUnit: Unit | null,
    speed: number,
    paused: boolean,
    soundEnabled: boolean,
    mode: RunMode,
  ): void {
    const g = this.game;
    const inPrep = g.phase === 'prep';

    this.roundText.setText(`ROUND ${g.round} / ${ROUNDS}   ·   ${mode === 'daily' ? 'DAILY' : 'STANDARD'}`);
    const wave = g.nextWave();
    this.waveText.setText(
      inPrep
        ? `다음 웨이브: ${wave.name} ×${wave.count}${wave.kind === 'boss' ? '  ⚠ 보스' : ''}`
        : `웨이브 진행: ${wave.name}`,
    );

    const alive = aliveEnemies(g.field).length;
    const ratio = Math.min(1, alive / g.fieldCap);
    this.gaugeFg.width = 370 * ratio;
    this.gaugeFg.setFillStyle(ratio > 0.75 ? UI.danger : ratio > 0.5 ? 0xe0a33c : UI.accent);
    this.gaugeText.setText(`${alive} / ${g.fieldCap}`);

    this.goldText.setText(`G  ${g.gold.toLocaleString()}`);
    this.scoreText.setText(`SCORE  ${g.score.toLocaleString()}`);

    this.upgradeText.setText(
      `공격 강화 Lv${g.upgradeLevel} · ×${g.dmgMult.toFixed(2)}   |   다음 이자 +${g.interestNow}G`,
    );
    this.upgradeBtn.setLabel(`강화 ${g.upgradeCostNow}G`);
    this.upgradeBtn.setEnabled(inPrep && g.gold >= g.upgradeCostNow);

    if (g.pendingUnits.length > 0) {
      const names = g.pendingUnits.slice(0, 3).map((t) => UNIT_DEFS[t].name).join(', ');
      const extra = g.pendingUnits.length > 3 ? ` 외 ${g.pendingUnits.length - 3}` : '';
      this.pendingText.setText(`배치 대기 ${g.field.units.length}/${UNIT_CAP}  ·  ${names}${extra}`);
    } else {
      this.pendingText.setText(`배치 유닛 ${g.field.units.length} / ${UNIT_CAP}`);
    }

    if (selectedUnit) {
      const def = UNIT_DEFS[selectedUnit.tier];
      this.unitName.setText(`${def.name}  ·  ${HAND_NAMES_KO[def.tier]}`);
      this.unitStats.setText(
        `DPS ${def.dps} × ${g.dmgMult.toFixed(2)}  ·  사거리 ${def.range}타일  ·  ${traitLabel(def)}`,
      );
      this.sellBtn.setLabel(`판매 +${SELL_REFUND[selectedUnit.tier]}G`);
      this.sellBtn.setEnabled(inPrep);
      this.moveBtn.setEnabled(inPrep);
      this.fuseBtn.setEnabled(inPrep && g.fusionCandidates(selectedUnit.tier).length >= 3);
    } else {
      this.unitName.setText('—');
      this.unitStats.setText('필드의 유닛을 클릭해 선택');
      this.sellBtn.setEnabled(false);
      this.moveBtn.setEnabled(false);
      this.fuseBtn.setEnabled(false);
    }

    this.startBtn.container.setVisible(inPrep);
    this.startBtn.setEnabled(inPrep && this.game.handConfirmed);
    for (let i = 0; i < SPEEDS.length; i++) {
      const value = SPEEDS[i];
      this.speedBtns[i].container.setVisible(!inPrep && g.phase === 'combat');
      this.speedBtns[i].setLabel(speed === value ? `×${value} ●` : `×${value}`);
    }
    this.pauseBtn.container.setVisible(g.phase === 'combat');
    this.pauseBtn.setLabel(paused ? '계속하기' : '일시정지');
    this.soundBtn.container.setVisible(g.phase === 'combat');
    this.soundBtn.setLabel(soundEnabled ? 'SOUND ON' : 'SOUND OFF');
    this.combatText.setText(g.phase === 'combat' ? '시간 종료 시 생존한 적은 다음 라운드로 이월됩니다' : '');
    this.combatText.setVisible(g.phase === 'combat');
    const relics = g.relics.map((id) => `${RELIC_DEFS[id].glyph} ${RELIC_DEFS[id].name}`).join('  ·  ');
    this.relicText.setText(relics || '—  보스 라운드를 넘기면 새 유물을 선택합니다');
  }
}
