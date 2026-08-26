import Phaser from 'phaser';
import { Game } from '../core/game';
import { Unit, aliveEnemies } from '../core/combat';
import { UNIT_DEFS, UnitDef } from '../core/units';
import { HAND_NAMES_KO } from '../core/cards/types';
import { ROUNDS, SELL_REFUND, UNIT_CAP } from '../core/balance';
import { RELIC_DEFS } from '../core/relics';
import { RunMode } from '../meta/profile';
import { Button, UI, makeButton, makeText } from './ui';

const PX = 800; // 패널 콘텐츠 x
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

/** 우측 정보/컨트롤 패널 */
export class SidePanel {
  private game: Game;
  private roundText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private gaugeFg: Phaser.GameObjects.Rectangle;
  private gaugeText: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
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

    scene.add.rectangle(780, 16, 484, 688, UI.panel).setOrigin(0, 0).setStrokeStyle(1, UI.panelLine);

    this.roundText = makeText(scene, PX, 36, '', 22, UI.text, true);
    this.waveText = makeText(scene, PX, 66, '', 14, UI.textDim);
    makeButton(scene, 1208, 42, 88, 30, '나가기', cb.onHome, { fill: 0x42544a, fontSize: 11 });

    makeText(scene, PX, 96, '필드 적', 13, UI.textDim);
    scene.add.rectangle(PX, 118, 360, 14, 0x000000, 0.5).setOrigin(0, 0.5);
    this.gaugeFg = scene.add.rectangle(PX, 118, 0, 14, UI.accent).setOrigin(0, 0.5);
    this.gaugeText = makeText(scene, PX + 372, 110, '', 14, UI.text, true);

    this.goldText = makeText(scene, PX, 142, '', 20, UI.gold, true);
    makeText(scene, PX + 150, 148, '(라운드 시작 시 이자 10%, 최대 50G)', 12, UI.textDim);

    this.upgradeText = makeText(scene, PX, 182, '', 15, UI.text);
    this.upgradeBtn = makeButton(scene, 1174, 190, 150, 38, '강화', cb.onUpgrade);

    this.pendingText = makeText(scene, PX, 224, '', 14, UI.accentText);

    scene.add.rectangle(780, 258, 484, 1, UI.panelLine).setOrigin(0, 0);

    makeText(scene, PX, 272, '선택 유닛', 13, UI.textDim);
    this.unitName = makeText(scene, PX, 292, '', 17, UI.text, true);
    this.unitStats = makeText(scene, PX, 318, '', 13, UI.textDim);
    this.sellBtn = makeButton(scene, 846, 368, 100, 38, '판매', cb.onSell, { fill: UI.danger });
    this.moveBtn = makeButton(scene, 956, 368, 100, 38, '재배치', cb.onMove);
    this.fuseBtn = makeButton(scene, 1096, 368, 158, 38, '동일 3기 합성', cb.onFuse, { fill: 0xb781dc });

    scene.add.rectangle(780, 406, 484, 1, UI.panelLine).setOrigin(0, 0);

    this.startBtn = makeButton(scene, 1022, 452, 440, 52, '전투 시작 ▶', cb.onStart, { fontSize: 18 });
    SPEEDS.forEach((n, index) => {
      this.speedBtns.push(
        makeButton(scene, 838 + index * 84, 452, 72, 38, `×${n}`, () => cb.onSpeed(n)),
      );
    });
    this.pauseBtn = makeButton(scene, 1100, 452, 96, 38, '일시정지', cb.onPause, { fill: 0x6ca4d9, fontSize: 12 });
    this.soundBtn = makeButton(scene, 1204, 452, 88, 38, 'SOUND', cb.onSound, { fill: 0x42544a, fontSize: 11 });
    this.combatText = makeText(scene, PX, 486, '', 13, UI.textDim);
    this.relicText = makeText(scene, PX, 510, '', 12, UI.textDim);

    this.helpText = makeText(
      scene, PX, 620,
      'Q/W/R/T = 무늬 스킬 · 1/2/4 = 배속 · SPACE = 정지\n카드로 유닛과 스킬을 얻고, 동일 유닛 3기로 합성\n적이 80마리를 넘으면 패배합니다',
      12, UI.textDim,
    );
    this.helpText.setLineSpacing(6);
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
    this.gaugeFg.width = 360 * ratio;
    this.gaugeFg.setFillStyle(ratio > 0.75 ? UI.danger : ratio > 0.5 ? 0xe0a33c : UI.accent);
    this.gaugeText.setText(`${alive} / ${g.fieldCap}`);

    this.goldText.setText(`골드 ${g.gold.toLocaleString()}    점수 ${g.score.toLocaleString()}`);

    this.upgradeText.setText(
      `공격력 강화 Lv ${g.upgradeLevel}  (현재 ×${g.dmgMult.toFixed(2)})`,
    );
    this.upgradeBtn.setLabel(`강화 ${g.upgradeCostNow}G`);
    this.upgradeBtn.setEnabled(inPrep && g.gold >= g.upgradeCostNow);

    if (g.pendingUnits.length > 0) {
      const names = g.pendingUnits.map((t) => UNIT_DEFS[t].name).join(', ');
      this.pendingText.setText(`배치 대기 (${g.field.units.length}/${UNIT_CAP}): ${names}`);
    } else {
      this.pendingText.setText(`배치 유닛 ${g.field.units.length} / ${UNIT_CAP}`);
    }

    if (selectedUnit) {
      const def = UNIT_DEFS[selectedUnit.tier];
      this.unitName.setText(`${def.name}  ·  ${HAND_NAMES_KO[def.tier]}`);
      this.unitStats.setText(
        `DPS ${def.dps} × 강화 ×${g.dmgMult.toFixed(2)}  ·  사거리 ${def.range}타일  ·  ${traitLabel(def)}`,
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
    this.combatText.setText(g.phase === 'combat' ? '적 전멸 또는 시간 경과 시 라운드 종료 · 생존한 적은 이월' : '');
    this.combatText.setVisible(g.phase === 'combat');
    const relics = g.relics.map((id) => `${RELIC_DEFS[id].glyph} ${RELIC_DEFS[id].name}`).join('  ·  ');
    this.relicText.setText(relics ? `유물  ${relics}` : '유물  —  보스를 꺾으면 선택');
    this.relicText.setWordWrapWidth(440, true);
  }
}
