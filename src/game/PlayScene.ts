import Phaser from 'phaser';
import { Game, Phase } from '../core/game';
import { TickResult, enemyPos, unitPos } from '../core/combat';
import { UNIT_DEFS } from '../core/units';
import { HAND_NAMES_KO, HandRank } from '../core/cards/types';
import { TICK_RATE } from '../core/balance';
import { FieldRenderer, Fx, tileAtScreen } from './FieldRenderer';
import { HandBar } from './HandBar';
import { SidePanel } from './SidePanel';
import { FONT, UI, makeButton, makeText } from './ui';
import { RELIC_DEFS } from '../core/relics';
import { loadProfile, Profile, recordRun, RunMode, saveProfile } from '../meta/profile';
import { AudioManager } from './AudioManager';
import { TutorialOverlay } from './TutorialOverlay';

const DT = 1 / TICK_RATE;

export class PlayScene extends Phaser.Scene {
  private core!: Game;
  private fieldView!: FieldRenderer;
  private handBar!: HandBar;
  private panel!: SidePanel;

  private seedValue = 1;
  private speed = 1;
  private acc = 0;
  private fx: Fx[] = [];
  private selectedUnitId: number | null = null;
  private moving = false;
  private ended = false;
  private paused = false;
  private mode: RunMode = 'standard';
  private profile!: Profile;
  private audio!: AudioManager;
  private tutorialActive = false;
  private relicOverlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('play');
  }

  init(data: { seed?: number; mode?: RunMode }): void {
    this.seedValue = data.seed ?? Date.now() >>> 0;
    this.mode = data.mode ?? 'standard';
  }

  create(): void {
    this.core = new Game(this.seedValue);
    this.speed = 1;
    this.acc = 0;
    this.fx = [];
    this.selectedUnitId = null;
    this.moving = false;
    this.ended = false;
    this.paused = false;
    this.relicOverlay = null;
    this.profile = loadProfile(localStorage);
    this.audio = new AudioManager(this.profile.soundEnabled);

    this.fieldView = new FieldRenderer(this);
    this.handBar = new HandBar(this, this.core, (action) => this.onHandAction(action));
    this.panel = new SidePanel(this, this.core, {
      onStart: () => {
        const boss = this.core.nextWave().kind === 'boss';
        if (this.core.startCombat()) {
          this.audio.play(boss ? 'boss' : 'click');
          this.refreshUI();
        }
      },
      onSpeed: (n) => {
        this.speed = n;
        this.refreshUI();
      },
      onUpgrade: () => {
        if (this.core.buyUpgrade()) this.audio.play('click');
        this.refreshUI();
      },
      onSell: () => {
        if (this.selectedUnitId !== null) {
          if (this.core.sellUnit(this.selectedUnitId)) {
            this.audio.play('click');
            this.selectedUnitId = null;
            this.moving = false;
          }
          this.refreshUI();
        }
      },
      onMove: () => {
        if (this.selectedUnitId !== null && this.core.phase === 'prep') {
          this.moving = true;
          this.refreshUI();
        }
      },
      onFuse: () => this.fuseSelected(),
      onPause: () => this.togglePause(),
      onSound: () => this.toggleSound(),
      onHome: () => this.scene.start('menu'),
    });

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length > 0 || this.ended) return;
        this.onFieldClick(pointer.x, pointer.y);
      },
    );

    this.refreshUI();
    this.bindKeys();
    if (!this.profile.tutorialDone) {
      this.tutorialActive = true;
      new TutorialOverlay(this, () => {
        this.tutorialActive = false;
        this.profile.tutorialDone = true;
        saveProfile(localStorage, this.profile);
        this.audio.play('confirm');
      });
    }
    // E2E/디버그용 훅
    (window as unknown as { __game?: Game }).__game = this.core;
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.core.phase === 'combat' && !this.paused) this.stepCombat(dt);
    this.fieldView.update(this.core, this.selectedUnitId, this.isPlacing(), this.fx, dt);
    this.syncRelicPicker();
  }

  private stepCombat(dt: number): void {
    this.acc += dt * this.speed;
    let guard = 0;
    while (this.acc >= DT && this.core.phase === 'combat' && guard++ < 200) {
      const result = this.core.tickCombat(DT);
      if (result) this.collectFx(result);
      this.acc -= DT;
    }
    const phaseNow: Phase = this.core.phase;
    if (phaseNow === 'prep') this.acc = 0;
    if ((phaseNow === 'victory' || phaseNow === 'defeat') && !this.ended) {
      this.showEnd();
    }
    this.refreshUI();
  }

  // ── 입력 ──────────────────────────────────────────

  private isPlacing(): boolean {
    return (this.core.phase === 'prep' && this.core.pendingUnits.length > 0) || this.moving;
  }

  private onFieldClick(px: number, py: number): void {
    const t = tileAtScreen(px, py);
    if (!t) {
      this.selectUnit(null);
      return;
    }
    if (this.core.phase === 'prep' && this.moving && this.selectedUnitId !== null) {
      if (this.core.moveUnit(this.selectedUnitId, t.tx, t.ty)) {
        this.audio.play('click');
        this.moving = false;
        this.refreshUI();
        return;
      }
    }
    const unit = this.core.unitAt(t.tx, t.ty);
    if (unit) {
      this.selectUnit(unit.id);
      return;
    }
    if (this.core.phase === 'prep' && this.core.pendingUnits.length > 0) {
      if (this.core.placeUnit(t.tx, t.ty)) {
        this.audio.play('click');
        this.refreshUI();
        return;
      }
    }
    this.selectUnit(null);
  }

  private selectUnit(id: number | null): void {
    this.selectedUnitId = id;
    this.moving = false;
    this.refreshUI();
  }

  // ── UI 동기화 ─────────────────────────────────────

  private refreshUI(): void {
    const selected =
      this.selectedUnitId === null
        ? null
        : this.core.field.units.find((u) => u.id === this.selectedUnitId) ?? null;
    if (!selected) this.selectedUnitId = null;
    this.handBar.refresh();
    this.panel.refresh(selected, this.speed, this.paused, this.audio.enabled, this.mode);
    this.syncRelicPicker();
  }

  private onHandAction(action: 'hold' | 'exchange' | 'confirm'): void {
    this.audio.play(action === 'confirm' ? 'confirm' : action === 'exchange' ? 'card' : 'click');
    const rank = this.core.lastHandRank;
    if (this.core.handConfirmed && rank !== null && rank >= HandRank.FullHouse) {
      this.celebrate(rank);
    }
    this.refreshUI();
  }

  private fuseSelected(): void {
    if (this.selectedUnitId === null) return;
    const selected = this.core.field.units.find((unit) => unit.id === this.selectedUnitId);
    if (!selected) return;
    const others = this.core.fusionCandidates(selected.tier).filter((id) => id !== selected.id);
    if (this.core.fuseUnits([selected.id, ...others.slice(0, 2)])) {
      this.selectedUnitId = null;
      this.audio.play('fuse');
      this.flashCenter(`${UNIT_DEFS[(selected.tier + 1) as HandRank].name} 합성!`, 0xb781dc);
      this.refreshUI();
    }
  }

  private togglePause(): void {
    if (this.core.phase !== 'combat') return;
    this.paused = !this.paused;
    this.audio.play('click');
    this.refreshUI();
  }

  private toggleSound(): void {
    this.audio.setEnabled(!this.audio.enabled);
    this.profile.soundEnabled = this.audio.enabled;
    saveProfile(localStorage, this.profile);
    if (this.audio.enabled) this.audio.play('click');
    this.refreshUI();
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-E', () => {
      if (this.tutorialActive || this.ended) return;
      if (this.core.doExchange()) this.onHandAction('exchange');
    });
    keyboard.on('keydown-ENTER', () => {
      if (this.tutorialActive || this.ended) return;
      if (this.core.confirmHand() !== null) this.onHandAction('confirm');
    });
    keyboard.on('keydown-SPACE', () => {
      if (this.tutorialActive || this.ended) return;
      if (this.core.phase === 'combat') this.togglePause();
      else if (this.core.startCombat()) {
        this.audio.play(this.core.nextWave().kind === 'boss' ? 'boss' : 'click');
        this.refreshUI();
      }
    });
    for (const n of [1, 2, 3]) {
      keyboard.on(`keydown-${n}`, () => {
        if (this.core.phase === 'combat') {
          this.speed = n;
          this.refreshUI();
        }
      });
    }
    keyboard.on('keydown-M', () => this.toggleSound());
  }

  private syncRelicPicker(): void {
    if (this.core.relicChoices.length === 0 || this.relicOverlay || this.ended) return;
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(390, 270, 748, 520, 0x06100a, 0.93).setInteractive();
    children.push(dim);
    const title = makeText(this, 390, 102, '보스 격파 · 유물을 선택하세요', 28, UI.gold, true).setOrigin(0.5);
    children.push(title);
    this.core.relicChoices.forEach((id, index) => {
      const def = RELIC_DEFS[id];
      const x = 176 + index * 214;
      const card = this.add.rectangle(x, 278, 188, 240, UI.panel, 1)
        .setStrokeStyle(2, def.color, 0.9).setInteractive({ useHandCursor: true });
      const glyph = makeText(this, x, 210, def.glyph, 44, `#${def.color.toString(16).padStart(6, '0')}`, true).setOrigin(0.5);
      const name = makeText(this, x, 278, def.name, 17, UI.text, true).setOrigin(0.5);
      const desc = makeText(this, x, 318, def.description, 13, UI.textDim).setOrigin(0.5).setAlign('center');
      desc.setWordWrapWidth(154, true);
      card.on('pointerdown', () => {
        if (!this.core.chooseRelic(id)) return;
        this.audio.play('relic');
        this.relicOverlay?.destroy(true);
        this.relicOverlay = null;
        this.flashCenter(`${def.name} 획득`, def.color);
        this.refreshUI();
      });
      children.push(card, glyph, name, desc);
    });
    this.relicOverlay = this.add.container(0, 0, children).setDepth(18);
  }

  private flashCenter(labelText: string, color: number): void {
    const label = makeText(this, 390, 270, labelText, 30, `#${color.toString(16).padStart(6, '0')}`, true)
      .setOrigin(0.5).setDepth(16).setShadow(0, 3, '#000000', 8);
    this.tweens.add({
      targets: label, y: 230, alpha: 0, duration: 1200, ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private celebrate(rank: HandRank): void {
    const label = makeText(this, 390, 280, HAND_NAMES_KO[rank] + '!', 44, UI.gold, true)
      .setOrigin(0.5)
      .setDepth(10)
      .setScale(0.4)
      .setShadow(0, 3, '#000000', 8);
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 350,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          y: 240,
          delay: 900,
          duration: 500,
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  private collectFx(result: TickResult): void {
    const max = 40;
    for (const atk of result.attacks) {
      if (this.fx.length >= max) break;
      const unit = this.core.field.units.find((u) => u.id === atk.unitId);
      const enemy = this.core.field.enemies.find((e) => e.id === atk.targetId);
      if (!unit || !enemy) continue;
      const from = unitPos(unit);
      const to = enemyPos(enemy);
      this.fx.push({
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        ttl: 0.08,
        color: UNIT_DEFS[unit.tier].color,
      });
    }
  }

  // ── 종료 ──────────────────────────────────────────

  private showEnd(): void {
    this.ended = true;
    const won = this.core.phase === 'victory';
    this.audio.play(won ? 'win' : 'lose');
    this.profile = recordRun(this.profile, this.core.summary(), this.mode, this.localDate());
    saveProfile(localStorage, this.profile);
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.72).setDepth(20);
    this.add
      .text(640, 280, won ? '승리!' : '패배…', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold',
        color: won ? UI.gold : UI.dangerText,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(640, 350, won ? '60라운드를 모두 방어했습니다' : `라운드 ${this.core.round}에서 필드가 뚫렸습니다`, {
        fontFamily: FONT, fontSize: '20px', color: UI.text,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(640, 392, `SCORE  ${this.core.score.toLocaleString()}   ·   KILLS  ${this.core.kills.toLocaleString()}`, {
        fontFamily: FONT, fontSize: '18px', color: UI.gold,
      })
      .setOrigin(0.5)
      .setDepth(21);
    const btn = makeButton(this, 640, 430, 220, 52, '다시 시작', () => {
      const nextSeed = this.mode === 'daily' ? this.seedValue : (this.seedValue * 31 + 17) >>> 0;
      this.scene.restart({ seed: nextSeed, mode: this.mode });
    }, { fontSize: 18 });
    btn.container.setDepth(22);
    const home = makeButton(this, 640, 500, 180, 42, '메인으로', () => this.scene.start('menu'), { fill: 0x42544a });
    home.container.setDepth(22);
  }

  private localDate(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }
}
