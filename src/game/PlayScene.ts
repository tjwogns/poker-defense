import Phaser from 'phaser';
import { DeckSealId, Game, Phase } from '../core/game';
import { Enemy, TickResult, enemyPos, unitPos } from '../core/combat';
import { UNIT_DEFS } from '../core/units';
import { Card, HAND_NAMES_KO, HandRank, RANK_LABELS, SUIT_GLYPHS, Suit } from '../core/cards/types';
import { SUIT_POWER_DEFS } from '../core/abilities';
import { TICK_RATE } from '../core/balance';
import { FIELD_X, FIELD_Y, FieldRenderer, Fx, tileAtScreen } from './FieldRenderer';
import { HandBar } from './HandBar';
import { SidePanel } from './SidePanel';
import { FONT, UI, makeButton, makeText } from './ui';
import { RELIC_DEFS } from '../core/relics';
import {
  dailyDate, ensureLeaderboardIdentity, loadProfile, Profile, recordRun, RunMode, saveProfile,
} from '../meta/profile';
import { AudioManager } from './AudioManager';
import { TutorialOverlay } from './TutorialOverlay';
import { SuitPowerBar } from './SuitPowerBar';
import { BossHud } from './BossHud';
import { downloadShareCard, shareRun } from './ShareCard';
import { GuideOverlay } from './GuideOverlay';
import { ExitConfirmOverlay } from './ExitConfirmOverlay';
import { Analytics, getAnalytics } from '../meta/analytics';
import { tileCanReachPath } from '../core/map';
import { leaderboardConfigured, submitDailyScore } from '../meta/leaderboard';
import { SYNERGY_DEFS, UnitFamily } from '../core/synergies';
import { safeFrameDelta } from './timing';
import { OddsOverlay } from './OddsOverlay';
import { RerollOdds } from '../core/cards/odds';
import { analyzeDefeat, DefeatAnalysis } from '../meta/defeatAnalysis';
import { DeckOverlay } from './DeckOverlay';

const DT = 1 / TICK_RATE;

export class PlayScene extends Phaser.Scene {
  private core!: Game;
  private fieldView!: FieldRenderer;
  private handBar!: HandBar;
  private panel!: SidePanel;
  private powerBar!: SuitPowerBar;
  private bossHud!: BossHud;

  private seedValue = 1;
  private speed = 1;
  private acc = 0;
  private fx: Fx[] = [];
  private damageLabelShownThisFrame = false;
  private cameraShakenThisFrame = false;
  private selectedUnitId: number | null = null;
  private moving = false;
  private ended = false;
  private paused = false;
  private mode: RunMode = 'standard';
  private runDate = '';
  private profile!: Profile;
  private audio!: AudioManager;
  private tutorialActive = false;
  private relicOverlay: Phaser.GameObjects.Container | null = null;
  private guideOverlay: GuideOverlay | null = null;
  private oddsOverlay: OddsOverlay | null = null;
  private deckOverlay: DeckOverlay | null = null;
  private guideWasPaused = false;
  private deckWasPaused = false;
  private exitOverlay: ExitConfirmOverlay | null = null;
  private exitWasPaused = false;
  private synergyLevels = new Map<UnitFamily, number>();
  private analytics!: Analytics;
  private runId = '';
  private runStartedAt = 0;
  private lastTrackedRound = 1;
  private firstCombatTracked = false;
  private trackedBossEncounters = new Set<number>();
  private trackedBossDefeats = new Set<number>();
  private trackedBossSurvivals = new Set<number>();
  private bossFirstSeenAt = new Map<number, number>();
  private abandonedTracked = false;
  private pageHideHandler!: () => void;
  private visibilityHandler!: () => void;
  private windowBlurHandler!: () => void;
  private windowFocusHandler!: () => void;
  private backgroundPaused = false;
  private backgroundSpeed = 1;

  constructor() {
    super('play');
  }

  init(data: { seed?: number; mode?: RunMode; date?: string; retry?: boolean }): void {
    this.seedValue = data.seed ?? Date.now() >>> 0;
    this.mode = data.mode ?? 'standard';
    this.runDate = data.date ?? dailyDate();
    this.analytics = getAnalytics();
    this.runId = this.analytics.beginRun({ mode: this.mode, retry: data.retry ?? false });
    this.runStartedAt = performance.now();
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
    this.guideOverlay = null;
    this.oddsOverlay = null;
    this.deckOverlay = null;
    this.guideWasPaused = false;
    this.deckWasPaused = false;
    this.exitOverlay = null;
    this.exitWasPaused = false;
    this.synergyLevels.clear();
    this.lastTrackedRound = 1;
    this.firstCombatTracked = false;
    this.trackedBossEncounters.clear();
    this.trackedBossDefeats.clear();
    this.trackedBossSurvivals.clear();
    this.bossFirstSeenAt.clear();
    this.abandonedTracked = false;
    this.backgroundPaused = false;
    this.backgroundSpeed = 1;
    this.profile = ensureLeaderboardIdentity(loadProfile(localStorage));
    saveProfile(localStorage, this.profile);
    this.audio = new AudioManager(this.profile.soundEnabled);

    this.fieldView = new FieldRenderer(this);
    this.handBar = new HandBar(
      this,
      this.core,
      (action) => this.onHandAction(action),
      (odds) => this.openOdds(odds),
    );
    this.panel = new SidePanel(this, this.core, {
      onStart: () => {
        const boss = this.core.nextWave().kind === 'boss';
        if (this.core.startCombat()) {
          this.trackCombatStarted();
          this.audio.play(boss ? 'boss' : 'click');
          this.refreshUI();
        }
      },
      onSpeed: (n) => {
        this.speed = n;
        this.refreshUI();
      },
      onUpgrade: () => {
        const cost = this.core.upgradeCostNow;
        if (this.core.buyUpgrade()) {
          this.audio.play('click');
          this.analytics.track('upgrade_bought', {
            round: this.core.round,
            level: this.core.upgradeLevel,
            cost,
            goldAfter: this.core.gold,
          }, this.runId);
        }
        this.refreshUI();
      },
      onSell: () => {
        if (this.selectedUnitId !== null) {
          if (this.core.sellUnit(this.selectedUnitId)) {
            this.audio.play('click');
            this.selectedUnitId = null;
            this.moving = false;
            this.syncSynergyFeedback();
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
      onHome: () => this.requestExit(),
      onGuide: () => this.openGuide(),
      onDeck: () => this.openDeck(),
    });
    this.powerBar = new SuitPowerBar(this, this.core, (suit) => this.usePower(suit));
    this.bossHud = new BossHud(this);

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
      new TutorialOverlay(this, (result) => {
        this.tutorialActive = false;
        this.profile.tutorialDone = true;
        saveProfile(localStorage, this.profile);
        this.analytics.track('tutorial_finished', { result }, this.runId);
        this.audio.play('confirm');
      });
    }
    this.pageHideHandler = () => this.trackAbandoned('page_hidden');
    window.addEventListener('pagehide', this.pageHideHandler);
    this.windowBlurHandler = () => {
      this.acc = 0;
      this.backgroundSpeed = this.speed;
      if (this.core.phase === 'combat' && !this.paused && !this.backgroundPaused) {
        this.paused = true;
        this.backgroundPaused = true;
        this.analytics.track('background_pause', {
          round: this.core.round,
          speed: this.speed,
        }, this.runId);
      }
    };
    this.windowFocusHandler = () => {
      this.acc = 0;
      this.speed = this.backgroundSpeed;
      if (this.backgroundPaused) {
        this.backgroundPaused = false;
        this.flashCenter(`게임 일시정지 · ×${this.speed} 유지 · SPACE로 계속`, 0xe6c84f);
        this.refreshUI();
      }
    };
    this.visibilityHandler = () => {
      if (document.hidden) this.windowBlurHandler();
      else this.windowFocusHandler();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('blur', this.windowBlurHandler);
    window.addEventListener('focus', this.windowFocusHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pagehide', this.pageHideHandler);
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      window.removeEventListener('blur', this.windowBlurHandler);
      window.removeEventListener('focus', this.windowFocusHandler);
      this.trackAbandoned('scene_left');
    });
    // E2E/디버그용 훅
    (window as unknown as { __game?: Game }).__game = this.core;
  }

  update(_time: number, deltaMs: number): void {
    const dt = safeFrameDelta(deltaMs);
    this.damageLabelShownThisFrame = false;
    this.cameraShakenThisFrame = false;
    if (this.core.phase === 'combat' && !this.paused) this.stepCombat(dt);
    this.fieldView.update(this.core, this.selectedUnitId, this.placementTier(), this.fx, dt);
    this.bossHud.refresh(this.core);
    this.syncRelicPicker();
  }

  private stepCombat(dt: number): void {
    this.acc += dt * this.speed;
    let guard = 0;
    while (this.acc >= DT && this.core.phase === 'combat' && guard++ < 200) {
      const roundBefore = this.core.round;
      const result = this.core.tickCombat(DT);
      if (result) {
        this.collectFx(result);
        this.trackBossAnalytics(result, roundBefore);
      }
      this.acc -= DT;
    }
    const phaseNow: Phase = this.core.phase;
    if (phaseNow === 'prep') {
      this.acc = 0;
      this.trackRoundProgress();
    }
    if ((phaseNow === 'victory' || phaseNow === 'defeat') && !this.ended) {
      this.showEnd();
    }
    this.refreshUI();
  }

  // ── 입력 ──────────────────────────────────────────

  private placementTier(): HandRank | null {
    if (this.core.phase !== 'prep') return null;
    if (this.moving && this.selectedUnitId !== null) {
      return this.core.field.units.find((unit) => unit.id === this.selectedUnitId)?.tier ?? null;
    }
    return this.core.pendingUnits[0] ?? null;
  }

  private onFieldClick(px: number, py: number): void {
    const t = tileAtScreen(px, py);
    if (!t) {
      this.selectUnit(null);
      return;
    }
    if (this.core.phase === 'prep' && this.moving && this.selectedUnitId !== null) {
      const movingUnit = this.core.field.units.find((unit) => unit.id === this.selectedUnitId);
      if (movingUnit && !tileCanReachPath(t.tx, t.ty, UNIT_DEFS[movingUnit.tier].range)) {
        this.analytics.track('placement_blocked', {
          round: this.core.round,
          tier: movingUnit.tier,
          action: 'move',
        }, this.runId);
        this.flashCenter('경로가 사거리 밖입니다', UI.danger);
        return;
      }
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
      const pendingTier = this.core.pendingUnits[0];
      if (!tileCanReachPath(t.tx, t.ty, UNIT_DEFS[pendingTier].range)) {
        this.analytics.track('placement_blocked', {
          round: this.core.round,
          tier: pendingTier,
          action: 'place',
        }, this.runId);
        this.flashCenter('붉은 타일은 공격할 수 없습니다', UI.danger);
        return;
      }
      if (this.core.placeUnit(t.tx, t.ty)) {
        this.audio.play('click');
        this.syncSynergyFeedback();
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
    this.powerBar.refresh();
    this.bossHud.refresh(this.core);
    this.syncRelicPicker();
  }

  private onHandAction(action: 'hold' | 'exchange' | 'confirm'): void {
    this.audio.play(action === 'confirm' ? 'confirm' : action === 'exchange' ? 'card' : 'click');
    const rank = this.core.lastHandRank;
    if (this.core.handConfirmed && rank !== null && rank >= HandRank.FullHouse) {
      this.celebrate(rank);
    }
    if (action === 'confirm' && this.core.lastHandRank !== null) {
      this.analytics.track('hand_confirmed', {
        round: this.core.round,
        rank: this.core.lastHandRank,
        exchanges: this.core.exchangesUsed,
      }, this.runId);
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
      this.analytics.track('unit_fused', {
        round: this.core.round,
        fromTier: selected.tier,
        toTier: selected.tier + 1,
      }, this.runId);
      this.syncSynergyFeedback();
      this.refreshUI();
    }
  }

  private togglePause(): void {
    if (this.core.phase !== 'combat') return;
    this.paused = !this.paused;
    this.audio.play('click');
    this.refreshUI();
  }

  private syncSynergyFeedback(): void {
    for (const status of this.core.synergies) {
      const previous = this.synergyLevels.get(status.id) ?? 0;
      if (status.level > previous && status.activeTier) {
        const def = SYNERGY_DEFS[status.id];
        this.flashCenter(`${def.glyph} ${def.name} ${status.activeTier.count} 시너지 활성`, def.color);
        this.analytics.track('synergy_activated', {
          round: this.core.round,
          synergy: status.id,
          level: status.level,
          count: status.count,
        }, this.runId);
      }
      this.synergyLevels.set(status.id, status.level);
    }
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
      if (this.tutorialActive || this.ended || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.core.doExchange()) this.onHandAction('exchange');
    });
    keyboard.on('keydown-ENTER', () => {
      if (this.tutorialActive || this.ended || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.core.confirmHand() !== null) this.onHandAction('confirm');
    });
    keyboard.on('keydown-SPACE', () => {
      if (this.tutorialActive || this.ended || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.core.phase === 'combat') this.togglePause();
      else if (this.core.startCombat()) {
        this.trackCombatStarted();
        this.audio.play(this.core.nextWave().kind === 'boss' ? 'boss' : 'click');
        this.refreshUI();
      }
    });
    for (const [key, n] of [['ONE', 1], ['TWO', 2], ['FOUR', 4]] as const) {
      keyboard.on(`keydown-${key}`, () => {
        if (this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
        if (this.core.phase === 'combat') {
          this.speed = n;
          this.refreshUI();
        }
      });
    }
    const powers: Array<[string, Suit]> = [['Q', 'S'], ['W', 'H'], ['R', 'D'], ['T', 'C']];
    for (const [key, suit] of powers) {
      keyboard.on(`keydown-${key}`, () => {
      if (!this.oddsOverlay && !this.deckOverlay && !this.exitOverlay) this.usePower(suit);
      });
    }
    keyboard.on('keydown-M', () => {
      if (!this.guideOverlay && !this.oddsOverlay && !this.deckOverlay && !this.exitOverlay) this.toggleSound();
    });
    keyboard.on('keydown-H', () => {
      if (this.tutorialActive || this.ended || this.relicOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.guideOverlay) this.closeGuide();
      else this.openGuide();
    });
    keyboard.on('keydown-D', () => {
      if (this.tutorialActive || this.ended || this.relicOverlay || this.guideOverlay || this.oddsOverlay || this.exitOverlay) return;
      if (this.deckOverlay) this.closeDeck();
      else this.openDeck();
    });
    keyboard.on('keydown-ESC', () => {
      if (this.exitOverlay) this.closeExitConfirm();
      else if (this.oddsOverlay) this.closeOdds();
      else if (this.deckOverlay) this.closeDeck();
      else if (this.guideOverlay) this.closeGuide();
    });
  }

  private openOdds(odds: RerollOdds): void {
    if (this.oddsOverlay || this.deckOverlay || this.core.phase !== 'prep' || this.core.handConfirmed) return;
    this.oddsOverlay = new OddsOverlay(this, odds, () => this.closeOdds());
    this.analytics.track('odds_opened', {
      drawCount: odds.drawCount,
      currentRank: odds.currentRank,
      improvePercent: Math.round(odds.improveProbability * 1000) / 10,
    }, this.runId);
  }

  private closeOdds(): void {
    this.oddsOverlay?.destroy();
    this.oddsOverlay = null;
  }

  private openDeck(): void {
    if (
      this.deckOverlay || this.tutorialActive || this.ended || this.relicOverlay
      || this.guideOverlay || this.oddsOverlay || this.exitOverlay
    ) return;
    this.deckWasPaused = this.paused;
    if (this.core.phase === 'combat') this.paused = true;
    this.deckOverlay = new DeckOverlay(
      this,
      this.core,
      () => this.closeDeck(),
      (id, card) => this.onDeckChanged(id, card),
    );
    this.analytics.track('deck_opened', {
      round: this.core.round,
      deckSize: this.core.deckSize,
    }, this.runId);
    this.audio.play('click');
    this.refreshUI();
  }

  private closeDeck(): void {
    if (!this.deckOverlay) return;
    this.deckOverlay.destroy();
    this.deckOverlay = null;
    if (this.core.phase === 'combat') this.paused = this.deckWasPaused;
    this.audio.play('click');
    this.refreshUI();
  }

  private onDeckChanged(id: DeckSealId, card: Card): void {
    this.analytics.track('deck_modified', {
      round: this.core.round,
      action: id,
      card: `${card.rank}${card.suit}`,
      deckSize: this.core.deckSize,
    }, this.runId);
    this.audio.play('confirm');
    this.flashCenter(
      `${SUIT_GLYPHS[card.suit]} ${RANK_LABELS[card.rank]} ${id === 'banish' ? '추방' : '복제'}`,
      id === 'banish' ? 0xd06258 : 0x9f74cf,
    );
    this.refreshUI();
  }

  private requestExit(): void {
    if (this.ended || this.exitOverlay || this.deckOverlay) return;
    const hasProgress = this.core.phase === 'combat'
      || this.core.round > 1
      || this.core.handConfirmed
      || this.core.field.units.length > 0
      || this.core.pendingUnits.length > 0;
    if (!hasProgress) {
      this.scene.start('menu');
      return;
    }
    this.exitWasPaused = this.paused;
    if (this.core.phase === 'combat') this.paused = true;
    this.exitOverlay = new ExitConfirmOverlay(
      this,
      () => this.closeExitConfirm(),
      () => this.scene.start('menu'),
    );
    this.audio.play('click');
    this.refreshUI();
  }

  private closeExitConfirm(): void {
    if (!this.exitOverlay) return;
    this.exitOverlay.destroy();
    this.exitOverlay = null;
    if (this.core.phase === 'combat') this.paused = this.exitWasPaused;
    this.audio.play('click');
    this.refreshUI();
  }

  private openGuide(): void {
    if (this.guideOverlay || this.deckOverlay || this.tutorialActive || this.ended || this.relicOverlay || this.exitOverlay) return;
    this.guideWasPaused = this.paused;
    if (this.core.phase === 'combat') this.paused = true;
    this.guideOverlay = new GuideOverlay(this, () => this.closeGuide());
    this.audio.play('click');
    this.refreshUI();
  }

  private closeGuide(): void {
    if (!this.guideOverlay) return;
    this.guideOverlay.destroy();
    this.guideOverlay = null;
    if (this.core.phase === 'combat') this.paused = this.guideWasPaused;
    this.audio.play('click');
    this.refreshUI();
  }

  private usePower(suit: Suit): void {
    if (this.tutorialActive || this.ended || this.paused) return;
    const result = this.core.useSuitPower(suit);
    if (!result) return;
    const def = SUIT_POWER_DEFS[suit];
    const suffix = result.goldEarned > 0
      ? ` +${result.goldEarned}G`
      : result.affected > 0 ? ` ×${result.affected}` : '';
    this.audio.play('power');
    this.flashCenter(`${def.glyph} ${def.name}${suffix}`, def.color);
    if (!this.reducedMotion()) this.cameras.main.shake(90, 0.0025);
    this.refreshUI();
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
        this.analytics.track('relic_selected', {
          round: this.core.round,
          relic: id,
          relicCount: this.core.relics.length,
        }, this.runId);
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

  private flashCenter(labelText: string, color: number, depth = 16): void {
    const label = makeText(this, 390, 270, labelText, 30, `#${color.toString(16).padStart(6, '0')}`, true)
      .setOrigin(0.5).setDepth(depth).setShadow(0, 3, '#000000', 8);
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
    for (const event of result.bossEvents) {
      if (event.type === 'tax') {
        this.flashCenter(`황금 폭군  −${event.amount}G`, UI.danger);
      } else {
        this.flashCenter(`군단왕  부하 +${event.count}`, 0x8a58b5);
      }
      this.audio.play('boss');
    }
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
      if (!this.damageLabelShownThisFrame) {
        this.damageLabelShownThisFrame = true;
        const damage = makeText(
          this,
          FIELD_X + to.x,
          FIELD_Y + to.y - 12,
          Math.round(atk.damage).toLocaleString(),
          11,
          '#f5e7a8',
          true,
        ).setOrigin(0.5).setDepth(7).setShadow(0, 2, '#000000', 4);
        this.tweens.add({
          targets: damage, y: damage.y - 18, alpha: 0, duration: 430,
          onComplete: () => damage.destroy(),
        });
      }
    }
    if (result.deaths.length > 0 && !this.cameraShakenThisFrame && !this.reducedMotion()) {
      this.cameraShakenThisFrame = true;
      this.cameras.main.shake(Math.min(130, 45 + result.deaths.length * 5), 0.0014);
    }
  }

  private trackBossAnalytics(result: TickResult, roundBefore: number): void {
    const bosses = [
      ...this.core.field.enemies.filter((enemy) => enemy.kind === 'boss'),
      ...result.deaths.filter((enemy) => enemy.kind === 'boss'),
    ];
    for (const boss of bosses) this.trackBossEncounter(boss, roundBefore);

    for (const boss of result.deaths.filter((enemy) => enemy.kind === 'boss')) {
      if (this.trackedBossDefeats.has(boss.round)) continue;
      this.trackedBossDefeats.add(boss.round);
      this.analytics.track('boss_defeated', {
        bossRound: boss.round,
        resolvedRound: roundBefore,
        roundsLate: Math.max(0, roundBefore - boss.round),
        combatSecondsSinceSpawn: this.bossElapsedSeconds(boss.round),
        units: this.core.field.units.length,
        upgradeLevel: this.core.upgradeLevel,
        relicCount: this.core.relics.length,
        score: this.core.score,
      }, this.runId);
    }

    const originalBoss = this.core.field.enemies.find(
      (enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === roundBefore,
    );
    if (!originalBoss || this.trackedBossSurvivals.has(originalBoss.round)) return;

    const advancedPastBossRound = this.core.phase === 'prep' && this.core.round > roundBefore;
    const runEnded = this.core.phase === 'defeat';
    if (!advancedPastBossRound && !runEnded) return;

    this.trackedBossSurvivals.add(originalBoss.round);
    const outcome = this.core.defeatReason === 'final-boss-timeout'
      ? 'final_timeout'
      : runEnded ? 'field_cap' : 'round_timeout';
    this.analytics.track('boss_survived', {
      bossRound: originalBoss.round,
      resolvedRound: roundBefore,
      outcome,
      hpPercent: Math.max(0, Math.min(100, Math.round((originalBoss.hp / originalBoss.maxHp) * 100))),
      combatSecondsSinceSpawn: this.bossElapsedSeconds(originalBoss.round),
      units: this.core.field.units.length,
      upgradeLevel: this.core.upgradeLevel,
      relicCount: this.core.relics.length,
      score: this.core.score,
    }, this.runId);
  }

  private trackBossEncounter(boss: Enemy, currentRound: number): void {
    if (this.trackedBossEncounters.has(boss.round)) return;
    this.trackedBossEncounters.add(boss.round);
    this.bossFirstSeenAt.set(boss.round, this.core.field.time);
    this.analytics.track('boss_encountered', {
      bossRound: boss.round,
      currentRound,
      maxHp: Math.round(boss.maxHp),
      enemies: this.core.field.enemies.filter((enemy) => enemy.alive).length,
      units: this.core.field.units.length,
      upgradeLevel: this.core.upgradeLevel,
      relicCount: this.core.relics.length,
      score: this.core.score,
    }, this.runId);
  }

  private bossElapsedSeconds(bossRound: number): number {
    const startedAt = this.bossFirstSeenAt.get(bossRound) ?? this.core.field.time;
    return Math.max(0, Math.round(this.core.field.time - startedAt));
  }

  // ── 종료 ──────────────────────────────────────────

  private showEnd(): void {
    this.ended = true;
    this.abandonedTracked = true;
    const won = this.core.phase === 'victory';
    const endMessage = won
      ? '최종 보스를 격파하고 왕좌를 지켰습니다'
      : this.core.defeatReason === 'final-boss-timeout'
        ? '제한시간 안에 최종 보스를 격파하지 못했습니다'
        : `라운드 ${this.core.round}에서 필드가 뚫렸습니다`;
    this.audio.play(won ? 'win' : 'lose');
    this.profile = recordRun(this.profile, this.core.summary(), this.mode, this.runDate);
    saveProfile(localStorage, this.profile);
    const analysis = won ? null : analyzeDefeat({
      reason: this.core.defeatReason,
      round: this.core.round,
      fieldCap: this.core.fieldCap,
      enemies: this.core.field.enemies,
      unitTiers: this.core.field.units.map((unit) => unit.tier),
      upgradeLevel: this.core.upgradeLevel,
      bestHand: this.core.bestHand,
      relicCount: this.core.relics.length,
      powerCharges: this.core.powerCharges,
    });
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.72).setDepth(20);
    this.add
      .text(640, won ? 280 : 96, won ? '승리!' : '패배 분석', {
        fontFamily: FONT, fontSize: won ? '56px' : '42px', fontStyle: 'bold',
        color: won ? UI.gold : UI.dangerText,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(640, won ? 350 : 154, endMessage, {
        fontFamily: FONT, fontSize: '20px', color: UI.text,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(640, won ? 392 : 194, `SCORE  ${this.core.score.toLocaleString()}   ·   KILLS  ${this.core.kills.toLocaleString()}`, {
        fontFamily: FONT, fontSize: '18px', color: UI.gold,
      })
      .setOrigin(0.5)
      .setDepth(21);
    if (analysis) this.renderDefeatAnalysis(analysis);
    const summary = this.core.summary();
    this.analytics.track('run_finished', {
      mode: this.mode,
      result: summary.result,
      round: summary.round,
      score: summary.score,
      kills: summary.kills,
      bestHand: summary.bestHand,
      upgradeLevel: summary.upgradeLevel,
      relics: [...summary.relics],
      durationSeconds: this.elapsedSeconds(),
      ...(analysis ? {
        defeatCause: this.core.defeatReason ?? 'unknown',
        aliveEnemies: analysis.aliveEnemies,
        bossHpPercent: analysis.bossHpPercent,
        activeSynergies: [...analysis.activeSynergyIds],
        unusedCharges: analysis.unusedCharges,
      } : {}),
    }, this.runId);
    const date = this.runDate;
    const btn = makeButton(this, 640, won ? 452 : 510, 220, 52, '다시 시작', () => {
      this.analytics.track('retry_clicked', { mode: this.mode, round: summary.round }, this.runId);
      const nextSeed = this.mode === 'daily' ? this.seedValue : (this.seedValue * 31 + 17) >>> 0;
      this.scene.restart({ seed: nextSeed, mode: this.mode, date: this.runDate, retry: true });
    }, { fontSize: 18 });
    btn.container.setDepth(22);
    const actionY = won ? 520 : 568;
    if (this.mode === 'daily') {
      const ranking = makeButton(this, 384, actionY, 220, 42, '일일 랭킹 등록', async () => {
        ranking.setEnabled(false);
        ranking.setLabel('등록 중…');
        try {
          const result = await submitDailyScore({
            date,
            playerId: this.profile.leaderboardPlayerId,
            name: this.profile.leaderboardName,
            summary,
          });
          ranking.setLabel(`등록 완료 · #${result.rank}`);
          this.analytics.track('leaderboard_submitted', {
            date,
            rank: result.rank,
            score: result.bestScore,
            accepted: result.accepted,
          }, this.runId);
          this.flashCenter(`#${result.rank} · 일일 랭킹 등록 완료`, 0xe6c84f, 24);
        } catch {
          ranking.setLabel('등록 실패 · 다시 시도');
          ranking.setEnabled(true);
        }
      }, { fill: 0x9f74cf, fontSize: 14 });
      ranking.container.setDepth(22);
      if (!leaderboardConfigured()) {
        ranking.setLabel('랭킹 서버 준비 중');
        ranking.setEnabled(false);
      }
    }
    const shareX = this.mode === 'daily' ? 640 : 512;
    const cardX = this.mode === 'daily' ? 896 : 768;
    const share = makeButton(this, shareX, actionY, 220, 42, '결과 공유', async () => {
      try {
        const result = await shareRun(summary, this.mode, date);
        this.analytics.track('result_shared', { method: result, mode: this.mode }, this.runId);
        this.flashCenter(result === 'shared' ? '결과를 공유했습니다' : '링크를 복사했습니다', UI.accent, 24);
      } catch {
        // 사용자가 공유 창을 닫은 경우 게임 흐름은 그대로 유지한다.
      }
    }, { fill: 0xe6c84f, fontSize: 14 });
    share.container.setDepth(22);
    const card = makeButton(this, cardX, actionY, 220, 42, 'PNG 카드 저장', () => {
      downloadShareCard(summary, this.mode, date);
      this.flashCenter('PNG 카드를 저장했습니다', 0x6ca4d9, 24);
    }, { fill: 0x6ca4d9, fontSize: 14 });
    card.container.setDepth(22);
    const home = makeButton(this, 640, won ? 578 : 626, 180, 40, '메인으로', () => this.scene.start('menu'), { fill: 0x42544a });
    home.container.setDepth(22);
  }

  private renderDefeatAnalysis(analysis: DefeatAnalysis): void {
    this.add.rectangle(640, 342, 900, 250, UI.panelDeep, 0.98)
      .setStrokeStyle(1, UI.panelLine, 1)
      .setDepth(21);
    this.add.text(226, 232, '전투 리포트', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.gold,
    }).setDepth(22);
    this.add.text(226, 264, analysis.cause, {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: UI.text,
    }).setDepth(22);
    this.add.text(226, 298, `${analysis.boss}   ·   ${analysis.build}`, {
      fontFamily: FONT, fontSize: '14px', color: UI.textDim,
    }).setDepth(22);
    this.add.text(226, 328, `시너지  ${analysis.synergies}`, {
      fontFamily: FONT, fontSize: '14px', color: UI.accentText,
    }).setDepth(22);
    this.add.text(226, 356, analysis.skills, {
      fontFamily: FONT, fontSize: '14px', color: UI.textDim,
    }).setDepth(22);
    this.add.text(226, 392, '다음 시도', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.gold,
    }).setDepth(22);
    this.add.text(226, 419, analysis.tips.map((tip) => `• ${tip}`).join('\n'), {
      fontFamily: FONT, fontSize: '14px', color: UI.text, lineSpacing: 8,
      wordWrap: { width: 820 },
    }).setDepth(22);
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private trackCombatStarted(): void {
    if (this.firstCombatTracked) return;
    this.firstCombatTracked = true;
    this.analytics.track('combat_started', { round: this.core.round }, this.runId);
  }

  private trackRoundProgress(): void {
    if (this.core.round <= this.lastTrackedRound) return;
    this.lastTrackedRound = this.core.round;
    if ([2, 5, 10, 20, 30, 40, 50, 60].includes(this.core.round)) {
      this.analytics.track('round_reached', {
        round: this.core.round,
        score: this.core.score,
        units: this.core.field.units.length,
        relics: this.core.relics.length,
      }, this.runId);
    }
  }

  private trackAbandoned(reason: string): void {
    if (this.ended || this.abandonedTracked || !this.core) return;
    this.abandonedTracked = true;
    const summary = this.core.summary();
    this.analytics.track('run_abandoned', {
      reason,
      mode: this.mode,
      phase: this.core.phase,
      round: summary.round,
      score: summary.score,
      durationSeconds: this.elapsedSeconds(),
    }, this.runId);
  }

  private elapsedSeconds(): number {
    return Math.max(0, Math.round((performance.now() - this.runStartedAt) / 1000));
  }

}
