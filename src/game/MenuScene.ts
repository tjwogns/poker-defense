import Phaser from 'phaser';
import { ACHIEVEMENTS, dailySeed, exportPlaytestData, loadProfile, saveProfile } from '../meta/profile';
import { dailyDateFromSearch } from '../meta/share';
import { getAnalytics } from '../meta/analytics';
import { AnalyticsConsentOverlay } from './AnalyticsConsentOverlay';
import { UI, makeButton, makeText } from './ui';

function localDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const profile = loadProfile(localStorage);
    const analytics = getAnalytics();
    const date = localDate();
    const challengeDate = dailyDateFromSearch(window.location.search, date);
    const hasChallenge = new URLSearchParams(window.location.search).get('daily') === challengeDate;
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x07130c, 0x07130c, 0x173422, 0x173422, 1);
    graphics.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 22; i++) {
      graphics.fillStyle(i % 2 ? 0x5cb187 : 0xe6c84f, 0.055);
      graphics.fillCircle(40 + ((i * 173) % 1200), 30 + ((i * 97) % 650), 2 + (i % 4));
    }
    makeText(this, 105, 360, '♠', 190, '#5cb187', true).setOrigin(0.5).setAlpha(0.055);
    makeText(this, 1175, 360, '♦', 190, UI.gold, true).setOrigin(0.5).setAlpha(0.045);

    makeText(this, 640, 92, '♠  POKER DEFENSE  ♦', 18, UI.accentText, true).setOrigin(0.5);
    makeText(this, 640, 150, 'ROYAL SIEGE', 58, UI.gold, true)
      .setOrigin(0.5).setShadow(0, 5, '#000000', 12);
    makeText(this, 640, 208, '패를 만들고 · 군단을 합성하고 · 60라운드를 지켜내세요', 18, UI.textDim)
      .setOrigin(0.5);
    graphics.lineStyle(2, 0xe6c84f, 0.28);
    graphics.lineBetween(515, 232, 765, 232);

    this.add.rectangle(644, 366, 760, 190, 0x000000, 0.28);
    this.add.rectangle(640, 360, 760, 190, UI.panel, 0.96).setStrokeStyle(1, UI.panelLine);
    makeText(this, 350, 292, 'COMMANDER RECORD', 12, UI.textDim, true);
    makeText(this, 350, 326, `최고 점수  ${profile.bestScore.toLocaleString()}`, 22, UI.gold, true);
    makeText(this, 350, 365, `최고 라운드  ${profile.bestRound} / 60`, 16, UI.text);
    makeText(this, 350, 398, `승리 ${profile.wins}회  ·  출전 ${profile.totalRuns}회`, 15, UI.textDim);
    const achievementCount = profile.achievements.length;
    makeText(this, 350, 431, `업적 ${achievementCount} / ${Object.keys(ACHIEVEMENTS).length}`, 14, UI.accentText);

    makeButton(this, 770, 327, 250, 54, '새 게임', () => {
      this.scene.start('play', { seed: Date.now() >>> 0, mode: 'standard' });
    }, { fontSize: 18 });
    makeButton(this, 770, 397, 250, 54, hasChallenge ? '친구의 도전 수락' : '오늘의 도전', () => {
      this.scene.start('play', { seed: dailySeed(challengeDate), mode: 'daily', date: challengeDate });
    }, { fill: 0xe6c84f, fontSize: 18 });
    makeText(
      this,
      770,
      435,
      `${challengeDate} · ${hasChallenge ? '공유 시드 그대로 플레이' : '모두에게 같은 패'}`,
      12,
      UI.textDim,
    ).setOrigin(0.5);

    const sound = makeButton(this, 1160, 54, 150, 36, profile.soundEnabled ? 'SOUND ON' : 'SOUND OFF', () => {
      profile.soundEnabled = !profile.soundEnabled;
      saveProfile(localStorage, profile);
      sound.setLabel(profile.soundEnabled ? 'SOUND ON' : 'SOUND OFF');
    }, { fill: 0x42544a, fontSize: 12 });
    makeButton(this, 1160, 100, 150, 34, 'LOG EXPORT', () => {
      const blob = new Blob([exportPlaytestData(profile, analytics.exportEvents())], { type: 'application/json' });
      const anchor = document.createElement('a');
      anchor.download = `poker-defense-playtest-${date}.json`;
      anchor.href = URL.createObjectURL(blob);
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    }, { fill: 0x42544a, fontSize: 11 });
    const data = makeButton(this, 1160, 144, 150, 34, analytics.consent === 'granted' ? 'DATA ON' : 'DATA OFF', () => {
      const allowed = analytics.consent !== 'granted';
      analytics.setConsent(allowed ? 'granted' : 'denied');
      data.setLabel(allowed ? 'DATA ON' : 'DATA OFF');
      if (allowed) analytics.track('menu_view', { source: 'data_button' });
    }, { fill: 0x42544a, fontSize: 11 });
    makeButton(this, 1160, 188, 150, 34, 'PRIVACY', () => {
      window.open('./privacy.html', '_blank', 'noopener,noreferrer');
    }, { fill: 0x42544a, fontSize: 11 });

    makeText(this, 640, 560, 'E 교환 · ENTER 확정 · SPACE 전투/정지 · 1/2/4 배속 · Q/W/R/T 스킬 · M 음소거', 13, UI.textDim)
      .setOrigin(0.5);
    makeText(this, 640, 610, 'v1.2  ·  ROYAL TABLE EDITION', 11, '#60746a', true).setOrigin(0.5);
    analytics.track('menu_view', { challenge: hasChallenge });
    if (analytics.consent === 'unknown') {
      new AnalyticsConsentOverlay(this, (allowed) => {
        analytics.setConsent(allowed ? 'granted' : 'denied');
        data.setLabel(allowed ? 'DATA ON' : 'DATA OFF');
        if (allowed) analytics.track('menu_view', { source: 'consent_overlay', challenge: hasChallenge });
      });
    }
    (window as unknown as { __menuReady?: boolean }).__menuReady = true;
  }
}
