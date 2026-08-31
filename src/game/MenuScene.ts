import Phaser from 'phaser';
import {
  ACHIEVEMENTS, dailyDate, dailySeed, ensureLeaderboardIdentity, exportPlaytestData, loadProfile, saveProfile,
} from '../meta/profile';
import { dailyDateFromSearch } from '../meta/share';
import { getAnalytics } from '../meta/analytics';
import { AnalyticsConsentOverlay } from './AnalyticsConsentOverlay';
import { FONT, FONT_DISPLAY, FONT_MONO, UI, makeButton, makeText } from './ui';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { PatchNotesOverlay } from './PatchNotesOverlay';
import { CURRENT_VERSION } from '../meta/patchNotes';
import { leaderboardConfigured } from '../meta/leaderboard';
import { isCompactTouchDevice } from './device';
import { preloadUnitSprites, UNIT_SPRITE_KEYS } from './unitAssets';
import { HandRank } from '../core/cards/types';
import { preloadBossSprites } from './bossAssets';
import { preloadRelicSprites } from './relicAssets';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  preload(): void {
    preloadUnitSprites(this);
    preloadBossSprites(this);
    preloadRelicSprites(this);
  }

  create(): void {
    const bootSplash = document.getElementById('boot-splash');
    bootSplash?.classList.add('ready');
    window.setTimeout(() => bootSplash?.remove(), 320);

    let profile = ensureLeaderboardIdentity(loadProfile(localStorage));
    saveProfile(localStorage, profile);
    const analytics = getAnalytics();
    const date = dailyDate();
    const challengeDate = dailyDateFromSearch(window.location.search, date);
    const hasChallenge = new URLSearchParams(window.location.search).get('daily') === challengeDate;
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

    const dragon = this.add.image(1120, 615, UNIT_SPRITE_KEYS[HandRank.RoyalFlush]!)
      .setDisplaySize(340, 340).setAlpha(0.38).setTint(0xc9bda4);
    this.tweens.add({ targets: dragon, y: 608, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    graphics.lineStyle(1, UI.goldNum, 0.9).lineBetween(88, 98, 114, 98);
    this.add.text(126, 91, 'POKER DEFENSE', {
      fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: UI.gold,
      letterSpacing: 3.7,
    });
    this.add.text(88, 112, 'ROYAL\nSIEGE', {
      fontFamily: FONT_DISPLAY,
      fontSize: '112px',
      fontStyle: 'bold',
      color: UI.text,
      lineSpacing: -27,
    });
    makeText(
      this, 92, 382,
      '다섯 장의 패로 군단을 뽑고, 순환하는 전장에서 60라운드를 버텨냅니다.',
      17, '#a8a5b2',
    ).setWordWrapWidth(470, true).setLineSpacing(10);

    makeButton(this, 202, 500, 228, 66, '새 원정 시작', () => {
      this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard' });
    }, { fill: UI.goldNum, fontSize: 19, radius: 33, stroke: UI.goldNum, strokeAlpha: 0.5 });
    makeButton(this, 402, 500, 168, 66, hasChallenge ? '도전 수락' : '오늘의 도전', () => {
      this.scene.start('play', { seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate });
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 16, radius: 33, stroke: 0xf2ede3, strokeAlpha: 0.22 });
    makeText(
      this, 92, 552,
      `60라운드 · 약 25분 · ${challengeDate} 시드는 모두에게 동일`,
      12, '#74727e',
    );

    const recordX = 948;
    this.add.text(recordX, 110, 'COMMANDER RECORD', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#74727e', letterSpacing: 2.8,
    });
    const recordRight = 1218;
    const line = (y: number, gold = false) => graphics.lineStyle(1, gold ? UI.goldNum : 0xf2ede3, gold ? 0.2 : 0.09)
      .lineBetween(recordX, y, recordRight, y);
    line(134, true);
    makeText(this, recordX, 174, '최고 점수', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 147, profile.bestScore.toLocaleString(), {
      fontFamily: FONT_DISPLAY, fontSize: '42px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);
    line(214);
    makeText(this, recordX, 237, '최고 라운드', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 224, `${profile.bestRound} / 60`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(258);
    makeText(this, recordX, 283, '승리 · 출전', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 270, `${profile.wins} · ${profile.totalRuns}`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(304);
    makeText(this, recordX, 329, '업적', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 316, `${profile.achievements.length} / ${Object.keys(ACHIEVEMENTS).length}`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(366, true);
    this.add.text(recordX, 386, 'DAILY TOP 10', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.gold, letterSpacing: 2,
    });
    let leaderboardOverlay: LeaderboardOverlay | null = null;
    const closeLeaderboard = () => {
      leaderboardOverlay?.destroy();
      leaderboardOverlay = null;
    };
    const onlineRankingEnabled = leaderboardConfigured();
    const rankingLink = makeText(
      this, recordRight, 385,
      onlineRankingEnabled ? '내 순위 보기  →' : '랭킹 연결 대기',
      12, onlineRankingEnabled ? UI.textDim : UI.textFaint, true,
    ).setOrigin(1, 0).setInteractive({ useHandCursor: onlineRankingEnabled });
    rankingLink.on('pointerdown', () => {
      if (!onlineRankingEnabled) return;
      if (leaderboardOverlay) return;
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

    const sound = makeButton(this, 163, 642, 38, 38, profile.soundEnabled ? '♪' : '×', () => {
      profile = { ...profile, soundEnabled: !profile.soundEnabled };
      saveProfile(localStorage, profile);
      sound.setLabel(profile.soundEnabled ? '♪' : '×');
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 15, radius: 19, strokeAlpha: 0.16 });
    const openData = () => new AnalyticsConsentOverlay(this, (allowed) => {
      analytics.setConsent(allowed ? 'granted' : 'denied');
      if (allowed) analytics.track('menu_view', { source: 'consent_overlay', challenge: hasChallenge });
    });
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
    graphics.lineStyle(1, 0xf2ede3, 0.09).lineBetween(309, 625, 309, 659);
    this.add.text(338, 637, `${CURRENT_VERSION}  —  DECK FOUNDATION`, {
      fontFamily: FONT_MONO, fontSize: '11px', color: '#74727e', letterSpacing: 1,
    });
    let patchNotesOverlay: PatchNotesOverlay | null = null;
    const closePatchNotes = () => {
      patchNotesOverlay?.destroy();
      patchNotesOverlay = null;
    };
    const patchLink = makeText(this, 548, 637, '패치 노트  NEW', 11, UI.gold, true)
      .setInteractive({ useHandCursor: true });
    patchLink.on('pointerdown', () => {
      if (patchNotesOverlay) return;
      patchNotesOverlay = new PatchNotesOverlay(this, closePatchNotes);
      analytics.track('patch_notes_viewed', { version: CURRENT_VERSION });
    });
    this.input.keyboard?.on('keydown-ESC', closePatchNotes);
    graphics.lineStyle(1, 0xf2ede3, 0.09).lineBetween(636, 625, 636, 659);
    makeText(
      this, 664, 637,
      isCompactTouchDevice()
        ? '카드 탭 HOLD · 교환 · 확정 · 배치'
        : 'E 교환 · ENTER 확정 · SPACE 전투 · D 덱 · H 도감',
      11, UI.textFaint,
    );
    analytics.track('menu_view', { challenge: hasChallenge });
    if (analytics.consent === 'unknown') {
      openData();
    }
    (window as unknown as { __menuReady?: boolean }).__menuReady = true;
  }
}
