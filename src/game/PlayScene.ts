import Phaser from 'phaser';
import { DeckSealId, Game, Phase } from '../core/game';
import { Enemy, TacticCombatEvent, TickResult, addUnit, enemyPos, spawnEnemy, unitPos } from '../core/combat';
import { UNIT_DEFS } from '../core/units';
import { ENEMY_KINDS } from '../core/enemies';
import { Card, HAND_NAMES_KO, HandRank, isHiddenHand, RANK_LABELS, SUIT_GLYPHS } from '../core/cards/types';
import { CROWN_MAX_LEVEL, CrownLevel, TICK_RATE } from '../core/balance';
import { FieldRenderer, Fx, fieldScreenPoint, tileAtScreen } from './FieldRenderer';
import { HandBar } from './HandBar';
import { SidePanel } from './SidePanel';
import { FONT, FONT_DISPLAY, FONT_MONO, UI, makeButton, makeText } from './ui';
import {
  RELIC_DEFS, RELIC_RARITY_COLORS, RELIC_RARITY_LABELS, RELIC_SLOT_CAP, RelicId, relicSellPrice,
} from '../core/relics';
import {
  dailyDate, discoverHiddenHand, ensureLeaderboardIdentity, loadProfile, Profile, recordRun, RunMode, saveProfile,
} from '../meta/profile';
import { AudioManager } from './AudioManager';
import { BossHud } from './BossHud';
import { downloadShareCard, shareRun } from './ShareCard';
import { GuideOverlay } from './GuideOverlay';
import { ExitConfirmOverlay } from './ExitConfirmOverlay';
import { Analytics, getAnalytics } from '../meta/analytics';
import { isPlaceable, pathLength, tileCanReachPath } from '../core/map';
import { leaderboardConfigured, submitDailyScore } from '../meta/leaderboard';
import { pauseStateAfterFocus, safeFrameDelta, speedAfterFocus } from './timing';
import { OddsOverlay } from './OddsOverlay';
import { RerollOdds } from '../core/cards/odds';
import { analyzeDefeat, DefeatAnalysis } from '../meta/defeatAnalysis';
import { DeckOverlay } from './DeckOverlay';
import { WagerOverlay } from './WagerOverlay';
import { MaintenanceOverlay } from './MaintenanceOverlay';
import { FirstRunCoach } from './FirstRunCoach';
import { isCompactTouchDevice, isPortraitLayout } from './device';
import { attackFxBudget, canCreateTacticFeedback, tacticFeedbackBudget, totalFxBudget } from './fxBudget';
import { createRelicIcon } from './relicAssets';
import { HAND_VARIANT_LABELS, suitIdentityLabel, SUIT_COLORS } from '../core/cards/handIdentity';
import { isLifeLabLocation } from './experiment';
import { PORTRAIT_HEADER_TOAST_LANE, portraitSceneHeight, portraitToastFontSize, portraitY } from './layout';
import {
  getLocale, handName, handVariantName, relicDescription, relicName, relicRarityName,
  suitIdentityName, tr, unitName,
} from '../i18n';
import { evaluateHand } from '../core/cards/evaluator';
import {
  createRoyalWagerState, recordRoyalWagerConfirmation, resolveRoyalWager,
  royalWagerOutcome, ROYAL_WAGERS, royalWagerOffers, RoyalWagerId, RoyalWagerState,
} from '../core/wagers';
import { createHandTactic, HAND_TACTIC_COMPACT_COPY, HAND_TACTIC_COPY } from '../core/handTactics';

const DT = 1 / TICK_RATE;

export class PlayScene extends Phaser.Scene {
  private core!: Game;
  private fieldView!: FieldRenderer;
  private handBar!: HandBar;
  private panel!: SidePanel;
  private bossHud!: BossHud;
  private firstRunCoach!: FirstRunCoach;

  private seedValue = 1;
  private speed = 1;
  private acc = 0;
  private fx: Fx[] = [];
  private damageLabelShownThisFrame = false;
  private cameraShakenThisFrame = false;
  private tacticFeedbackTweens = new Set<Phaser.Tweens.Tween>();
  private selectedUnitId: number | null = null;
  private fusionAnchorId: number | null = null;
  private fusionSelectedIds: number[] = [];
  private moving = false;
  private ended = false;
  private paused = false;
  private portraitToastActive = false;
  private portraitToastQueue: Array<{ text: string; color: number; depth: number; fontSize: number }> = [];
  private mode: RunMode = 'standard';
  private crownLevel: CrownLevel = 0;
  private runDate = '';
  private profile!: Profile;
  private audio!: AudioManager;
  private tutorialActive = false;
  private firstRunCoachActive = false;
  private relicOverlay: Phaser.GameObjects.Container | null = null;
  private guideOverlay: GuideOverlay | null = null;
  private oddsOverlay: OddsOverlay | null = null;
  private deckOverlay: DeckOverlay | null = null;
  private maintenanceOverlay: MaintenanceOverlay | null = null;
  private guideWasPaused = false;
  private deckWasPaused = false;
  private exitOverlay: ExitConfirmOverlay | null = null;
  private exitWasPaused = false;
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
  private trackedRelicTriggers = new Set<string>();
  private lastRelicFeedbackAt = -Infinity;
  private compactFx = false;
  private firstRun = false;
  private onboardingSteps = new Set<string>();
  private wagerOverlay: WagerOverlay | null = null;
  private wagerState: RoyalWagerState = createRoyalWagerState(null);
  private wagerChoiceMade = false;
  private wagerOfferedIds: RoyalWagerId[] = [];

  constructor() {
    super('play');
  }

  init(data: { seed?: number; mode?: RunMode; date?: string; retry?: boolean; crownLevel?: CrownLevel }): void {
    this.portraitToastActive = false;
    this.portraitToastQueue = [];
    this.seedValue = data.seed ?? Date.now() >>> 0;
    this.mode = data.mode ?? 'standard';
    // 오늘의 도전은 모두가 같은 기본 난이도로 경쟁한다. 일반 원정은
    // LIFE 규칙에서도 해금한 왕관 단계를 그대로 사용한다.
    this.crownLevel = data.mode === 'daily' ? 0 : data.crownLevel ?? 0;
    this.runDate = data.date ?? dailyDate();
    const lifeLab = isLifeLabLocation();
    const startingProfile = loadProfile(localStorage);
    this.firstRun = !startingProfile.tutorialDone;
    this.analytics = getAnalytics();
    this.runId = this.analytics.beginRun({
      mode: this.mode,
      retry: data.retry ?? false,
      ruleset: lifeLab ? 'life-economy' : 'classic',
      crownLevel: this.crownLevel,
      firstRun: this.firstRun,
      tutorialDone: startingProfile.tutorialDone,
      locale: getLocale(),
      layout: isPortraitLayout() ? 'portrait' : 'landscape',
      durationSeconds: 0,
    });
    this.runStartedAt = performance.now();
  }

  create(): void {
    if (isPortraitLayout()) this.cameras.main.setBackgroundColor('#0a0a0f');
    const localLifeExperiment = isLifeLabLocation();
    this.core = new Game(this.seedValue, localLifeExperiment ? 'life-economy' : 'classic', this.crownLevel);
    this.speed = 1;
    this.acc = 0;
    this.fx = [];
    this.selectedUnitId = null;
    this.fusionAnchorId = null;
    this.fusionSelectedIds = [];
    this.moving = false;
    this.ended = false;
    this.paused = false;
    this.firstRunCoachActive = false;
    this.relicOverlay = null;
    this.guideOverlay = null;
    this.oddsOverlay = null;
    this.deckOverlay = null;
    this.maintenanceOverlay = null;
    this.guideWasPaused = false;
    this.deckWasPaused = false;
    this.exitOverlay = null;
    this.exitWasPaused = false;
    this.lastTrackedRound = 1;
    this.firstCombatTracked = false;
    this.trackedBossEncounters.clear();
    this.trackedBossDefeats.clear();
    this.trackedBossSurvivals.clear();
    this.bossFirstSeenAt.clear();
    this.abandonedTracked = false;
    this.backgroundPaused = false;
    this.trackedRelicTriggers.clear();
    this.lastRelicFeedbackAt = -Infinity;
    this.compactFx = isCompactTouchDevice();
    this.onboardingSteps.clear();
    this.wagerOverlay = null;
    this.wagerState = createRoyalWagerState(null);
    this.wagerChoiceMade = false;
    this.wagerOfferedIds = royalWagerOffers(this.seedValue).map(({ id }) => id);
    this.profile = ensureLeaderboardIdentity(loadProfile(localStorage), undefined, getLocale());
    const localVisualTest = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
      ? new URLSearchParams(window.location.search).get('visualTest')
      : null;
    if (localVisualTest === 'ui-clean-prep' || localVisualTest === 'ui-clean-boss') {
      this.profile.tutorialDone = true;
      this.wagerChoiceMade = true;
      if (localVisualTest === 'ui-clean-boss') {
        this.core.gold = 100;
        this.core.round = 60;
        this.core.handConfirmed = true;
        this.core.startCombat();
        this.core.tickCombat(1.4);
        this.paused = true;
      }
    } else if (localVisualTest === 'relics') {
      this.profile.tutorialDone = true;
      this.core.relicChoices = ['royal_seal', 'compound_ledger', 'glass_crown'];
    } else if (localVisualTest === 'last-stand') {
      this.profile.tutorialDone = true;
      this.core.relics.push('last_stand');
      this.core.exchangesUsed = this.core.maxExchangesNow - 1;
      this.core.holds = [true, true, true, true, true];
    } else if (localVisualTest === 'crossroad-mark') {
      this.profile.tutorialDone = true;
      this.core.relics.push('crossroad_mark');
    } else if (localVisualTest === 'mobile-hud-safe') {
      this.profile.tutorialDone = true;
      this.core.round = 3;
      this.core.handTactic = createHandTactic(HandRank.RoyalFlush, 3, null);
      this.wagerState = { ...createRoyalWagerState('suit_four'), progress: 3, lockedSuit: 'D' };
      this.wagerChoiceMade = true;
    } else if (localVisualTest === 'mobile-coach') {
      this.profile.tutorialDone = false;
    } else if (localVisualTest === 'suits') {
      this.profile.tutorialDone = true;
      this.core.hand = [
        { rank: 10, suit: 'S' }, { rank: 13, suit: 'S' },
        { rank: 11, suit: 'H' }, { rank: 12, suit: 'H' },
        { rank: 14, suit: 'D' },
      ];
    } else if (localVisualTest === 'fusion') {
      this.profile.tutorialDone = true;
      const anchor = addUnit(this.core.field, HandRank.Pair, 3, 2, false, 'H');
      const second = addUnit(this.core.field, HandRank.Pair, 4, 2, false, 'S');
      addUnit(this.core.field, HandRank.Pair, 5, 2, false, 'D');
      addUnit(this.core.field, HandRank.Pair, 6, 2, false, 'C');
      addUnit(this.core.field, HandRank.Trips, 3, 3, false, 'S');
      this.selectedUnitId = anchor.id;
      this.fusionAnchorId = anchor.id;
      this.fusionSelectedIds = [anchor.id, second.id];
      this.core.handConfirmed = true;
      this.core.lastHandRank = HandRank.Pair;
    } else if (localVisualTest === 'combat-readability') {
      this.profile.tutorialDone = true;
      this.wagerChoiceMade = true;
      this.core.round = 40;
      this.core.gold = 100;
      this.core.handConfirmed = true;
      this.core.startCombat();
      // Spawn the real R40 boss once before installing the paused stress scene.
      this.core.tickCombat(1 / TICK_RATE);
      const routeLength = pathLength(this.core.mapId);
      const boss = this.core.field.enemies.find((enemy) => enemy.kind === 'boss');
      if (boss) boss.dist = routeLength * 0.52;
      const readabilityPositions = [
        [3, 2], [5, 2], [7, 2], [9, 2], [11, 2], [13, 2],
        [3, 3], [7, 3], [9, 3], [13, 3],
        [3, 4], [5, 4], [7, 4], [9, 4], [11, 4], [13, 4],
        [3, 6], [5, 6], [7, 6], [9, 6], [11, 6], [13, 6],
        [3, 8], [7, 8], [9, 8], [13, 8],
      ];
      const readabilitySuits = ['S', 'H', 'D', 'C'] as const;
      readabilityPositions.forEach(([x, y], index) => {
        if (!isPlaceable(x, y, this.core.mapId)) return;
        addUnit(this.core.field, index % 13 as HandRank, x, y, false, readabilitySuits[index % 4]);
      });
      const readabilityKinds = ['normal', 'fast', 'tank', 'regen', 'splitter'] as const;
      for (let index = 0; index < 25; index++) {
        spawnEnemy(this.core.field, readabilityKinds[index % 5], 40, {
          dist: routeLength * (index + 1) / 28,
        });
      }
      this.paused = true;
    } else if (localVisualTest === 'enemy-roster') {
      this.profile.tutorialDone = true;
      this.core.round = 35;
      this.core.handConfirmed = true;
      this.core.startCombat();
      const previewKinds = ['normal', 'fast', 'tank', 'regen', 'splitter'] as const;
      previewKinds.forEach((kind, index) => {
        spawnEnemy(this.core.field, kind, 35, {
          dist: 160 + index * 470,
          hpOverride: 5000,
        });
      });
      this.paused = true;
    } else if (localVisualTest === 'formation-13' || localVisualTest === 'formation-24') {
      this.profile.tutorialDone = true;
      this.core.round = localVisualTest === 'formation-13' ? 13 : 24;
      this.core.formationMastery = { streak: 2, bestStreak: 3, perfectCount: 4, score: 700 };
    } else if (localVisualTest === 'formation-mastery-combat') {
      this.profile.tutorialDone = true;
      this.core.round = 24;
      this.core.formationMastery = { streak: 2, bestStreak: 3, perfectCount: 4, score: 700 };
      this.core.handConfirmed = true;
      this.core.startCombat();
      this.core.tickCombat(1.4);
      this.paused = true;
    } else if (localVisualTest === 'formation-mastery-success') {
      this.profile.tutorialDone = true;
      this.core.round = 24;
      this.core.formationMastery = { streak: 2, bestStreak: 2, perfectCount: 2, score: 300 };
      this.core.handConfirmed = true;
      this.core.startCombat();
      // localhost visualTest 전용: 다음 update가 실제 endRound/피드백 경로를 한 번 통과한다.
      (this.core as unknown as { spawnQueue: string[] }).spawnQueue = [];
    } else if (localVisualTest === 'pixel-motion') {
      this.profile.tutorialDone = true;
      this.core.round = 28;
      this.core.upgradeLevel = 15;
      const previewTiers = [
        HandRank.HighCard, HandRank.Pair, HandRank.TwoPair, HandRank.Trips, HandRank.Straight,
        HandRank.Flush, HandRank.FullHouse, HandRank.FourKind, HandRank.StraightFlush,
        HandRank.RoyalFlush, HandRank.FiveKind, HandRank.FlushHouse, HandRank.FlushFive,
      ];
      const previewPositions = [
        [2.4, 1.6], [4.1, 1.6], [5.8, 1.6], [7.5, 1.6], [9.2, 1.6],
        [2.4, 3.2], [4.1, 3.2], [5.8, 3.2], [7.5, 3.2], [9.2, 3.2],
        [3.2, 4.8], [5.8, 4.8], [8.4, 4.8],
      ];
      const previewSuits = ['S', 'H', 'D', 'C'] as const;
      previewTiers.forEach((tier, index) => {
        const [x, y] = previewPositions[index];
        addUnit(this.core.field, tier, x, y, false, previewSuits[index % previewSuits.length]);
      });
      this.core.handConfirmed = true;
      this.core.startCombat();
    } else if (localVisualTest === 'mastery') {
      this.profile.tutorialDone = true;
      this.core.round = 9;
      this.core.gold = 1000;
      this.core.upgradeLevel = 30;
      this.core.relics.push('fortified_table', 'frozen_clover', 'glass_crown');
      this.core.pendingUnits.push(HandRank.RoyalFlush);
      this.core.placeUnit(8, 5);
      this.core.handConfirmed = true;
      this.core.startCombat();
      for (let tick = 0; tick < 5000 && this.core.phase === 'combat'; tick++) {
        this.core.tickCombat(1 / 30);
      }
    } else if (localVisualTest === 'mastery-result' || localVisualTest === 'mastery-victory') {
      this.profile.tutorialDone = true;
      this.core.round = localVisualTest === 'mastery-victory' ? 60 : 47;
      this.core.score = 128400;
      this.core.kills = 612;
      this.core.upgradeLevel = 12;
      this.core.bestHand = HandRank.FullHouse;
      this.core.handMastery[HandRank.Pair] = 2;
      this.core.handMastery[HandRank.Trips] = 1;
      this.core.handDamage[HandRank.Pair] = 70000;
      this.core.handDamage[HandRank.Trips] = 30000;
      this.core.formationMastery = { streak: 15, bestStreak: 15, perfectCount: 15, score: 12000 };
      addUnit(this.core.field, HandRank.Pair, 3, 2);
      addUnit(this.core.field, HandRank.Trips, 5, 2);
      if (localVisualTest === 'mastery-victory') {
        this.core.phase = 'victory';
      } else {
        const boss = spawnEnemy(this.core.field, 'boss', 40, { hpOverride: 1000 });
        boss.hp = 340;
        this.core.defeatReason = 'field-cap';
        this.core.phase = 'defeat';
      }
    } else if (localVisualTest === 'life-result') {
      this.profile.tutorialDone = true;
      this.core.round = 31;
      this.core.score = 86400;
      this.core.kills = 438;
      this.core.lives = 0;
      this.core.escapedEnemies = 17;
      this.core.lifeDamageTaken = 8;
      this.core.lifeRoundHistory.push(
        {
          round: 26, escaped: 3, lifeDamage: 3,
          escapedByKind: { normal: 0, fast: 3, tank: 0, regen: 0, splitter: 0, boss: 0 },
          escapedBossHpPercent: null,
        },
        {
          round: 30, escaped: 1, lifeDamage: 0,
          escapedByKind: { normal: 0, fast: 0, tank: 0, regen: 0, splitter: 0, boss: 1 },
          escapedBossHpPercent: 22,
        },
        {
          round: 31, escaped: 5, lifeDamage: 5,
          escapedByKind: { normal: 0, fast: 4, tank: 1, regen: 0, splitter: 0, boss: 0 },
          escapedBossHpPercent: null,
        },
      );
      addUnit(this.core.field, HandRank.Pair, 3, 2);
      addUnit(this.core.field, HandRank.Straight, 5, 2);
      this.core.defeatReason = 'life-depleted';
      this.core.phase = 'defeat';
    }
    saveProfile(localStorage, this.profile);
    this.audio = new AudioManager(this.profile.soundEnabled);

    this.fieldView = new FieldRenderer(this, this.core.mapId);
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
          this.cancelFusionSelection();
          this.trackCombatStarted();
          this.audio.play(boss ? 'boss' : 'click');
          this.refreshUI();
        }
      },
      onSpeed: (n) => {
        this.speed = n;
        // 포커스 복귀 이벤트가 누락된 Windows Chrome에서도 배속 버튼 입력은
        // 자동 정지를 해제하고 즉시 선택 배속으로 재개해야 한다.
        if (this.backgroundPaused && !document.hidden) this.resumeFromBackground();
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
      onCloseInspector: () => {
        this.selectedUnitId = null;
        this.refreshUI();
      },
      onSell: () => {
        if (this.selectedUnitId !== null) {
          if (this.core.sellUnit(this.selectedUnitId)) {
            this.audio.play('click');
            this.selectedUnitId = null;
            this.moving = false;
            this.cancelFusionSelection();
          }
          this.refreshUI();
        }
      },
      onMove: () => {
        if (this.selectedUnitId !== null && this.core.phase === 'prep') {
          this.cancelFusionSelection();
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
    this.bossHud = new BossHud(this);
    this.firstRunCoach = new FirstRunCoach(this);

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length > 0 || this.ended) return;
        this.onFieldClick(pointer.x, pointer.y);
      },
    );

    this.refreshUI();
    this.bindKeys();
    const wagerVisualTest = localVisualTest === 'wager-gold' || localVisualTest === 'wager-seal';
    if ((!localVisualTest || wagerVisualTest) && this.core.round === 1) {
      this.wagerOverlay = new WagerOverlay(this, this.wagerOfferedIds.map((id) => ROYAL_WAGERS[id]), (id) => {
        this.wagerOverlay = null;
        this.wagerChoiceMade = true;
        this.wagerState = createRoyalWagerState(id);
        if (id) this.analytics.track('wager_selected', {
          wagerId: id,
          offeredIds: this.wagerOfferedIds,
          round: this.core.round,
          locale: getLocale(),
          layout: isPortraitLayout() ? 'portrait' : 'landscape',
        }, this.runId);
        this.audio.play('click');
        this.refreshUI();
      });
      this.analytics.track('wager_offered', {
        offeredIds: this.wagerOfferedIds,
        round: this.core.round,
        locale: getLocale(),
        layout: isPortraitLayout() ? 'portrait' : 'landscape',
      }, this.runId);
    } else {
      this.wagerChoiceMade = true;
    }
    if (!this.profile.tutorialDone) {
      this.firstRunCoachActive = true;
      this.trackOnboardingStep('run_started');
      this.refreshUI();
    }
    this.pageHideHandler = () => this.trackAbandoned('page_hidden');
    window.addEventListener('pagehide', this.pageHideHandler);
    this.windowBlurHandler = () => {
      this.acc = 0;
      if (this.core.phase === 'combat' && !this.paused && !this.backgroundPaused) {
        this.paused = true;
        this.backgroundPaused = true;
        this.syncTacticFeedbackPause();
        this.analytics.track('background_pause', {
          round: this.core.round,
          speed: this.speed,
        }, this.runId);
      }
    };
    this.windowFocusHandler = () => {
      this.resumeFromBackground();
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
      this.audio.destroy();
      this.trackAbandoned('scene_left');
    });
    // E2E/디버그용 훅
    const debugWindow = window as unknown as {
      __game?: Game;
      __playDebug?: {
        speed(): number;
        paused(): boolean;
        backgroundPaused(): boolean;
        wager(): RoyalWagerState;
        wagerOffers(): RoyalWagerId[];
        setWagerForTest?(id: RoyalWagerId, progress: number): void;
        showMobileToastSequence?(): void;
        mobileToastState?(): { active: boolean; queued: number };
        restartMobileHud?(): void;
      };
    };
    debugWindow.__game = this.core;
    debugWindow.__playDebug = {
      speed: () => this.speed,
      paused: () => this.paused,
      backgroundPaused: () => this.backgroundPaused,
      wager: () => ({ ...this.wagerState, recordedRounds: [...this.wagerState.recordedRounds] }),
      wagerOffers: () => [...this.wagerOfferedIds],
      ...(wagerVisualTest ? {
        setWagerForTest: (id: RoyalWagerId, progress: number) => {
          const target = ROYAL_WAGERS[id].target;
          this.wagerState = { ...createRoyalWagerState(id), progress: Math.max(0, Math.min(target, progress)) };
        },
      } : {}),
      ...(localVisualTest === 'mobile-hud-safe' ? {
        showMobileToastSequence: () => {
          this.celebrate(HandRank.FullHouse);
          this.flashTacticActivation();
          this.flashCenter(
            tr('완벽 방어 · 연속 ×12 · +1200점', 'PERFECT DEFENSE · STREAK ×12 · +1200'),
            UI.accent,
            60,
          );
        },
        mobileToastState: () => ({ active: this.portraitToastActive, queued: this.portraitToastQueue.length }),
        restartMobileHud: () => this.scene.restart({
          seed: this.seedValue, mode: this.mode, date: this.runDate, retry: true, crownLevel: this.crownLevel,
        }),
      } : {}),
    };
    if (localVisualTest === 'mastery-result' || localVisualTest === 'mastery-victory' || localVisualTest === 'life-result') {
      this.time.delayedCall(0, () => this.showEnd());
    }
  }

  update(_time: number, deltaMs: number): void {
    // 일부 Windows Chrome 환경은 탭 복귀 시 focus 이벤트를 누락한다.
    // 실제로 보이는 활성 문서라면 게임 루프에서 한 번 더 자동 정지를 복구한다.
    if (this.backgroundPaused && !document.hidden && document.hasFocus()) {
      this.resumeFromBackground();
    }
    const dt = safeFrameDelta(deltaMs);
    this.resolveWagerIfNeeded();
    this.damageLabelShownThisFrame = false;
    this.cameraShakenThisFrame = false;
    if (this.core.phase === 'combat' && !this.paused) this.stepCombat(dt);
    this.fieldView.update(
      this.core,
      this.selectedUnitId,
      this.placementTier(),
      this.fx,
      this.paused ? 0 : dt,
      this.fusionTier(),
      this.fusionSelectedIds,
    );
    this.bossHud.refresh(this.core);
    this.syncRelicPicker();
    this.syncMaintenance();
  }

  private resumeFromBackground(): void {
    this.acc = 0;
    // Chrome/Windows는 focus와 visibilitychange를 중복·역순으로 보낼 수 있다.
    // 복귀 이벤트가 사용자가 고른 배속을 과거 값(주로 ×1)으로 덮어쓰지 않게 한다.
    this.speed = speedAfterFocus(this.speed);
    if (!this.backgroundPaused) return;
    this.paused = pauseStateAfterFocus(this.paused, this.backgroundPaused);
    this.backgroundPaused = false;
    this.syncTacticFeedbackPause();
    this.flashCenter(tr(`게임 재개 · ×${this.speed} 유지`, `RESUMED · SPEED ×${this.speed}`), 0xe6c84f);
    this.refreshUI();
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
      const formation = this.core.lastFormationResult;
      if (formation?.perfect) {
        this.flashCenter(
          tr(
            `완벽 방어 · 연속 ×${formation.streak} · +${formation.scoreBonus}점`,
            `PERFECT DEFENSE · STREAK ×${formation.streak} · +${formation.scoreBonus}`,
          ),
          UI.accent,
          60,
          { fontSize: isPortraitLayout() ? 17 : 25, wrapWidth: isPortraitLayout() ? 350 : undefined },
        );
      }
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
      if (movingUnit && !tileCanReachPath(t.tx, t.ty, UNIT_DEFS[movingUnit.tier].range, this.core.mapId)) {
        this.analytics.track('placement_blocked', {
          round: this.core.round,
          tier: movingUnit.tier,
          action: 'move',
        }, this.runId);
        this.flashCenter(tr('경로가 사거리 밖입니다', 'THE PATH IS OUT OF RANGE'), UI.danger);
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
    if (this.fusionAnchorId !== null && this.core.phase === 'prep') {
      const anchor = this.core.field.units.find((candidate) => candidate.id === this.fusionAnchorId);
      if (!anchor) {
        this.cancelFusionSelection();
      } else if (!unit || unit.tier !== anchor.tier) {
        this.flashCenter(tr(`같은 ${HAND_NAMES_KO[anchor.tier]} 유닛을 선택하세요`, `SELECT ANOTHER ${handName(anchor.tier, HAND_NAMES_KO[anchor.tier]).toUpperCase()} UNIT`), 0x9f74cf);
        return;
      } else if (unit.id === anchor.id) {
        this.cancelFusionSelection();
        this.audio.play('click');
        this.flashCenter(tr('합성 선택을 취소했습니다', 'FUSION SELECTION CANCELED'), 0xf2ede3);
        this.refreshUI();
        return;
      } else {
        const selectedIndex = this.fusionSelectedIds.indexOf(unit.id);
        if (selectedIndex >= 0) {
          this.fusionSelectedIds.splice(selectedIndex, 1);
        } else if (this.fusionSelectedIds.length < 3) {
          this.fusionSelectedIds.push(unit.id);
        } else {
          this.flashCenter(tr('재료는 2기까지 선택할 수 있습니다', 'SELECT UP TO 2 MATERIAL UNITS'), 0x9f74cf);
          return;
        }
        this.audio.play('click');
        this.refreshUI();
        return;
      }
    }
    if (unit) {
      this.selectUnit(unit.id);
      return;
    }
    if (this.core.phase === 'prep' && this.core.pendingUnits.length > 0) {
      const pendingTier = this.core.pendingUnits[0];
      if (!tileCanReachPath(t.tx, t.ty, UNIT_DEFS[pendingTier].range, this.core.mapId)) {
        this.analytics.track('placement_blocked', {
          round: this.core.round,
          tier: pendingTier,
          action: 'place',
        }, this.runId);
        this.flashCenter(tr('붉은 타일은 공격할 수 없습니다', 'RED TILES CANNOT REACH THE PATH'), UI.danger);
        return;
      }
      if (this.core.placeUnit(t.tx, t.ty)) {
        if (this.firstRun) this.trackOnboardingStep('unit_placed');
        this.audio.play('click');
        this.refreshUI();
        return;
      }
    }
    this.selectUnit(null);
  }

  private selectUnit(id: number | null): void {
    this.cancelFusionSelection();
    this.selectedUnitId = id;
    this.moving = false;
    this.refreshUI();
  }

  // ── UI 동기화 ─────────────────────────────────────

  private refreshUI(): void {
    this.resolveWagerIfNeeded();
    const selected =
      this.selectedUnitId === null
        ? null
        : this.core.field.units.find((u) => u.id === this.selectedUnitId) ?? null;
    if (!selected) {
      this.selectedUnitId = null;
      this.cancelFusionSelection();
    }
    this.handBar.refresh();
    this.panel.refresh(
      selected,
      this.speed,
      this.paused,
      this.audio.enabled,
      this.mode,
      this.fusionAnchorId !== null,
      this.fusionSelectedIds.length,
    );
    this.panel.setWagerStatus(this.wagerHudText(), this.wagerChoiceMade && this.core.round <= 9);
    const tacticText = this.tacticHudText();
    this.panel.setTacticStatus(tacticText, tacticText.length > 0);
    this.bossHud.refresh(this.core);
    this.firstRunCoach.refresh(this.core, this.firstRunCoachActive);
    this.syncRelicPicker();
    this.syncMaintenance();
  }

  private onHandAction(action: 'hold' | 'exchange' | 'confirm'): void {
    if (this.firstRun) this.trackOnboardingStep(
      action === 'hold' ? 'card_held' : action === 'exchange' ? 'cards_exchanged' : 'hand_confirmed',
    );
    this.audio.play(action === 'confirm' ? 'confirm' : action === 'exchange' ? 'card' : 'click');
    const rank = this.core.lastHandRank;
    let newlyDiscovered = false;
    if (action === 'confirm' && rank !== null) {
      const discovery = discoverHiddenHand(this.profile, rank);
      newlyDiscovered = discovery.discovered;
      if (newlyDiscovered) {
        this.profile = discovery.profile;
        saveProfile(localStorage, this.profile);
      }
    }
    if (this.core.handConfirmed && rank !== null && rank >= HandRank.FullHouse) {
      this.celebrate(rank, newlyDiscovered);
    }
    if (action === 'confirm' && this.core.lastHandRank !== null) {
      this.wagerState = recordRoyalWagerConfirmation(this.wagerState, {
        round: this.core.round,
        hand: this.core.hand,
        rank: evaluateHand(this.core.hand),
        exchangesUsed: this.core.exchangesUsed,
        dominantSuit: this.core.lastHandSuit,
      });
      this.analytics.track('hand_confirmed', {
        round: this.core.round,
        rank: this.core.lastHandRank,
        exchanges: this.core.exchangesUsed,
        hidden: isHiddenHand(this.core.lastHandRank),
        newlyDiscovered,
        suit: this.core.lastHandSuit,
        variant: this.core.lastHandVariant,
        firstRun: this.firstRun,
        tutorialDone: this.profile.tutorialDone,
        locale: getLocale(),
        durationSeconds: this.elapsedSeconds(),
      }, this.runId);
      if (this.core.handTactic) this.flashTacticActivation();
      if (this.core.lastHandVariant) {
        this.flashCenter(
          `${handVariantName(this.core.lastHandVariant, HAND_VARIANT_LABELS[this.core.lastHandVariant])} · ${suitIdentityName(this.core.lastHandSuit, suitIdentityLabel(this.core.lastHandSuit))}`,
          0xffe27a,
          20,
        );
      }
      this.showRelicTriggers(this.core.lastRelicTriggers, 'hand');
      if (this.core.lastRelicGoldBonus > 0) this.flashCenter(
        tr(`유물 보상  +${this.core.lastRelicGoldBonus}G`, `RELIC BONUS  +${this.core.lastRelicGoldBonus}G`),
        0xe6c84f,
        17,
      );
    } else if (action === 'exchange') {
      this.showRelicTriggers(this.core.lastRelicTriggers, 'exchange');
    }
    this.refreshUI();
  }

  private fuseSelected(): void {
    if (this.selectedUnitId === null) return;
    const selected = this.core.field.units.find((unit) => unit.id === this.selectedUnitId);
    if (!selected) return;
    if (this.fusionAnchorId === null) {
      if (this.core.fusionCandidates(selected.tier).length < 3) return;
      this.fusionAnchorId = selected.id;
      this.fusionSelectedIds = [selected.id];
      this.moving = false;
      this.audio.play('click');
      this.flashCenter(
        tr(
          `${selected.suit ? SUIT_GLYPHS[selected.suit] : '◇'} 기준 유닛 · 같은 종류 2기 선택 · 기준 재클릭 취소`,
          `${selected.suit ? SUIT_GLYPHS[selected.suit] : '◇'} ANCHOR · SELECT 2 MATCHING UNITS · CLICK ANCHOR TO CANCEL`,
        ),
        selected.suit ? SUIT_COLORS[selected.suit] : 0x9f74cf,
      );
      this.refreshUI();
      return;
    }
    if (this.fusionSelectedIds.length !== 3) {
      this.flashCenter(tr(`합성 재료 선택 ${this.fusionSelectedIds.length}/3`, `FUSION MATERIALS ${this.fusionSelectedIds.length}/3`), 0x9f74cf);
      return;
    }
    const materialIds = [...this.fusionSelectedIds];
    if (this.core.fuseUnits(materialIds)) {
      const inheritedSuit = selected.suit;
      this.cancelFusionSelection();
      this.selectedUnitId = null;
      this.audio.play('fuse');
      this.flashCenter(
        tr(
          `${inheritedSuit ? SUIT_GLYPHS[inheritedSuit] : '◇'} ${UNIT_DEFS[(selected.tier + 1) as HandRank].name} 합성!`,
          `${inheritedSuit ? SUIT_GLYPHS[inheritedSuit] : '◇'} ${unitName((selected.tier + 1) as HandRank, UNIT_DEFS[(selected.tier + 1) as HandRank].name).toUpperCase()} FUSED!`,
        ),
        inheritedSuit ? SUIT_COLORS[inheritedSuit] : 0xb781dc,
      );
      this.analytics.track('unit_fused', {
        round: this.core.round,
        fromTier: selected.tier,
        toTier: selected.tier + 1,
      }, this.runId);
      this.refreshUI();
    }
  }

  private fusionTier(): HandRank | null {
    if (this.fusionAnchorId === null) return null;
    return this.core.field.units.find((unit) => unit.id === this.fusionAnchorId)?.tier ?? null;
  }

  private cancelFusionSelection(): void {
    this.fusionAnchorId = null;
    this.fusionSelectedIds = [];
  }

  private togglePause(): void {
    if (this.core.phase !== 'combat') return;
    this.paused = !this.paused;
    this.syncTacticFeedbackPause();
    this.audio.play('click');
    this.refreshUI();
  }

  private syncTacticFeedbackPause(): void {
    for (const tween of this.tacticFeedbackTweens) {
      if (this.paused) tween.pause();
      else tween.resume();
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
      if (this.wagerOverlay || this.tutorialActive || this.ended || this.maintenanceOverlay || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.core.doExchange()) this.onHandAction('exchange');
    });
    keyboard.on('keydown-ENTER', () => {
      if (this.wagerOverlay || this.tutorialActive || this.ended || this.maintenanceOverlay || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.core.confirmHand(true) !== null) this.onHandAction('confirm');
    });
    keyboard.on('keydown-SPACE', () => {
      if (this.wagerOverlay || this.tutorialActive || this.ended || this.maintenanceOverlay || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.core.phase === 'combat') this.togglePause();
      else if (this.core.startCombat()) {
        this.trackCombatStarted();
        this.audio.play(this.core.nextWave().kind === 'boss' ? 'boss' : 'click');
        this.refreshUI();
      }
    });
    for (const [key, n] of [['ONE', 1], ['TWO', 2], ['FOUR', 4]] as const) {
      keyboard.on(`keydown-${key}`, () => {
        if (this.wagerOverlay || this.maintenanceOverlay || this.guideOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
        if (this.core.phase === 'combat') {
          this.speed = n;
          this.refreshUI();
        }
      });
    }
    keyboard.on('keydown-M', () => {
      if (!this.wagerOverlay && !this.maintenanceOverlay && !this.guideOverlay && !this.oddsOverlay && !this.deckOverlay && !this.exitOverlay) this.toggleSound();
    });
    keyboard.on('keydown-H', () => {
      if (this.wagerOverlay || this.tutorialActive || this.ended || this.maintenanceOverlay || this.relicOverlay || this.oddsOverlay || this.deckOverlay || this.exitOverlay) return;
      if (this.guideOverlay) this.closeGuide();
      else this.openGuide();
    });
    keyboard.on('keydown-D', () => {
      if (this.wagerOverlay || this.tutorialActive || this.ended || this.maintenanceOverlay || this.relicOverlay || this.guideOverlay || this.oddsOverlay || this.exitOverlay) return;
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
    if (this.maintenanceOverlay || this.oddsOverlay || this.deckOverlay || this.core.phase !== 'prep' || this.core.handConfirmed) return;
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
      this.deckOverlay || this.maintenanceOverlay || this.tutorialActive || this.ended || this.relicOverlay
      || this.guideOverlay || this.oddsOverlay || this.exitOverlay
    ) return;
    this.deckWasPaused = this.paused;
    if (this.core.phase === 'combat') this.paused = true;
    this.syncTacticFeedbackPause();
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
    this.syncTacticFeedbackPause();
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
      `${SUIT_GLYPHS[card.suit]} ${RANK_LABELS[card.rank]} ${id === 'banish' ? tr('추방', 'BANISHED') : tr('복제', 'DUPLICATED')}`,
      id === 'banish' ? 0xd06258 : 0x9f74cf,
    );
    this.refreshUI();
  }

  private requestExit(): void {
    if (this.ended || this.maintenanceOverlay || this.exitOverlay || this.deckOverlay) return;
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
    this.syncTacticFeedbackPause();
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
    this.syncTacticFeedbackPause();
    this.audio.play('click');
    this.refreshUI();
  }

  private openGuide(): void {
    if (this.guideOverlay || this.deckOverlay || this.maintenanceOverlay || this.tutorialActive || this.ended || this.relicOverlay || this.exitOverlay) return;
    this.guideWasPaused = this.paused;
    if (this.core.phase === 'combat') this.paused = true;
    this.syncTacticFeedbackPause();
    this.guideOverlay = new GuideOverlay(this, this.profile.discoveredHands, () => this.closeGuide());
    this.audio.play('click');
    this.refreshUI();
  }

  private closeGuide(): void {
    if (!this.guideOverlay) return;
    this.guideOverlay.destroy();
    this.guideOverlay = null;
    if (this.core.phase === 'combat') this.paused = this.guideWasPaused;
    this.syncTacticFeedbackPause();
    this.audio.play('click');
    this.refreshUI();
  }

  private syncMaintenance(): void {
    if (
      !this.core.maintenancePending || this.maintenanceOverlay
      || this.tutorialActive || this.ended || this.relicOverlay
    ) return;
    this.analytics.track('maintenance_opened', {
      round: this.core.round,
      gold: this.core.gold,
      deckSize: this.core.deckSize,
    }, this.runId);
    this.maintenanceOverlay = new MaintenanceOverlay(
      this,
      this.core,
      (id, cost) => {
        this.analytics.track('maintenance_purchase', {
          round: this.core.round,
          item: id,
          cost,
          goldAfter: this.core.gold,
        }, this.runId);
        this.audio.play('confirm');
      },
      (id, cost, replaced, refund) => {
        this.analytics.track('maintenance_relic_purchase', {
          round: this.core.round,
          relic: id,
          cost,
          replaced,
          refund,
          goldAfter: this.core.gold,
          relicCount: this.core.relics.length,
        }, this.runId);
        this.audio.play('relic');
      },
      (rank, level, cost) => {
        this.analytics.track('maintenance_mastery_purchase', {
          round: this.core.round,
          handRank: rank,
          level,
          cost,
          goldAfter: this.core.gold,
        }, this.runId);
        this.audio.play('confirm');
        this.refreshUI();
      },
      (id, value) => {
        this.analytics.track('relic_sold', {
          round: this.core.round,
          relic: id,
          value,
          goldAfter: this.core.gold,
          relicCount: this.core.relics.length,
        }, this.runId);
        this.audio.play('click');
      },
      (openDeck) => {
        const round = this.core.round;
        this.maintenanceOverlay?.destroy();
        this.maintenanceOverlay = null;
        this.analytics.track('maintenance_closed', {
          round,
          gold: this.core.gold,
          boughtBanish: this.core.deckSeals.banish,
          boughtDuplicate: this.core.deckSeals.duplicate,
        }, this.runId);
        this.audio.play('click');
        this.refreshUI();
        if (openDeck) this.openDeck();
      },
    );
    this.audio.play('boss');
  }

  private syncRelicPicker(): void {
    if (this.core.relicChoices.length === 0 || this.relicOverlay || this.maintenanceOverlay || this.ended) return;
    const portrait = isPortraitLayout();
    const portraitHeight = portraitSceneHeight(this);
    const py = (value: number) => portraitY(portraitHeight, value);
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(
      portrait ? 195 : 390,
      portrait ? portraitHeight / 2 : 280,
      portrait ? 390 : 748,
      portrait ? portraitHeight : 560,
      0x06100a,
      0.93,
    ).setInteractive();
    children.push(dim);
    const full = this.core.relics.length >= RELIC_SLOT_CAP;
    let selectedNew: RelicId | null = null;
    const title = makeText(
      this,
      portrait ? 195 : 390,
      portrait ? py(102) : 102,
      full ? tr('보상 유물 선택 · 교체하거나 건너뛰세요', 'CHOOSE A RELIC · REPLACE OR SKIP') : tr('보스 격파 · 유물을 선택하세요', 'BOSS DEFEATED · CHOOSE A RELIC'),
      portrait ? 18 : full ? 23 : 28,
      UI.gold,
      true,
    ).setOrigin(0.5);
    children.push(title);
    const replacementButtons: ReturnType<typeof makeButton>[] = [];
    const finishSelection = (id: RelicId, replaceId?: RelicId) => {
      if (!this.core.chooseRelic(id, replaceId)) return;
      const refund = replaceId ? relicSellPrice(replaceId) : 0;
      this.analytics.track('relic_selected', {
        round: this.core.round,
        relic: id,
        replaced: replaceId ?? null,
        refund,
        relicCount: this.core.relics.length,
      }, this.runId);
      this.audio.play('relic');
      this.relicOverlay?.destroy(true);
      this.relicOverlay = null;
      this.flashCenter(tr(`${RELIC_DEFS[id].name} 획득${refund ? ` · +${refund}G` : ''}`, `${relicName(id, RELIC_DEFS[id].name)} ACQUIRED${refund ? ` · +${refund}G` : ''}`), RELIC_DEFS[id].color);
      this.refreshUI();
    };
    this.core.relicChoices.forEach((id, index) => {
      const def = RELIC_DEFS[id];
      const rarityColor = RELIC_RARITY_COLORS[def.rarity];
      const x = portrait ? 68 + index * 127 : 176 + index * 214;
      const card = this.add.rectangle(x, portrait ? py(278) : 278, portrait ? 116 : 188, portrait ? 220 : 240, UI.panel, 1)
        .setStrokeStyle(def.rarity === 'legendary' ? 3 : 2, rarityColor, 0.95)
        .setInteractive({ useHandCursor: true });
      const icon = createRelicIcon(this, id, x, portrait ? py(210) : 210, portrait ? 50 : 68);
      const name = makeText(this, x, portrait ? py(278) : 278, relicName(id, def.name), portrait ? 13 : 17, UI.text, true).setOrigin(0.5);
      const desc = makeText(this, x, portrait ? py(314) : 318, relicDescription(id, def.description), portrait ? 10 : 13, UI.textDim).setOrigin(0.5).setAlign('center');
      desc.setWordWrapWidth(portrait ? 100 : 154, true);
      const rarity = makeText(
        this, x, portrait ? py(367) : 367, relicRarityName(def.rarity, RELIC_RARITY_LABELS[def.rarity]), portrait ? 9 : 11,
        `#${rarityColor.toString(16).padStart(6, '0')}`, true,
      ).setOrigin(0.5);
      card.on('pointerdown', () => {
        if (!full) {
          finishSelection(id);
          return;
        }
        selectedNew = id;
        title.setText(tr(`${def.name} 선택 · 교체할 기존 유물을 누르세요`, `${relicName(id, def.name)} SELECTED · CHOOSE A RELIC TO REPLACE`));
        replacementButtons.forEach((button) => button.setEnabled(true));
      });
      children.push(card, icon, name, desc, rarity);
    });
    if (full) {
      this.core.relics.forEach((id, index) => {
        const def = RELIC_DEFS[id];
        const value = relicSellPrice(id);
        const button = makeButton(
          this,
          portrait ? 41 + index * 77 : 110 + index * 140,
          portrait ? py(466) : 466,
          portrait ? 70 : 126,
          54,
          tr(`${def.name}\n교체 +${value}G`, `${relicName(id, def.name)}\nREPLACE +${value}G`),
          () => {
            if (selectedNew) finishSelection(selectedNew, id);
          },
          { fill: 0x42544a, fontSize: portrait ? 8 : 10 },
        );
        button.setEnabled(false);
        replacementButtons.push(button);
        children.push(button.container, createRelicIcon(this, id, portrait ? 18 + index * 77 : 68 + index * 140, portrait ? py(466) : 466, portrait ? 20 : 30));
      });
    }
    const skip = makeButton(
      this,
      portrait ? 195 : 390,
      portrait ? py(798) : 528,
      portrait ? 250 : 190,
      portrait ? 46 : 36,
      tr('이번 유물 보상 건너뛰기', 'SKIP THIS RELIC REWARD'),
      () => {
        if (!this.core.skipRelicChoice()) return;
        this.audio.play('click');
        this.relicOverlay?.destroy(true);
        this.relicOverlay = null;
        this.flashCenter(tr('유물 보상을 건너뛰었습니다', 'RELIC REWARD SKIPPED'), UI.goldNum);
        this.refreshUI();
      },
      { fill: UI.panelDeep, textColor: UI.textDim, fontSize: portrait ? 14 : 12, strokeAlpha: 0.2 },
    );
    children.push(skip.container);
    this.relicOverlay = this.add.container(0, 0, children).setDepth(18);
  }

  private flashCenter(
    labelText: string,
    color: number,
    depth = 16,
    position?: { x?: number; y?: number; targetY?: number; fontSize?: number; wrapWidth?: number },
  ): void {
    const portrait = isPortraitLayout();
    if (portrait) {
      const fontSize = Math.min(position?.fontSize ?? 12, portraitToastFontSize(labelText));
      if (this.portraitToastQueue.length < 5) {
        this.portraitToastQueue.push({ text: labelText, color, depth, fontSize });
        this.showNextPortraitToast();
      }
      return;
    }
    const startY = position?.y ?? 270;
    const label = makeText(
      this, position?.x ?? 390, startY, labelText, position?.fontSize ?? 30,
      `#${color.toString(16).padStart(6, '0')}`, true,
    )
      .setOrigin(0.5).setDepth(depth).setShadow(0, 3, '#000000', 8);
    if (position?.wrapWidth) label.setWordWrapWidth(position.wrapWidth, true).setAlign('center');
    this.tweens.add({
      targets: label,
      y: this.reducedMotion() ? startY : position?.targetY ?? 230,
      alpha: 0,
      duration: this.reducedMotion() ? 700 : 1200,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private showNextPortraitToast(): void {
    if (this.portraitToastActive || this.portraitToastQueue.length === 0) return;
    this.portraitToastActive = true;
    this.panel.setStatusChipsSuppressed(true);
    const toast = this.portraitToastQueue.shift()!;
    const lane = PORTRAIT_HEADER_TOAST_LANE;
    const centerY = lane.y + lane.height / 2;
    const label = makeText(
      this, lane.x + lane.width / 2, centerY, toast.text, toast.fontSize,
      `#${toast.color.toString(16).padStart(6, '0')}`, true,
    ).setOrigin(0.5).setDepth(Math.max(16, toast.depth)).setAlign('center')
      .setWordWrapWidth(lane.width - 12, true).setBackgroundColor('#0d0d13')
      .setPadding(6, 3, 6, 3).setShadow(0, 1, '#000000', 4);
    if (!this.reducedMotion()) label.setScale(0.96);
    this.tweens.add({
      targets: label,
      y: this.reducedMotion() ? centerY : centerY - 3,
      scale: 1,
      alpha: 0,
      delay: 360,
      duration: this.reducedMotion() ? 420 : 620,
      ease: 'Cubic.Out',
      onComplete: () => {
        label.destroy();
        this.portraitToastActive = false;
        if (this.portraitToastQueue.length > 0) this.showNextPortraitToast();
        else this.panel.setStatusChipsSuppressed(false);
      },
    });
  }

  private celebrate(rank: HandRank, newlyDiscovered = false): void {
    const portrait = isPortraitLayout();
    const localizedHand = handName(rank, HAND_NAMES_KO[rank]);
    const text = newlyDiscovered
      ? `${localizedHand}!\nHIDDEN DISCOVERED`
      : `${localizedHand}!`;
    if (portrait) {
      this.flashCenter(text, 0xe6c84f, 18, { fontSize: newlyDiscovered ? 10 : 12 });
      return;
    }
    const label = makeText(
      this, 390, 280, text,
      newlyDiscovered ? 34 : 44,
      newlyDiscovered ? '#ffe27a' : UI.gold, true,
    )
      .setOrigin(0.5)
      .setAlign('center')
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
    this.showRelicTriggers(result.relicTriggers, 'combat');
    this.collectTacticFx(result.tacticEvents);
    if (result.escaped.length > 0) {
      this.flashCenter(
        this.core.defeatReason === 'boss-escaped'
          ? tr('보스 출구 돌파 · 즉시 패배', 'BOSS ESCAPED · DEFEAT')
          : tr(
            `적 ${result.escaped.length}기 탈출 · 라이프 −${this.core.lastLifeDamage} · 남은 ${this.core.lives}`,
            `${result.escaped.length} ESCAPED · LIVES −${this.core.lastLifeDamage} · ${this.core.lives} LEFT`,
          ),
        UI.danger,
      );
      if (!this.reducedMotion()) this.cameras.main.shake(140, 0.003);
      this.audio.play('lose');
    }
    for (const event of result.bossEvents) {
      if (event.type === 'tax') {
        this.flashCenter(tr(`황금 폭군  −${event.amount}G`, `GOLD TYRANT  −${event.amount}G`), UI.danger);
      } else {
        this.flashCenter(tr(`군단왕  부하 +${event.count}`, `LEGION KING  MINIONS +${event.count}`), 0x8a58b5);
      }
      const boss = this.core.field.enemies.find(
        (enemy) => enemy.alive && enemy.kind === 'boss' && enemy.round === event.bossRound,
      );
      if (boss) {
        const at = enemyPos(boss);
        this.fx.push({
          kind: 'bossAbility',
          x1: at.x, y1: at.y, x2: at.x, y2: at.y,
          ttl: 0.7, duration: 0.7,
          color: event.type === 'tax' ? 0xffce4a : 0xa875ff,
          tier: HandRank.HighCard,
          targetKind: 'boss',
          targetRound: boss.round,
          bossAbility: event.type,
          seed: boss.id * 61,
        });
      }
      if (!this.reducedMotion()) this.cameras.main.shake(110, event.type === 'tax' ? 0.0022 : 0.0016);
      this.audio.play('boss');
    }
    const max = attackFxBudget(this.compactFx);
    for (const atk of result.attacks) {
      if (this.fx.length >= max) break;
      const unit = this.core.field.units.find((u) => u.id === atk.unitId);
      const enemy = this.core.field.enemies.find((e) => e.id === atk.targetId);
      if (!unit || !enemy) continue;
      const from = unitPos(unit);
      const to = enemyPos(enemy);
      this.fx.push({
        kind: 'attack',
        unitId: unit.id,
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        ttl: unit.tier === HandRank.RoyalFlush ? 0.34 : 0.2,
        duration: unit.tier === HandRank.RoyalFlush ? 0.34 : 0.2,
        color: this.core.handTactic?.round === enemy.round && this.core.handTactic.id === 'volley'
          ? 0x65bfff
          : this.core.handTactic?.round === enemy.round && this.core.handTactic.id === 'royal-decree'
            ? 0xe6c84f
            : unit.suit ? SUIT_COLORS[unit.suit] : UNIT_DEFS[unit.tier].color,
        tier: unit.tier,
        targetKind: enemy.kind,
        targetRound: enemy.round,
        seed: atk.targetId * 31 + atk.unitId,
      });
      if (!this.damageLabelShownThisFrame) {
        this.damageLabelShownThisFrame = true;
        const damageAt = fieldScreenPoint(to.x, to.y);
        const damage = makeText(
          this,
          damageAt.x,
          damageAt.y - (isPortraitLayout() ? 7 : 12),
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
    for (const enemy of result.deaths) {
      if (this.fx.length >= totalFxBudget(this.compactFx)) break;
      const at = enemyPos(enemy);
      this.fx.push({
        kind: 'death',
        x1: at.x, y1: at.y, x2: at.x, y2: at.y,
        ttl: enemy.kind === 'boss' ? 0.8 : 0.46,
        duration: enemy.kind === 'boss' ? 0.8 : 0.46,
        color: ENEMY_KINDS[enemy.kind].color,
        tier: HandRank.HighCard,
        targetKind: enemy.kind,
        seed: enemy.id * 47,
      });
    }
    if (result.deaths.length > 0 && !this.cameraShakenThisFrame && !this.reducedMotion()) {
      this.cameraShakenThisFrame = true;
      this.cameras.main.shake(Math.min(130, 45 + result.deaths.length * 5), 0.0014);
    }
  }

  private collectTacticFx(events: readonly TacticCombatEvent[]): void {
    let labels = 0;
    const labelBudget = tacticFeedbackBudget(this.compactFx);
    const canShowLabel = () => labels < labelBudget
      && canCreateTacticFeedback(this.tacticFeedbackTweens.size, this.compactFx);
    for (const event of events) {
      if (event.type === 'royal-bounty') {
        if (canShowLabel()) {
          labels++;
          this.showTacticEventLabel(
            isPortraitLayout() ? 340 : 1165,
            isPortraitLayout() ? 92 : 62,
            tr(`왕명 +${event.amount}G`, `ROYAL +${event.amount}G`),
            '#ffe27a',
          );
        }
        continue;
      }
      const point = event.type === 'overflow'
        ? { x: event.x2, y: event.y2 }
        : { x: event.x, y: event.y };
      const at = fieldScreenPoint(point.x, point.y);
      if (canShowLabel()) {
        labels++;
        const text = event.type === 'focus-stack'
          ? tr(`집중 ${event.stage}/5`, `FOCUS ${event.stage}/5`)
          : event.type === 'fourth-strike'
            ? tr(`4타 ${Math.round(event.damage)}`, `4TH ${Math.round(event.damage)}`)
            : tr(`전이 ${Math.round(event.damage)}`, `TRANSFER ${Math.round(event.damage)}`);
        this.showTacticEventLabel(at.x, at.y - (isPortraitLayout() ? 8 : 14), text,
          event.type === 'fourth-strike' ? '#ffe27a' : event.type === 'overflow' ? '#e4d7ff' : '#b7e5ff');
      }
      if (this.reducedMotion() || this.fx.length >= totalFxBudget(this.compactFx)) continue;
      const enemy = this.core.field.enemies.find((candidate) => candidate.id === (
        event.type === 'overflow' ? event.toEnemyId : event.enemyId
      ));
      this.fx.push({
        kind: 'tactic',
        tacticType: event.type,
        unitId: event.unitId,
        x1: event.type === 'overflow' ? event.x1 : point.x,
        y1: event.type === 'overflow' ? event.y1 : point.y,
        x2: point.x,
        y2: point.y,
        ttl: event.type === 'overflow' ? 0.34 : 0.28,
        duration: event.type === 'overflow' ? 0.34 : 0.28,
        color: event.type === 'fourth-strike' ? 0xffd45e : event.type === 'overflow' ? 0xb995ff : 0x65bfff,
        tier: HandRank.HighCard,
        targetKind: enemy?.kind ?? 'normal',
        targetRound: enemy?.round ?? this.core.round,
        seed: event.type === 'overflow' ? event.toEnemyId * 37 : event.enemyId * 37,
      });
    }
  }

  private showTacticEventLabel(x: number, y: number, text: string, color: string): void {
    const label = makeText(this, x, y, text, isPortraitLayout() ? 8 : 10, color, true)
      .setOrigin(0.5).setDepth(8).setShadow(0, 1, '#000000', 3);
    let tween!: Phaser.Tweens.Tween;
    tween = this.tweens.add({
      targets: label,
      y: y - (this.reducedMotion() ? 0 : 12),
      alpha: 0,
      delay: 120,
      duration: 360,
      onComplete: () => {
        this.tacticFeedbackTweens.delete(tween);
        label.destroy();
      },
    });
    this.tacticFeedbackTweens.add(tween);
  }

  private showRelicTriggers(ids: readonly RelicId[], context: 'hand' | 'exchange' | 'combat'): void {
    if (ids.length === 0) return;
    for (const id of ids) {
      const key = `${this.core.round}:${id}`;
      if (this.trackedRelicTriggers.has(key)) continue;
      this.trackedRelicTriggers.add(key);
      this.analytics.track('relic_triggered', {
        round: this.core.round,
        relic: id,
        context,
      }, this.runId);
    }
    const now = performance.now();
    if (now - this.lastRelicFeedbackAt < 1200) return;
    this.lastRelicFeedbackAt = now;
    if (isPortraitLayout()) {
      const names = ids.slice(0, 2).map((id) => relicName(id, RELIC_DEFS[id].name));
      const extra = ids.length > 2 ? tr(` 외 ${ids.length - 2}`, ` +${ids.length - 2} MORE`) : '';
      this.flashCenter(tr(`⚡ ${names.join(' · ')}${extra} 발동`, `⚡ ${names.join(' · ')}${extra} TRIGGERED`), UI.goldNum, 17);
    } else {
      this.panel.pulseRelics(ids);
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
        crownLevel: this.core.crownLevel,
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
      (enemy) => enemy.kind === 'boss' && enemy.round === roundBefore,
    );
    if (!originalBoss || this.trackedBossSurvivals.has(originalBoss.round)) return;

    const advancedPastBossRound = this.core.phase === 'prep' && this.core.round > roundBefore;
    const runEnded = this.core.phase === 'defeat';
    if (!advancedPastBossRound && !runEnded) return;

    this.trackedBossSurvivals.add(originalBoss.round);
    const outcome = this.core.defeatReason === 'final-boss-timeout'
      ? 'final_timeout'
      : this.core.defeatReason === 'boss-escaped'
        ? 'boss_escape'
      : runEnded ? 'field_cap' : 'round_timeout';
    this.analytics.track('boss_survived', {
      crownLevel: this.core.crownLevel,
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
      crownLevel: this.core.crownLevel,
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

  private wagerHudText(): string {
    const id = this.wagerState.selectedId;
    if (!id) return '';
    const definition = ROYAL_WAGERS[id];
    const copy = getLocale() === 'ko' ? definition.ko : definition.en;
    const suit = this.wagerState.lockedSuit ? ` ${SUIT_GLYPHS[this.wagerState.lockedSuit]}` : '';
    const complete = this.wagerState.progress >= definition.target;
    return `${complete ? '✓ ' : '♛ '}${copy.name}${suit}  ${this.wagerState.progress}/${definition.target}`;
  }

  private tacticHudText(): string {
    const tactic = this.core.handTactic;
    if (!tactic || tactic.round !== this.core.round) return '';
    const label = (isPortraitLayout() ? HAND_TACTIC_COMPACT_COPY : HAND_TACTIC_COPY)[tactic.id][getLocale()];
    const suit = tactic.id === 'suit-command' && tactic.suit
      ? ` · ${SUIT_GLYPHS[tactic.suit]}`
      : '';
    const zoneNames = ['TL', 'TR', 'BL', 'BR'];
    const zone = tactic.id === 'stronghold' && tactic.lockedZone !== null
      ? tr(` · 구역 ${zoneNames[tactic.lockedZone]}`, ` · ZONE ${zoneNames[tactic.lockedZone]}`)
      : '';
    return `♜ ${label}${suit}${zone}`;
  }

  private flashTacticActivation(): void {
    const tactic = this.core.handTactic;
    if (!tactic) return;
    const portrait = isPortraitLayout();
    const copy = (portrait ? HAND_TACTIC_COMPACT_COPY : HAND_TACTIC_COPY)[tactic.id][getLocale()];
    const text = tr(`♜ 전술 발동 · ${copy}`, `♜ TACTIC ACTIVE · ${copy}`);
    if (portrait) {
      this.flashCenter(text, tactic.id === 'royal-decree' ? 0xffe27a : 0xb7e5ff, 18, { fontSize: 11 });
      return;
    }
    const label = makeText(
      this,
      390,
      370,
      text,
      18,
      tactic.id === 'royal-decree' ? '#ffe27a' : '#b7e5ff',
      true,
    ).setOrigin(0.5).setDepth(11).setShadow(0, 2, '#000000', 6);
    if (!this.reducedMotion()) {
      label.setScale(0.92);
      this.tweens.add({ targets: label, scale: 1, duration: 180, ease: 'Cubic.Out' });
    }
    this.tweens.add({
      targets: label,
      alpha: 0,
      y: label.y - (this.reducedMotion() ? 0 : 12),
      delay: 820,
      duration: 400,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private wagerResultText(): string {
    const id = this.wagerState.selectedId;
    if (!id) return tr('왕실 내기 — 미선택', 'ROYAL WAGER — NONE');
    const definition = ROYAL_WAGERS[id];
    const copy = getLocale() === 'ko' ? definition.ko : definition.en;
    const outcome = royalWagerOutcome(this.wagerState);
    if (outcome === 'achieved-pending') return tr(
      `왕실 내기 달성 · ${copy.name} ${this.wagerState.progress}/${definition.target} · R10 보상 예정`,
      `ROYAL WAGER ACHIEVED · ${copy.name.toUpperCase()} ${this.wagerState.progress}/${definition.target} · REWARD AT R10`,
    );
    if (outcome === 'unfinished') return tr(
      `왕실 내기 미완료 · ${copy.name} ${this.wagerState.progress}/${definition.target}`,
      `ROYAL WAGER UNFINISHED · ${copy.name.toUpperCase()} ${this.wagerState.progress}/${definition.target}`,
    );
    const success = outcome === 'succeeded';
    return tr(
      `왕실 내기 ${success ? '성공' : '실패'} · ${copy.name} ${this.wagerState.progress}/${definition.target}`,
      `ROYAL WAGER ${success ? 'CLEARED' : 'FAILED'} · ${copy.name.toUpperCase()} ${this.wagerState.progress}/${definition.target}`,
    );
  }

  private formationMasteryResultText(): string {
    const mastery = this.core.formationMastery;
    if (isPortraitLayout()) return tr(
      `완벽 진형 ${mastery.perfectCount} · 최고 ×${mastery.bestStreak}\n진형 보너스 ${mastery.score.toLocaleString()}점`,
      `PERFECT FORMATIONS ${mastery.perfectCount} · BEST ×${mastery.bestStreak}\nFORMATION BONUS ${mastery.score.toLocaleString()}`,
    );
    return tr(
      `완벽 진형 ${mastery.perfectCount}회 · 최고 연속 ×${mastery.bestStreak} · 보너스 ${mastery.score.toLocaleString()}점`,
      `PERFECT FORMATIONS ${mastery.perfectCount} · BEST STREAK ×${mastery.bestStreak} · BONUS ${mastery.score.toLocaleString()}`,
    );
  }

  private resolveWagerIfNeeded(): void {
    const wagerId = this.wagerState.selectedId;
    if (this.core.round < 10 || !wagerId || this.wagerState.resolved) return;
    const result = resolveRoyalWager(this.wagerState, this.core.round);
    if (!result.state.resolved) return;
    this.wagerState = result.state;
    if (result.reward?.kind === 'gold') {
      this.core.grantWagerGold(result.reward.amount);
    } else if (result.reward?.kind === 'deck-seal') {
      this.core.grantDeckSeal(result.reward.id, result.reward.amount);
    }
    const definition = ROYAL_WAGERS[wagerId];
    this.analytics.track('wager_resolved', {
      wagerId,
      success: this.wagerState.succeeded,
      progress: this.wagerState.progress,
      target: definition.target,
      rewardType: definition.reward.kind,
      rewardAmount: definition.reward.amount,
      round: this.core.round,
    }, this.runId);
    const rewardText = definition.reward.kind === 'gold'
      ? tr(`+${definition.reward.amount}G 지급`, `+${definition.reward.amount}G PAID`)
      : tr(
        `${definition.reward.id === 'duplicate' ? '복제' : '추방'} 인장 ×${definition.reward.amount} 지급`,
        `${definition.reward.id.toUpperCase()} SEAL ×${definition.reward.amount} AWARDED`,
      );
    const portrait = isPortraitLayout();
    const height = portraitSceneHeight(this);
    this.flashCenter(
      this.wagerState.succeeded
        ? tr(`왕실 내기 성공 · ${rewardText}`, `ROYAL WAGER CLEARED · ${rewardText}`)
        : tr('왕실 내기 실패 · 페널티 없음', 'ROYAL WAGER FAILED · NO PENALTY'),
      this.wagerState.succeeded ? UI.goldNum : UI.danger,
      60,
      {
        x: portrait ? 195 : 640,
        y: portrait ? portraitY(height, 150) : 68,
        targetY: portrait ? portraitY(height, 120) : 48,
        fontSize: portrait ? 15 : 30,
        wrapWidth: portrait ? 350 : undefined,
      },
    );
  }

  // ── 종료 ──────────────────────────────────────────

  private showEnd(): void {
    this.ended = true;
    this.abandonedTracked = true;
    const won = this.core.phase === 'victory';
    const endMessage = won
      ? this.core.crownLevel > 0
        ? this.core.crownLevel < CROWN_MAX_LEVEL
          ? tr(`왕관 ${this.core.crownLevel}개의 최종 보스를 격파하고 다음 왕관을 해금했습니다`, `CROWN ${this.core.crownLevel} CLEARED · NEXT CROWN UNLOCKED`)
          : tr(`최고 왕관 ${CROWN_MAX_LEVEL}개의 원정을 정복했습니다`, `MAX CROWN ${CROWN_MAX_LEVEL} CONQUERED`)
        : tr('최종 보스를 격파하고 왕좌를 지켰습니다', 'THE FINAL BOSS IS DEFEATED · THE THRONE IS SAFE')
      : this.core.defeatReason === 'final-boss-timeout'
        ? tr('제한시간 안에 최종 보스를 격파하지 못했습니다', 'THE FINAL BOSS SURVIVED THE TIME LIMIT')
        : this.core.defeatReason === 'boss-escaped'
          ? tr(`라운드 ${this.core.round}의 보스가 출구를 돌파했습니다`, `THE ROUND ${this.core.round} BOSS REACHED THE EXIT`)
        : this.core.defeatReason === 'life-depleted'
          ? tr(`라운드 ${this.core.round}에서 왕국의 라이프를 모두 잃었습니다`, `ALL KINGDOM LIVES WERE LOST IN ROUND ${this.core.round}`)
        : tr(`라운드 ${this.core.round}에서 필드가 뚫렸습니다`, `THE FIELD FELL IN ROUND ${this.core.round}`);
    this.audio.play(won ? 'win' : 'lose');
    this.profile = recordRun(this.profile, this.core.summary(), this.mode, this.runDate);
    saveProfile(localStorage, this.profile);
    const analysis = won ? null : analyzeDefeat({
      reason: this.core.defeatReason,
      round: this.core.round,
      lives: this.core.lives,
      fieldCap: this.core.fieldCap,
      enemies: this.core.field.enemies,
      unitTiers: this.core.field.units.map((unit) => unit.tier),
      upgradeLevel: this.core.upgradeLevel,
      bestHand: this.core.bestHand,
      relicCount: this.core.relics.length,
      handMastery: this.core.handMastery,
      handDamage: this.core.handDamage,
      lifeRoundHistory: this.core.lifeRoundHistory,
    });
    const portrait = isPortraitLayout();
    const portraitHeight = portraitSceneHeight(this);
    const py = (value: number) => portraitY(portraitHeight, value);
    const centerX = portrait ? 195 : 640;
    this.add.rectangle(centerX, portrait ? portraitHeight / 2 : 360, portrait ? 390 : 1280, portrait ? portraitHeight : 720, 0x000000, portrait ? 0.9 : 0.72).setDepth(20);
    if (portrait) {
      const endModeLabel = this.core.lifeMode
        ? this.core.crownLevel > 0 ? `LIFE · CROWN ${this.core.crownLevel}` : this.mode === 'daily' ? 'LIFE · DAILY' : 'LIFE'
        : this.core.crownLevel > 0 ? `CROWN ${this.core.crownLevel}` : this.mode === 'daily' ? 'DAILY' : 'CLASSIC';
      this.add.text(30, py(38), `${won ? '60 ROUNDS CLEARED' : 'RUN ENDED'} · ${endModeLabel}`, {
        fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: won ? UI.gold : UI.dangerText,
        letterSpacing: 2.2,
      }).setDepth(21);
    }
    this.add
      .text(centerX, portrait ? py(102) : won ? 280 : 96, portrait ? won ? 'VICTORY' : `ROUND ${this.core.round}` : won ? tr('승리!', 'VICTORY!') : tr('패배 분석', 'DEFEAT ANALYSIS'), {
        fontFamily: portrait ? FONT_DISPLAY : FONT, fontSize: portrait ? won ? '62px' : '54px' : won ? '56px' : '42px', fontStyle: 'bold',
        color: won ? UI.gold : UI.dangerText,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(centerX, portrait ? py(174) : won ? 350 : 154, portrait && !won ? tr(`${endMessage} · ${Math.max(0, 60 - this.core.round)}라운드 남았습니다`, `${endMessage} · ${Math.max(0, 60 - this.core.round)} ROUNDS REMAIN`) : endMessage, {
        fontFamily: FONT, fontSize: portrait ? '12px' : '20px', color: portrait ? '#a8a5b2' : UI.text,
        align: 'center', wordWrap: portrait ? { width: 350, useAdvancedWrap: true } : undefined,
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.add
      .text(centerX, portrait ? py(226) : won ? 392 : 194, `SCORE  ${this.core.score.toLocaleString()}   ·   KILLS  ${this.core.kills.toLocaleString()}\n${this.formationMasteryResultText()}\n${this.wagerResultText()}`, {
        fontFamily: portrait ? FONT_MONO : FONT, fontSize: portrait ? '12px' : '14px', color: UI.gold, align: 'center', lineSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(21);
    if (won) {
      this.add.text(centerX, portrait ? py(290) : 438, `${tr('연마 효율', 'MASTERY IMPACT')}  ${this.masteryOutcomeLabel()}`, {
        fontFamily: FONT, fontSize: '14px', color: '#f0c879',
      }).setOrigin(0.5).setDepth(21);
    }
    if (analysis) this.renderDefeatAnalysis(analysis);
    const summary = this.core.summary();
    const damageLeaders = Object.entries(this.core.handDamage)
      .map(([rank, damage]) => ({ rank: Number(rank), damage: Math.round(damage) }))
      .filter((entry) => entry.damage > 0)
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 5);
    const masteryRanks = Object.entries(this.core.handMastery)
      .map(([rank, level]) => ({ rank: Number(rank), level }))
      .filter((entry) => entry.level > 0);
    this.analytics.track('run_finished', {
      mode: this.mode,
      ruleset: this.core.ruleset,
      crownLevel: this.core.crownLevel,
      result: summary.result,
      round: summary.round,
      score: summary.score,
      kills: summary.kills,
      bestHand: summary.bestHand,
      upgradeLevel: summary.upgradeLevel,
      relics: [...summary.relics],
      durationSeconds: this.elapsedSeconds(),
      firstRun: this.firstRun,
      tutorialDone: this.profile.tutorialDone,
      locale: getLocale(),
      layout: isPortraitLayout() ? 'portrait' : 'landscape',
      wagerId: this.wagerState.selectedId,
      wagerSuccess: this.wagerState.selectedId ? (this.wagerState.succeeded || this.wagerState.progress >= ROYAL_WAGERS[this.wagerState.selectedId].target) : false,
      masteryRanks: masteryRanks.map((entry) => entry.rank),
      masteryLevels: masteryRanks.map((entry) => entry.level),
      damageRanks: damageLeaders.map((entry) => entry.rank),
      ...(!this.core.lifeMode ? { damageValues: damageLeaders.map((entry) => entry.damage) } : {}),
      ...(analysis ? { defeatCause: this.core.defeatReason ?? 'unknown' } : {}),
      ...(analysis && this.core.lifeMode ? {
        escapedEnemies: this.core.escapedEnemies,
        lifeDamage: this.core.lifeDamageTaken,
        topEscapedKind: analysis.topEscapedKind,
        worstLifeRound: analysis.worstLifeRound,
        worstLifeDamage: analysis.worstLifeDamage,
      } : analysis ? {
        aliveEnemies: analysis.aliveEnemies,
        bossHpPercent: analysis.bossHpPercent,
      } : {}),
    }, this.runId);
    this.renderEndFeedback(centerX, portrait, py, won ? 'victory' : 'defeat', summary.round);
    const date = this.runDate;
    const btn = makeButton(this, centerX, portrait ? py(700) : won ? 474 : 510, portrait ? 330 : 220, portrait ? 60 : 52, portrait ? tr('같은 조건으로 다시 도전', 'RETRY SAME RUN') : tr('다시 시작', 'PLAY AGAIN'), () => {
      this.analytics.track('retry_clicked', { mode: this.mode, round: summary.round }, this.runId);
      const nextSeed = this.mode === 'daily' ? this.seedValue : (this.seedValue * 31 + 17) >>> 0;
      this.scene.restart({ seed: nextSeed, mode: this.mode, date: this.runDate, retry: true, crownLevel: this.core.crownLevel });
    }, {
      fill: portrait ? UI.goldNum : UI.accent,
      textColor: portrait ? UI.goldInk : UI.goldInk,
      fontSize: portrait ? 17 : 18,
      stroke: portrait ? UI.goldNum : UI.accent,
      strokeAlpha: 0.5,
    });
    btn.container.setDepth(22);
    const actionY = portrait ? py(770) : won ? 536 : 568;
    // 정식 LIFE 규칙과 클래식 보존판의 점수가 한 랭킹에 섞이지 않도록
    // 온라인 일일 랭킹 등록은 현재 정식 규칙에서만 허용한다.
    if (this.mode === 'daily' && this.core.lifeMode) {
      const ranking = makeButton(this, portrait ? centerX : 384, portrait ? py(632) : actionY, portrait ? 330 : 220, portrait ? 44 : 42, tr('일일 랭킹 등록', 'SUBMIT DAILY SCORE'), async () => {
        ranking.setEnabled(false);
        ranking.setLabel(tr('등록 중…', 'SUBMITTING…'));
        try {
          const result = await submitDailyScore({
            date,
            playerId: this.profile.leaderboardPlayerId,
            name: this.profile.leaderboardName,
            summary,
          });
          ranking.setLabel(tr(`등록 완료 · #${result.rank}`, `SUBMITTED · #${result.rank}`));
          this.analytics.track('leaderboard_submitted', {
            date,
            rank: result.rank,
            score: result.bestScore,
            accepted: result.accepted,
          }, this.runId);
          this.flashCenter(tr(`#${result.rank} · 일일 랭킹 등록 완료`, `#${result.rank} · DAILY SCORE SUBMITTED`), 0xe6c84f, 24);
        } catch {
          ranking.setLabel(tr('등록 실패 · 다시 시도', 'FAILED · TRY AGAIN'));
          ranking.setEnabled(true);
        }
      }, { fill: 0x9f74cf, fontSize: 14 });
      ranking.container.setDepth(22);
      if (!leaderboardConfigured()) {
        ranking.setLabel(tr('랭킹 서버 준비 중', 'RANKING SERVER COMING SOON'));
        ranking.setEnabled(false);
      }
    }
    const shareX = portrait ? 75 : this.mode === 'daily' ? 640 : 512;
    const cardX = portrait ? 195 : this.mode === 'daily' ? 896 : 768;
    const share = makeButton(this, shareX, actionY, portrait ? 102 : 220, portrait ? 50 : 42, portrait ? tr('공유', 'SHARE') : tr('결과 공유', 'SHARE RESULT'), async () => {
      try {
        const result = await shareRun(summary, this.mode, date);
        this.analytics.track('result_shared', { method: result, mode: this.mode }, this.runId);
        this.flashCenter(result === 'shared' ? tr('결과를 공유했습니다', 'RESULT SHARED') : tr('링크를 복사했습니다', 'LINK COPIED'), UI.accent, 24);
      } catch {
        // 사용자가 공유 창을 닫은 경우 게임 흐름은 그대로 유지한다.
      }
    }, { fill: 0xe6c84f, fontSize: 14 });
    share.container.setDepth(22);
    const card = makeButton(this, cardX, actionY, portrait ? 102 : 220, portrait ? 50 : 42, portrait ? 'PNG' : tr('PNG 카드 저장', 'SAVE PNG CARD'), () => {
      downloadShareCard(summary, this.mode, date);
      this.flashCenter(tr('PNG 카드를 저장했습니다', 'PNG CARD SAVED'), 0x6ca4d9, 24);
    }, { fill: 0x6ca4d9, fontSize: 14 });
    card.container.setDepth(22);
    const home = makeButton(this, portrait ? 315 : 640, portrait ? actionY : won ? 594 : 626, portrait ? 102 : 180, portrait ? 50 : 40, portrait ? tr('메인', 'MENU') : tr('메인으로', 'MAIN MENU'), () => this.scene.start('menu'), { fill: 0x42544a });
    home.container.setDepth(22);
  }

  private renderDefeatAnalysis(analysis: DefeatAnalysis): void {
    if (isPortraitLayout()) {
      const portraitHeight = portraitSceneHeight(this);
      const py = (value: number) => portraitY(portraitHeight, value);
      this.add.rectangle(195, py(384), 330, 174, UI.panelDeep, 0.98)
        .setStrokeStyle(1, UI.panelLine, 1).setDepth(21);
      this.add.rectangle(31, py(316), 2, 136, UI.danger, 1).setOrigin(0, 0).setDepth(22);
      this.add.text(46, py(330), tr('사망 원인', 'DEFEAT CAUSE'), {
        fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: UI.dangerText,
      }).setDepth(22);
      this.add.text(46, py(355), analysis.cause, {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: UI.text,
        wordWrap: { width: 292 },
      }).setDepth(22);
      this.add.text(46, py(404), `${analysis.boss} · ${analysis.build}`, {
        fontFamily: FONT, fontSize: '12px', color: UI.textDim, wordWrap: { width: 292 },
      }).setDepth(22);
      if (analysis.lifeDetails.length > 0) {
        this.add.text(46, py(432), analysis.lifeDetails.join(' · '), {
          fontFamily: FONT, fontSize: '10px', color: '#ffaaa3', lineSpacing: 1,
          wordWrap: { width: 292, useAdvancedWrap: true },
        }).setDepth(22);
      }
      this.add.rectangle(195, py(536), 330, 142, UI.panel, 0.98)
        .setStrokeStyle(1, UI.goldNum, 0.22).setDepth(21);
      this.add.text(46, py(476), 'NEXT RUN', {
        fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.gold, letterSpacing: 2,
      }).setDepth(22);
      this.add.text(46, py(500), analysis.tips.slice(0, 3).map((tip, index) => `0${index + 1}  ${tip}`).join('\n'), {
        fontFamily: FONT, fontSize: '12px', color: UI.text, lineSpacing: 12,
        wordWrap: { width: 292 },
      }).setDepth(22);
      return;
    }
    this.add.rectangle(640, 342, 900, 250, UI.panelDeep, 0.98)
      .setStrokeStyle(1, UI.panelLine, 1)
      .setDepth(21);
    this.add.text(226, 232, tr('전투 리포트', 'BATTLE REPORT'), {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.gold,
    }).setDepth(22);
    this.add.text(226, 264, analysis.cause, {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: UI.text,
    }).setDepth(22);
    this.add.text(226, 298, `${analysis.boss}   ·   ${analysis.build}`, {
      fontFamily: FONT, fontSize: '14px', color: UI.textDim,
    }).setDepth(22);
    this.add.text(226, 328, analysis.lifeDetails.length > 0
      ? analysis.lifeDetails.join('   ·   ')
      : `${tr('연마 효율', 'MASTERY IMPACT')}  ${analysis.mastery}`, {
      fontFamily: FONT, fontSize: '13px', color: analysis.lifeDetails.length > 0 ? '#ffaaa3' : '#f0c879',
    }).setDepth(22);
    this.add.text(226, 356, tr('다음 시도', 'NEXT RUN'), {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.gold,
    }).setDepth(22);
    this.add.text(226, 387, analysis.tips.map((tip) => `• ${tip}`).join('\n'), {
      fontFamily: FONT, fontSize: '14px', color: UI.text, lineSpacing: 8,
      wordWrap: { width: 820 },
    }).setDepth(22);
  }

  private renderEndFeedback(
    centerX: number,
    portrait: boolean,
    py: (value: number) => number,
    result: 'victory' | 'defeat',
    round: number,
  ): void {
    const x = portrait ? centerX : 1082;
    const promptY = portrait ? py(620) : 92;
    const buttonY = portrait ? py(650) : 142;
    if (!portrait) {
      this.add.rectangle(x, 140, 316, 146, UI.panelDeep, 0.96)
        .setStrokeStyle(1, UI.goldNum, 0.28).setDepth(21);
    }
    const prompt = this.add.text(x, promptY, tr('이번 판 난이도는 어땠나요?', 'HOW WAS THE DIFFICULTY?'), {
      fontFamily: FONT, fontSize: portrait ? '12px' : '14px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(0.5).setDepth(23);
    const note = this.add.text(x, portrait ? py(670) : 194, this.analytics.remoteEnabled ? tr('익명으로 기록됩니다', 'RECORDED ANONYMOUSLY') : tr('DATA ON에서만 익명 전송됩니다', 'ANONYMOUSLY SENT ONLY WITH DATA ON'), {
      fontFamily: FONT, fontSize: portrait ? '9px' : '10px', color: UI.textDim,
    }).setOrigin(0.5).setDepth(23).setVisible(!portrait);
    const track = (question: 'difficulty' | 'replay_intent', answer: string): void => {
      this.analytics.track('run_feedback', {
        question,
        answer,
        mode: this.mode,
        ruleset: this.core.ruleset,
        crownLevel: this.core.crownLevel,
        result,
        round,
      }, this.runId);
    };
    const difficultyButtons = [
      { label: tr('쉬움', 'EASY'), value: 'easy' },
      { label: tr('적당함', 'BALANCED'), value: 'balanced' },
      { label: tr('어려움', 'HARD'), value: 'hard' },
    ].map((option, index) => {
      const button = makeButton(
        this,
        x + (index - 1) * (portrait ? 104 : 92),
        buttonY,
        portrait ? 96 : 84,
        portrait ? 34 : 36,
        option.label,
        () => {
          track('difficulty', option.value);
          difficultyButtons.forEach((item) => item.container.setVisible(false));
          prompt.setText(tr('다시 플레이하고 싶나요?', 'WOULD YOU PLAY AGAIN?'));
          replayButtons.forEach((item) => item.container.setVisible(true));
        },
        { fill: UI.panelRaised, textColor: UI.text, fontSize: portrait ? 11 : 12, strokeAlpha: 0.2 },
      );
      button.container.setDepth(23);
      return button;
    });
    const replayButtons = [
      { label: tr('다시 할래요', 'YES'), value: 'yes' },
      { label: tr('지금은 아니요', 'NOT NOW'), value: 'no' },
    ].map((option, index) => {
      const button = makeButton(
        this,
        x + (index === 0 ? -1 : 1) * (portrait ? 79 : 74),
        buttonY,
        portrait ? 146 : 136,
        portrait ? 34 : 36,
        option.label,
        () => {
          track('replay_intent', option.value);
          replayButtons.forEach((item) => item.container.setVisible(false));
          prompt.setText(tr('피드백 고마워요!', 'THANKS FOR THE FEEDBACK!'));
          note.setText(this.analytics.remoteEnabled ? tr('다음 밸런스 조정에 반영할게요', 'WE WILL USE IT FOR THE NEXT BALANCE PASS') : tr('DATA ON 시 다음부터 익명 기록됩니다', 'ENABLE DATA TO RECORD FUTURE FEEDBACK'));
        },
        { fill: option.value === 'yes' ? UI.goldNum : UI.panelRaised, textColor: option.value === 'yes' ? UI.goldInk : UI.textDim, fontSize: portrait ? 11 : 12 },
      );
      button.container.setDepth(23).setVisible(false);
      return button;
    });
  }

  private masteryOutcomeLabel(): string {
    const entries = Object.entries(this.core.handDamage)
      .map(([rank, damage]) => ({ rank: Number(rank) as HandRank, damage }))
      .filter((entry) => entry.damage > 0)
      .sort((a, b) => b.damage - a.damage);
    const total = entries.reduce((sum, entry) => sum + entry.damage, 0);
    const main = entries[0];
    if (!main || total <= 0) return tr('피해 기록 없음', 'NO DAMAGE DATA');
    const share = Math.round((main.damage / total) * 100);
    return tr(`주력 ${HAND_NAMES_KO[main.rank]} ${share}% · Lv${this.core.handMastery[main.rank] ?? 0}`, `MAIN ${handName(main.rank, HAND_NAMES_KO[main.rank])} ${share}% · Lv${this.core.handMastery[main.rank] ?? 0}`);
  }

  private reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private trackCombatStarted(): void {
    if (this.firstCombatTracked) return;
    this.firstCombatTracked = true;
    if (this.firstRun) this.trackOnboardingStep('combat_started');
    this.analytics.track('combat_started', {
      round: this.core.round, firstRun: this.firstRun, tutorialDone: this.profile.tutorialDone,
      locale: getLocale(), layout: isPortraitLayout() ? 'portrait' : 'landscape',
      durationSeconds: this.elapsedSeconds(), ruleset: this.core.ruleset,
    }, this.runId);
  }

  private trackRoundProgress(): void {
    if (this.core.round <= this.lastTrackedRound) return;
    this.lastTrackedRound = this.core.round;
    if (this.firstRun && !this.profile.tutorialDone && this.core.round >= 2) {
      this.profile.tutorialDone = true;
      saveProfile(localStorage, this.profile);
      this.trackOnboardingStep('first_combat_cleared');
      this.analytics.track('tutorial_finished', {
        result: 'completed', round: this.core.round, firstRun: true, tutorialDone: true,
        locale: getLocale(), layout: isPortraitLayout() ? 'portrait' : 'landscape',
        durationSeconds: this.elapsedSeconds(), ruleset: this.core.ruleset,
      }, this.runId);
    }
    if ([2, 5, 10, 20, 30, 40, 50, 60].includes(this.core.round)) {
      this.analytics.track('round_reached', {
        round: this.core.round,
        score: this.core.score,
        units: this.core.field.units.length,
        relics: this.core.relics.length,
        firstRun: this.firstRun,
        tutorialDone: this.profile.tutorialDone,
        locale: getLocale(),
        durationSeconds: this.elapsedSeconds(),
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
      crownLevel: this.core.crownLevel,
      phase: this.core.phase,
      round: summary.round,
      score: summary.score,
      durationSeconds: this.elapsedSeconds(),
      firstRun: this.firstRun,
      tutorialDone: this.profile.tutorialDone,
      locale: getLocale(),
      layout: isPortraitLayout() ? 'portrait' : 'landscape',
      ruleset: this.core.ruleset,
    }, this.runId);
  }

  private elapsedSeconds(): number {
    return Math.max(0, Math.round((performance.now() - this.runStartedAt) / 1000));
  }

  private trackOnboardingStep(step: string): void {
    if (!this.firstRun || this.onboardingSteps.has(step)) return;
    this.onboardingSteps.add(step);
    this.analytics.track('onboarding_step', {
      step, round: this.core?.round ?? 1, locale: getLocale(),
      layout: isPortraitLayout() ? 'portrait' : 'landscape',
      durationSeconds: this.elapsedSeconds(),
      ruleset: this.core?.ruleset ?? (isLifeLabLocation() ? 'life-economy' : 'classic'),
    }, this.runId);
  }

}
