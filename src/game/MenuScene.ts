import Phaser from 'phaser';
import {
  ACHIEVEMENTS, dailyDate, dailySeed, ensureLeaderboardIdentity, exportPlaytestData, loadProfile, Profile, saveProfile,
} from '../meta/profile';
import { dailyDateFromSearch } from '../meta/share';
import { getAnalytics } from '../meta/analytics';
import { AnalyticsConsentOverlay } from './AnalyticsConsentOverlay';
import { FONT, FONT_DISPLAY, FONT_MONO, UI, makeButton, makeText } from './ui';
import { LeaderboardOverlay } from './LeaderboardOverlay';
import { PatchNotesOverlay } from './PatchNotesOverlay';
import { CURRENT_VERSION } from '../meta/patchNotes';
import { leaderboardConfigured } from '../meta/leaderboard';
import { isCompactTouchDevice, isPortraitLayout } from './device';
import { isPixelArtPreview, preloadUnitSprites, unitSpriteKey } from './unitAssets';
import { HandRank } from '../core/cards/types';
import { preloadBossSprites } from './bossAssets';
import { preloadRelicSprites } from './relicAssets';
import { isLifeLabLocation } from './experiment';
import { portraitScale, portraitSceneHeight, portraitY } from './layout';
import {
  CROWN_I_BOSS_HP_MULTIPLIER, CROWN_I_ENEMY_HP_MULTIPLIER, CROWN_I_SPEED_MULTIPLIER,
} from '../core/balance';

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
    const lifeLab = isLifeLabLocation();
    const analytics = getAnalytics();
    const date = dailyDate();
    const challengeDate = dailyDateFromSearch(window.location.search, date);
    const hasChallenge = new URLSearchParams(window.location.search).get('daily') === challengeDate;
    const localVisualTest = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
      ? new URLSearchParams(window.location.search).get('visualTest')
      : null;
    if (localVisualTest === 'crown-menu') {
      profile = { ...profile, wins: Math.max(1, profile.wins) };
    } else if (localVisualTest) {
      this.scene.start('play', {
        seed: 20260901,
        mode: 'standard',
        crownLevel: localVisualTest === 'crown-play' ? 1 : 0,
      });
      return;
    }
    const crownUnlocked = !lifeLab && profile.wins > 0;
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
    if (lifeLab) {
      makeText(this, 330, 91, 'LIFE ECONOMY LAB', 11, '#7fd9a4', true).setLetterSpacing(2);
    }
    if (isPixelArtPreview(window.location.search)) {
      makeText(this, 1218, 91, 'PIXEL ART PREVIEW', 10, '#7fd9a4', true).setOrigin(1, 0).setLetterSpacing(1.5);
    }
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
        ? '라이프 20과 침투 게이지를 지키며 새로운 경제 규칙을 시험합니다.'
        : '다섯 장의 패로 군단을 뽑고, 순환하는 전장에서 60라운드를 버텨냅니다.',
      17, '#a8a5b2',
    ).setWordWrapWidth(470, true).setLineSpacing(10);

    makeButton(this, 202, 500, 228, 66, lifeLab ? 'LIFE LAB 시작' : '일반 원정', () => {
      this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard' });
    }, { fill: UI.goldNum, fontSize: 19, radius: 33, stroke: UI.goldNum, strokeAlpha: 0.5 });
    if (!lifeLab) {
      const crown = makeButton(this, 414, 500, 180, 66, crownUnlocked ? '♛ 왕관 I 원정' : '♛ 왕관 I 잠김', () => {
        if (!crownUnlocked) return;
        this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard', crownLevel: 1 });
      }, { fill: UI.panelDeep, textColor: crownUnlocked ? UI.gold : UI.textFaint, fontSize: 15, radius: 33, stroke: UI.goldNum, strokeAlpha: crownUnlocked ? 0.55 : 0.14 });
      crown.setEnabled(crownUnlocked);
    }
    makeButton(this, lifeLab ? 402 : 614, 500, 168, 66, hasChallenge ? '도전 수락' : '오늘의 도전', () => {
      this.scene.start('play', { seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate });
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 16, radius: 33, stroke: 0xf2ede3, strokeAlpha: 0.22 });
    makeText(
      this, 92, 552,
      !lifeLab && crownUnlocked
        ? `왕관 I · 일반 적 체력 +${Math.round((CROWN_I_ENEMY_HP_MULTIPLIER - 1) * 100)}% · 보스 +${Math.round((CROWN_I_BOSS_HP_MULTIPLIER - 1) * 100)}% · 이동 +${Math.round((CROWN_I_SPEED_MULTIPLIER - 1) * 100)}%`
        : !lifeLab
          ? '일반 원정을 클리어하면 왕관 I 난이도가 해금됩니다'
          : `60라운드 · 약 25분 · ${challengeDate} 시드는 모두에게 동일`,
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
    makeText(this, recordX, 329, crownUnlocked ? '왕관 I 기록' : '업적', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(recordRight, 316, crownUnlocked
      ? `R${profile.crownBestRound} · ${profile.crownWins}승`
      : `${profile.achievements.length} / ${Object.keys(ACHIEVEMENTS).length}`, {
      fontFamily: FONT_MONO, fontSize: '17px', fontStyle: 'bold', color: crownUnlocked ? UI.gold : UI.text,
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
    analytics.track('menu_view', { challenge: hasChallenge, crownUnlocked });
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
    const crownUnlocked = !lifeLab && profile.wins > 0;
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
    if (lifeLab) makeText(this, 358, py(95), 'LIFE LAB', 10, '#7fd9a4', true).setOrigin(1, 0);
    if (!lifeLab && isPixelArtPreview(window.location.search)) {
      makeText(this, 358, py(95), 'PIXEL PREVIEW', 9, '#7fd9a4', true).setOrigin(1, 0);
    }
    this.add.text(32, py(118), 'ROYAL\nSIEGE', {
      fontFamily: FONT_DISPLAY, fontSize: `${Math.round(82 * density)}px`, fontStyle: 'bold', color: UI.text, lineSpacing: Math.round(-21 * density),
    });
    makeText(
      this, 32, py(292),
      lifeLab
        ? '라이프 20과 침투 게이지로\n새로운 방어 규칙을 시험합니다.'
        : '다섯 장의 패로 군단을 뽑고\n60라운드를 버텨냅니다.',
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
    makeText(this, left, py(481), '최고 점수', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(right, py(465), profile.bestScore.toLocaleString(), {
      fontFamily: FONT_DISPLAY, fontSize: '34px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(1, 0);
    line(py(516));
    makeText(this, left, py(538), '최고 라운드', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(right, py(526), `${profile.bestRound} / 60`, {
      fontFamily: FONT_MONO, fontSize: '15px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(py(560));
    makeText(this, left, py(582), '승리 · 출전', 12, UI.textDim).setOrigin(0, 0.5);
    this.add.text(right, py(570), `${profile.wins} · ${profile.totalRuns}${crownUnlocked ? ` · 왕관 ${profile.crownWins}승` : ''}`, {
      fontFamily: FONT_MONO, fontSize: '15px', fontStyle: 'bold', color: UI.text,
    }).setOrigin(1, 0);
    line(py(604), true);
    this.add.text(left, py(615), 'DAILY TOP 10', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: UI.gold, letterSpacing: 1.8,
    });
    makeText(this, right, py(614), leaderboardConfigured() ? '내 순위 보기 →' : '랭킹 연결 대기', 12, UI.textDim)
      .setOrigin(1, 0);

    if (lifeLab) {
      makeButton(this, 195, py(667), 326, 62, 'LIFE LAB 시작', () => {
        this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard' });
      }, { fill: UI.goldNum, textColor: UI.goldInk, fontSize: 19, radius: 31, stroke: UI.goldNum, strokeAlpha: 0.5 });
    } else {
      makeButton(this, 112, py(667), 154, 62, '일반 원정', () => {
        this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard' });
      }, { fill: UI.goldNum, textColor: UI.goldInk, fontSize: 16, radius: 31, stroke: UI.goldNum, strokeAlpha: 0.5 });
      const crown = makeButton(this, 278, py(667), 154, 62, crownUnlocked ? '♛ 왕관 I' : '왕관 잠김', () => {
        if (!crownUnlocked) return;
        this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard', crownLevel: 1 });
      }, { fill: UI.panelDeep, textColor: crownUnlocked ? UI.gold : UI.textFaint, fontSize: 15, radius: 31, stroke: UI.goldNum, strokeAlpha: crownUnlocked ? 0.55 : 0.14 });
      crown.setEnabled(crownUnlocked);
    }
    makeButton(this, 195, py(735), 326, 54, hasChallenge ? '도전 수락' : '오늘의 도전', () => {
      this.scene.start('play', { seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate });
    }, { fill: UI.panelDeep, textColor: UI.text, fontSize: 15, radius: 27, stroke: 0xf2ede3, strokeAlpha: 0.22 });

    const sound = makeButton(this, 54, py(796), 36, 36, profile.soundEnabled ? '♪' : '×', () => {
      profile = { ...profile, soundEnabled: !profile.soundEnabled };
      saveProfile(localStorage, profile);
      sound.setLabel(profile.soundEnabled ? '♪' : '×');
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 14, radius: 18, strokeAlpha: 0.16 });
    makeButton(this, 98, py(796), 36, 36, 'i', () => {
      new AnalyticsConsentOverlay(this, (allowed) => analytics.setConsent(allowed ? 'granted' : 'denied'));
    }, { fill: UI.panelDeep, textColor: UI.textDim, fontSize: 13, radius: 18, strokeAlpha: 0.16 });
    this.add.text(286, py(791), CURRENT_VERSION, {
      fontFamily: FONT_MONO, fontSize: '11px', color: UI.textFaint,
    }).setOrigin(1, 0);
    makeText(this, 358, py(790), '패치 NEW', 11, UI.gold, true).setOrigin(1, 0);

    analytics.track('menu_view', { challenge: hasChallenge, layout: 'portrait', crownUnlocked });
    if (analytics.consent === 'unknown') {
      new AnalyticsConsentOverlay(this, (allowed) => {
        analytics.setConsent(allowed ? 'granted' : 'denied');
        if (allowed) analytics.track('menu_view', { source: 'consent_overlay', challenge: hasChallenge, layout: 'portrait' });
      });
    }
    (window as unknown as { __menuReady?: boolean }).__menuReady = true;
  }
}
