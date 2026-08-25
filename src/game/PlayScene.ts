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

  constructor() {
    super('play');
  }

  init(data: { seed?: number }): void {
    this.seedValue = data.seed ?? Date.now() >>> 0;
  }

  create(): void {
    this.core = new Game(this.seedValue);
    this.speed = 1;
    this.acc = 0;
    this.fx = [];
    this.selectedUnitId = null;
    this.moving = false;
    this.ended = false;

    this.fieldView = new FieldRenderer(this);
    this.handBar = new HandBar(this, this.core, () => this.onHandAction());
    this.panel = new SidePanel(this, this.core, {
      onStart: () => {
        if (this.core.startCombat()) this.refreshUI();
      },
      onSpeed: (n) => {
        this.speed = n;
        this.refreshUI();
      },
      onUpgrade: () => {
        this.core.buyUpgrade();
        this.refreshUI();
      },
      onSell: () => {
        if (this.selectedUnitId !== null) {
          this.core.sellUnit(this.selectedUnitId);
          this.selectedUnitId = null;
          this.moving = false;
          this.refreshUI();
        }
      },
      onMove: () => {
        if (this.selectedUnitId !== null && this.core.phase === 'prep') {
          this.moving = true;
          this.refreshUI();
        }
      },
    });

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length > 0 || this.ended) return;
        this.onFieldClick(pointer.x, pointer.y);
      },
    );

    this.refreshUI();
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.core.phase === 'combat') this.stepCombat(dt);
    this.fieldView.update(this.core, this.selectedUnitId, this.isPlacing(), this.fx, dt);
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
    this.panel.refresh(selected, this.speed);
  }

  private onHandAction(): void {
    const rank = this.core.lastHandRank;
    if (this.core.handConfirmed && rank !== null && rank >= HandRank.FullHouse) {
      this.celebrate(rank);
    }
    this.refreshUI();
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
    const btn = makeButton(this, 640, 430, 220, 52, '다시 시작', () => {
      this.scene.restart({ seed: (this.seedValue * 31 + 17) >>> 0 });
    }, { fontSize: 18 });
    btn.container.setDepth(22);
  }
}
