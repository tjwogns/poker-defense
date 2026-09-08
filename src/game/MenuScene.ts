import Phaser from 'phaser';
import {
  ACHIEVEMENTS, dailyDate, dailySeed, ensureLeaderboardIdentity, exportPlaytestData, highestUnlockedCrown,
  loadProfile, Profile, saveProfile,
} from '../meta/profile';
import { dailyDateFromSearch } from '../meta/share';
import { dailyChallengeLabel } from './dailyChallengeLabel';
import { getAnalytics } from '../meta/analytics';
import { AnalyticsConsentOverlay } from './AnalyticsConsentOverlay';
import { FONT, FONT_DISPLAY, FONT_MONO, UI, makeButton, makeText } from './ui';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { PatchNotesOverlay } from './PatchNotesOverlay';
import { CURRENT_VERSION } from '../meta/patchNotes';
import { leaderboardConfigured } from '../meta/leaderboard';
import { isCompactTouchDevice, isPortraitLayout, setActiveLayoutMode } from './device';
import { preloadUnitSprites, unitSpriteKey } from './unitAssets';
import { HandRank } from '../core/cards/types';
import { preloadBossSprites } from './bossAssets';
import { preloadEnemySprites } from './enemyAssets';
import { preloadRelicSprites } from './relicAssets';
import { preloadFieldTextures } from './fieldAssets';
import { isLifeLabLocation } from './experiment';
import { portraitScale, portraitSceneHeight, portraitY, setActivePortraitHeight } from './layout';
import { MenuViewportRefresh, viewportCanvasLayout } from './viewportLayout';
import {
  CROWN_MAX_LEVEL, CrownLevel, crownBossHpMultiplier, crownEnemyHpMultiplier, crownSpeedMultiplier,
} from '../core/balance';
import { getLocale, setLocale, tr } from '../i18n';

export class MenuScene extends Phaser.Scene {
  private dailyMenuLabel = '';
  private selectedMenuCrown: CrownLevel | null = null;
  private viewportRefresh?: MenuViewportRefresh;
  private viewportModals = new Set<string>();
  private viewportRebuild = false;
  constructor() {
    super('menu');
  }

  preload(): void {
    preloadUnitSprites(this);
    preloadBossSprites(this);
    preloadEnemySprites(this);
    preloadRelicSprites(this);
    preloadFieldTextures(this);
  }

  create(data: { viewportRebuild?: boolean; crown?: CrownLevel } = {}): void {
    this.viewportRebuild = data.viewportRebuild === true;
    this.selectedMenuCrown = this.viewportRebuild ? data.crown ?? null : null;
    this.viewportModals.clear();
    const initialLayout = viewportCanvasLayout(window.innerWidth, window.innerHeight, window.visualViewport?.height);
    setActiveLayoutMode(initialLayout.mode);
    if (initialLayout.mode === 'portrait') setActivePortraitHeight(initialLayout.height);
    if (this.scale.width !== initialLayout.width || this.scale.height !== initialLayout.height) {
      this.scale.setGameSize(initialLayout.width, initialLayout.height);
    }
    this.cameras.main.setViewport(0, 0, initialLayout.width, initialLayout.height);
    this.viewportRefresh = new MenuViewportRefresh(() => this.viewportModals.size > 0, () => {
      const next = viewportCanvasLayout(window.innerWidth, window.innerHeight, window.visualViewport?.height);
      if (next.width === this.scale.width && next.height === this.scale.height) return;
      this.scene.restart({ viewportRebuild: true, crown: this.selectedMenuCrown });
    });
    const onViewportChange = () => this.viewportRefresh?.request();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.viewportRefresh?.dispose();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
    });
    const bootSplash = document.getElementById('boot-splash');
    bootSplash?.classList.add('ready');
    window.setTimeout(() => bootSplash?.remove(), 320);

    let profile = ensureLeaderboardIdentity(loadProfile(localStorage), undefined, getLocale());
    saveProfile(localStorage, profile);
    const lifeLab = isLifeLabLocation();
    const analytics = getAnalytics();
    const date = dailyDate();
    const challengeDate = dailyDateFromSearch(window.location.search, date);
    const hasChallenge = new URLSearchParams(window.location.search).get('daily') === challengeDate;
    // QA record is label-only: never assigned to the saved profile or passed to a run.
    const dailyBestFixture = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && new URLSearchParams(window.location.search).get('visualTest') === 'daily-best-menu';
    const dailyForLabel = dailyBestFixture ? { date: challengeDate, bestScore: Number.MAX_SAFE_INTEGER } : profile.daily;
    this.dailyMenuLabel = dailyChallengeLabel(dailyForLabel, challengeDate, hasChallenge);
    const localVisualTest = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
      ? new URLSearchParams(window.location.search).get('visualTest')
      : null;
    if (localVisualTest === 'crown-menu') {
      profile = { ...profile, wins: Math.max(1, profile.wins), standardWins: Math.max(1, profile.standardWins) };
    } else if (localVisualTest && !dailyBestFixture) {
      this.viewportRefresh?.dispose();
      this.scene.start('play', {
        seed: 20260901,
        mode: 'standard',
        crownLevel: localVisualTest === 'crown-play' ? 1 : 0,
      });
      return;
    }
    const maxCrown = highestUnlockedCrown(profile);
    if (isPortraitLayout()) {
      this.createPortraitMenu(profile, challengeDate, hasChallenge, lifeLab);
      return;
    }
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x0d0c14, 0x1a1424, 0x08080c, 0x0d0c14, 1);
    graphics.fillRect(0, 0, 1280, 720);
    graphics.lineStyle(1, UI.goldNum, 0.17).strokeRect(26, 26, 1228, 668);
    graphics.lineStyle(1, UI.goldNum, 0.07).strokeRect(32, 32, 1216, 656);
    for (let i = 0; i < 96; i++) {
      graphics.fillStyle(0xffffff, 0.018 + (i % 3) * 0.006);
      graphics.fillCircle(42 + ((i * 137) % 1190), 34 + ((i * 83) % 646), 1);
    }
    this.add.text(610, 332, '♠', {
      fontFamily: FONT_DISPLAY, fontSize: '620px', color: UI.gold, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.028);

    const dragon = this.add.image(1120, 615, unitSpriteKey(HandRank.RoyalFlush, window.location.search)!)
      .setDisplaySize(340, 340).setAlpha(0.38).setTint(0xc9bda4);
    this.tweens.add({ targets: dragon, y: 608, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    graphics.lineStyle(1, UI.goldNum, 0.9).lineBetween(88, 98, 114, 98);
    this.add.text(126, 91, 'POKER DEFENSE', {
      fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: UI.gold,
      letterSpacing: 3.7,
    });
    if (lifeLab) makeText(this, 330, 91, 'LIFE SIEGE', 11, '#7fd9a4', true).setLetterSpacing(2);
    this.add.text(88, 112, 'ROYAL\nSIEGE', {
      fontFamily: FONT_DISPLAY,
      fontSize: '112px',
      fontStyle: 'bold',
      color: UI.text,
      lineSpacing: -27,
    });
    makeText(
      this, 92, 382,
      lifeLab
        ? tr('적 탈출 1기당 라이프 1을 잃습니다. 교차로에서 60라운드를 방어하세요.', 'Each escaped enemy costs 1 life. Defend the crossroads through 60 rounds.')
        : tr('다섯 장의 패로 군단을 뽑고, 순환하는 전장에서 60라운드를 버텨냅니다.', 'Turn five-card poker hands into an army and survive 60 rounds.'),
      17, '#a8a5b2',
    ).setWordWrapWidth(470, true).setLineSpacing(10);

    let selectedCrown = Math.min(this.selectedMenuCrown ?? maxCrown, maxCrown) as CrownLevel;
    makeText(this, 92, 458, tr('원정 난이도', 'EXPEDITION DIFFICULTY'), 11, UI.textDim, true).setLetterSpacing(1.2);
    const crownLabel = makeText(this, 292, 458, '', 15, UI.gold, true).setOrigin(0.5, 0);
    const crownDescription = makeText(this, 92, 558, '', 12, '#74727e');
    const crownPrev = makeButton(this, 208, 468, 42, 36, '‹', () => {
      if (selectedCrown > 0) selectedCrown = (selectedCrown - 1) as CrownLevel;
      refreshCrownSelector();
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 24, radius: 18, stroke: UI.goldNum, strokeAlpha: 0.25 });
    const crownNext = makeButton(this, 376, 468, 42, 36, '›', () => {
      if (selectedCrown < maxCrown) selectedCrown = (selectedCrown + 1) as CrownLevel;
      refreshCrownSelector();
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 24, radius: 18, stroke: UI.goldNum, strokeAlpha: 0.25 });
    const refreshCrownSelector = () => {
      this.selectedMenuCrown = selectedCrown;
      crownLabel.setText(selectedCrown === 0 ? tr('♛ 왕관 0개 · 기본', '♛ CROWN 0 · BASE') : tr(`♛ 왕관 ${selectedCrown}개`, `♛ CROWN ${selectedCrown}`));
      crownDescription.setText(crownDifficultyDescription(selectedCrown, maxCrown));
      crownPrev.setEnabled(selectedCrown > 0);
      crownNext.setEnabled(selectedCrown < maxCrown);
    };
    refreshCrownSelector();
    makeButton(this, 230, 518, 276, 64, tr('원정 시작', 'START EXPEDITION'), () => {
      this.viewportRefresh?.dispose();
      this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard', crownLevel: selectedCrown });
    }, { fill: UI.goldNum, fontSize: 19, radius: 32, stroke: UI.goldNum, strokeAlpha: 0.5 });
    makeButton(this, 516, 518, 236, 64, this.dailyMenuLabel, () => {
      this.viewportRefresh?.dispose();
      this.scene.start('play', { seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate });
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: this.dailyMenuLabel.includes('\n') ? 12 : 16, radius: 33, stroke: 0xf2ede3, strokeAlpha: 0.22 });

    const recordX = 948;
    this.add.text(recordX, 110, 'COMMANDER RECORD', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#74727e', letterSpacing: 2.8,
    });
    const recordRight = 1218;
    const line = (y: number, gold = false) => graphics.lineStyle(1, gold ? UI.goldNum : 0xf2ede3, gold ? 0.2 : 0.09)
      .lineBetween(recordX, y, recordRight, y);
    line(134, true);
    makeText(this, recordX, 174, tr('최고 점수', 'BEST SCORE'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 147, profile.bestScore.toLocaleString(), {
      fontFamily: FONT_DISPLAY, fontSize: '42px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);
    line(214);
    makeText(this, recordX, 237, tr('최고 라운드', 'BEST ROUND'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 224, `${profile.bestRound} / 60`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(258);
    makeText(this, recordX, 283, tr('승리 · 출전', 'WINS · RUNS'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 270, `${profile.wins} · ${profile.totalRuns}`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(304);
    makeText(this, recordX, 329, maxCrown > 0 ? tr('왕관 기록', 'CROWN RECORD') : tr('업적', 'ACHIEVEMENTS'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 316, maxCrown > 0
      ? tr(`♛${profile.highestCrownCleared} · ${profile.crownWins}승`, `♛${profile.highestCrownCleared} · ${profile.crownWins} WINS`)
      : `${profile.achievements.length} / ${Object.keys(ACHIEVEMENTS).length}`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: maxCrown > 0 ? UI.gold : UI.text,
    }).setOrigin(1, 0);
    line(366, true);
    this.add.text(recordX, 386, 'DAILY TOP 10', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.gold, letterSpacing: 2,
    });
    let leaderboardOverlay: LeaderboardOverlay | null = null;
    const closeLeaderboard = () => {
      leaderboardOverlay?.destroy();
      leaderboardOverlay = null;
      this.closeViewportModal('leaderboard');
    };
    const onlineRankingEnabled = leaderboardConfigured();
    const rankingLink = makeText(
      this, recordRight, 385,
      onlineRankingEnabled ? tr('내 순위 보기  →', 'VIEW MY RANK  →') : tr('랭킹 연결 대기', 'RANKING OFFLINE'),
      12, onlineRankingEnabled ? UI.textDim : UI.textFaint, true,
    ).setOrigin(1, 0).setInteractive({ useHandCursor: onlineRankingEnabled });
    rankingLink.on('pointerdown', () => {
      if (!onlineRankingEnabled) return;
      if (leaderboardOverlay) return;
      this.viewportModals.add('leaderboard');
      leaderboardOverlay = new LeaderboardOverlay(
        this,
        challengeDate,
        profile.leaderboardPlayerId,
        profile.leaderboardName,
        closeLeaderboard,
      );
      analytics.track('leaderboard_viewed', { date: challengeDate });
    });
    this.input.keyboard?.on('keydown-ESC', closeLeaderboard);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', closeLeaderboard));

    const sound = makeButton(this, 163, 642, 38, 38, profile.soundEnabled ? '♪' : '×', () => {
      profile = { ...profile, soundEnabled: !profile.soundEnabled };
      saveProfile(localStorage, profile);
      sound.setLabel(profile.soundEnabled ? '♪' : '×');
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 15, radius: 19, strokeAlpha: 0.16 });
    const openData = () => {
      if (this.viewportModals.has('consent')) return;
      this.viewportModals.add('consent');
      return new AnalyticsConsentOverlay(this, (allowed) => {
        analytics.setConsent(allowed ? 'granted' : 'denied');
        if (allowed) analytics.track('menu_view', { source: 'consent_overlay', challenge: hasChallenge });
        this.closeViewportModal('consent');
      });
    };
    makeButton(this, 215, 642, 38, 38, 'i', openData, {
      fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 19, strokeAlpha: 0.16,
    });
    makeButton(this, 267, 642, 38, 38, '↧', () => {
      const blob = new Blob([exportPlaytestData(profile, analytics.exportEvents())], { type: 'application/json' });
      const anchor = document.createElement('a');
      anchor.download = `poker-defense-playtest-${date}.json`;
      anchor.href = URL.createObjectURL(blob);
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 14, radius: 19, strokeAlpha: 0.16 });
    makeButton(this, 319, 642, 48, 38, getLocale().toUpperCase(), () => switchLocale(), {
      fill: UI.panelDeep, textColor: UI.gold, fontSize: 11, radius: 19, strokeAlpha: 0.16,
    });
    graphics.lineStyle(1, 0xf2ede3, 0.09).lineBetween(309, 625, 309, 659);
    this.add.text(338, 637, `${CURRENT_VERSION}  —  DECK FOUNDATION`, {
      fontFamily: FONT_MONO, fontSize: '11px', color: '#74727e', letterSpacing: 1,
    });
    let patchNotesOverlay: PatchNotesOverlay | null = null;
    const closePatchNotes = () => {
      patchNotesOverlay?.destroy();
      patchNotesOverlay = null;
      this.closeViewportModal('patch');
    };
    const patchLink = makeText(this, 548, 637, tr('패치 노트  NEW', 'PATCH NOTES  NEW'), 11, UI.gold, true)
      .setInteractive({ useHandCursor: true });
    patchLink.on('pointerdown', () => {
      if (patchNotesOverlay) return;
      this.viewportModals.add('patch');
      patchNotesOverlay = new PatchNotesOverlay(this, closePatchNotes);
      analytics.track('patch_notes_viewed', { version: CURRENT_VERSION });
    });
    this.input.keyboard?.on('keydown-ESC', closePatchNotes);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', closePatchNotes));
    graphics.lineStyle(1, 0xf2ede3, 0.09).lineBetween(636, 625, 636, 659);
    makeText(
      this, 664, 637,
      isCompactTouchDevice()
        ? tr('카드 탭 HOLD · 교환 · 확정 · 배치', 'TAP CARDS TO HOLD · EXCHANGE · CONFIRM · PLACE')
        : tr('E 교환 · ENTER 확정 · SPACE 전투 · D 덱 · H 도감', 'E EXCHANGE · ENTER CONFIRM · SPACE COMBAT · D DECK · H GUIDE'),
      11, UI.textFaint,
    );
    if (!this.viewportRebuild) analytics.track('menu_view', { challenge: hasChallenge, maxCrown, locale: getLocale(), layout: 'landscape' });
    if (analytics.consent === 'unknown') {
      openData();
    }
    (window as unknown as { __menuReady?: boolean }).__menuReady = true;
  }

  private createPortraitMenu(initialProfile: Profile, challengeDate: string, hasChallenge: boolean, lifeLab: boolean): void {
    let profile = initialProfile;
    const analytics = getAnalytics();
    const portraitHeight = portraitSceneHeight(this);
    const py = (value: number) => portraitY(portraitHeight, value);
    const density = Math.min(1, portraitScale(portraitHeight));
    const maxCrown = highestUnlockedCrown(profile);
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1424, 0x17121f, 0x08080c, 0x0d0c14, 1);
    graphics.fillRect(0, 0, 390, portraitHeight);
    graphics.lineStyle(1, UI.goldNum, 0.15).strokeRect(18, 18, 354, portraitHeight - 36);

    this.add.text(195, py(290), '♠', {
      fontFamily: FONT_DISPLAY, fontSize: `${Math.round(460 * density)}px`, color: UI.gold, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0.03);
    const dragon = this.add.image(195, py(306), unitSpriteKey(HandRank.RoyalFlush, window.location.search)!)
      .setDisplaySize(264 * density, 264 * density).setAlpha(0.14).setTint(0xc9bda4);
    this.tweens.add({ targets: dragon, y: py(300), duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    graphics.lineStyle(1, UI.goldNum, 0.9).lineBetween(32, py(102), 52, py(102));
    this.add.text(62, py(95), 'POKER DEFENSE', {
      fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: UI.gold, letterSpacing: 3.3,
    });
    if (lifeLab) makeText(this, 358, py(95), 'LIFE SIEGE', 10, '#7fd9a4', true).setOrigin(1, 0);
    this.add.text(32, py(118), 'ROYAL\nSIEGE', {
      fontFamily: FONT_DISPLAY, fontSize: `${Math.round(82 * density)}px`, fontStyle: 'bold', color: UI.text, lineSpacing: Math.round(-21 * density),
    });
    makeText(
      this, 32, py(292),
      lifeLab
        ? tr('적 탈출 1기당 라이프 1을 잃습니다.\n교차로에서 60라운드를 방어하세요.', 'Each escaped enemy costs 1 life.\nDefend the crossroads through 60 rounds.')
        : tr('다섯 장의 패로 군단을 뽑고\n60라운드를 버텨냅니다.', 'Turn five-card poker hands into an army\nand survive 60 rounds.'),
      15, '#a8a5b2',
    ).setLineSpacing(8);

    const left = 32;
    const right = 358;
    this.add.text(left, py(432), 'COMMANDER RECORD', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#74727e', letterSpacing: 2.6,
    });
    const line = (y: number, gold = false) => graphics.lineStyle(
      1, gold ? UI.goldNum : 0xf2ede3, gold ? 0.2 : 0.09,
    ).lineBetween(left, y, right, y);
    line(py(456), true);
    makeText(this, left, py(481), tr('최고 점수', 'BEST SCORE'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(right, py(465), profile.bestScore.toLocaleString(), {
      fontFamily: FONT_DISPLAY, fontSize: '34px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);
    line(py(516));
    makeText(this, left, py(538), tr('최고 라운드', 'BEST ROUND'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(right, py(526), `${profile.bestRound} / 60`, {
      fontFamily: FONT_MONO, fontSize: '15px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(py(560));
    makeText(this, left, py(582), tr('승리 · 출전', 'WINS · RUNS'), 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(right, py(570), `${profile.wins} · ${profile.totalRuns}${maxCrown > 0 ? ` · ♛${profile.highestCrownCleared}` : ''}`, {
      fontFamily: FONT_MONO, fontSize: '15px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(py(604), true);
    this.add.text(left, py(615), 'DAILY TOP 10', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.gold, letterSpacing: 1.8,
    });
    makeText(this, right, py(614), leaderboardConfigured() ? tr('내 순위 보기 →', 'VIEW MY RANK →') : tr('랭킹 연결 대기', 'RANKING OFFLINE'), 12, UI.textDim)
      .setOrigin(1, 0);

    let selectedCrown = Math.min(this.selectedMenuCrown ?? maxCrown, maxCrown) as CrownLevel;
    const crownLabel = makeText(this, 195, py(632), '', 15, UI.gold, true).setOrigin(0.5, 0);
    const crownPrev = makeButton(this, 66, py(645), 44, 40, '‹', () => {
      if (selectedCrown > 0) selectedCrown = (selectedCrown - 1) as CrownLevel;
      refreshCrownSelector();
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 24, radius: 20, stroke: UI.goldNum, strokeAlpha: 0.25 });
    const crownNext = makeButton(this, 324, py(645), 44, 40, '›', () => {
      if (selectedCrown < maxCrown) selectedCrown = (selectedCrown + 1) as CrownLevel;
      refreshCrownSelector();
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 24, radius: 20, stroke: UI.goldNum, strokeAlpha: 0.25 });
    const crownDescription = makeText(this, 195, py(663), '', 10, UI.textFaint).setOrigin(0.5, 0);
    const refreshCrownSelector = () => {
      this.selectedMenuCrown = selectedCrown;
      crownLabel.setText(selectedCrown === 0 ? tr('♛ 왕관 0개 · 기본', '♛ CROWN 0 · BASE') : tr(`♛ 왕관 ${selectedCrown}개`, `♛ CROWN ${selectedCrown}`));
      crownDescription.setText(crownDifficultyDescription(selectedCrown, maxCrown, true));
      crownPrev.setEnabled(selectedCrown > 0);
      crownNext.setEnabled(selectedCrown < maxCrown);
    };
    refreshCrownSelector();
    makeButton(this, 195, py(716), 326, 58, tr('원정 시작', 'START EXPEDITION'), () => {
      this.viewportRefresh?.dispose();
      this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard', crownLevel: selectedCrown });
    }, { fill: UI.goldNum, textColor: UI.goldInk, fontSize: 17, radius: 29, stroke: UI.goldNum, strokeAlpha: 0.5 });
    makeButton(this, 195, py(770), 326, 42, this.dailyMenuLabel, () => {
      this.viewportRefresh?.dispose();
      this.scene.start('play', { seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate });
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: this.dailyMenuLabel.includes('\n') ? 12 : 14, radius: 21, stroke: 0xf2ede3, strokeAlpha: 0.22 });

    const sound = makeButton(this, 54, py(808), 34, 34, profile.soundEnabled ? '♪' : '×', () => {
      profile = { ...profile, soundEnabled: !profile.soundEnabled };
      saveProfile(localStorage, profile);
      sound.setLabel(profile.soundEnabled ? '♪' : '×');
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 14, radius: 17, strokeAlpha: 0.16 });
    makeButton(this, 96, py(808), 34, 34, 'i', () => {
      if (this.viewportModals.has('consent')) return;
      this.viewportModals.add('consent');
      new AnalyticsConsentOverlay(this, (allowed) => {
        analytics.setConsent(allowed ? 'granted' : 'denied');
        this.closeViewportModal('consent');
      });
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 17, strokeAlpha: 0.16 });
    makeButton(this, 138, py(808), 44, 34, getLocale().toUpperCase(), () => switchLocale(), {
      fill: UI.panelDeep, textColor: UI.gold, fontSize: 10, radius: 17, strokeAlpha: 0.16,
    });
    this.add.text(286, py(803), CURRENT_VERSION, {
      fontFamily: FONT_MONO, fontSize: '11px', color: UI.textFaint,
    }).setOrigin(1, 0);
    makeText(this, 358, py(802), tr('패치 NEW', 'PATCH NEW'), 11, UI.gold, true).setOrigin(1, 0);

    if (!this.viewportRebuild) analytics.track('menu_view', { challenge: hasChallenge, layout: 'portrait', maxCrown, locale: getLocale() });
    if (analytics.consent === 'unknown') {
      this.viewportModals.add('consent');
      new AnalyticsConsentOverlay(this, (allowed) => {
        analytics.setConsent(allowed ? 'granted' : 'denied');
        if (allowed) analytics.track('menu_view', { source: 'consent_overlay', challenge: hasChallenge, layout: 'portrait' });
        this.closeViewportModal('consent');
      });
    }
    (window as unknown as { __menuReady?: boolean }).__menuReady = true;
  }

  private closeViewportModal(name: string): void {
    this.viewportModals.delete(name);
    this.viewportRefresh?.flush();
  }
}

function crownDifficultyDescription(level: CrownLevel, maxUnlocked: CrownLevel, compact = false): string {
  if (level === 0) return maxUnlocked === 0
    ? tr('기본 원정 클리어 시 왕관 1개 해금', 'Clear the base expedition to unlock Crown 1')
    : tr('기본 원정 · 추가 난이도 없음', 'Base expedition · no modifiers');
  const enemy = Math.round((crownEnemyHpMultiplier(level) - 1) * 100);
  const boss = Math.round((crownBossHpMultiplier(level) - 1) * 100);
  const speed = Math.round((crownSpeedMultiplier(level) - 1) * 100);
  const stats = compact
    ? tr(`적 +${enemy}% · 보스 +${boss}% · 속도 +${speed}%`, `Enemy +${enemy}% · Boss +${boss}% · Speed +${speed}%`)
    : tr(`일반 적 체력 +${enemy}% · 보스 +${boss}% · 이동 +${speed}%`, `Enemy HP +${enemy}% · Boss +${boss}% · Move +${speed}%`);
  return level === maxUnlocked && level < CROWN_MAX_LEVEL
    ? `${stats} · ${tr('클리어 시 다음 왕관 해금', 'clear to unlock the next Crown')}`
    : stats;
}

function switchLocale(): void {
  const locale = getLocale() === 'ko' ? 'en' : 'ko';
  setLocale(locale);
  const url = new URL(window.location.href);
  url.searchParams.set('lang', locale);
  window.location.assign(url.toString());
}
