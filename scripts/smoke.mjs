import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-'));
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const errors = [];

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);
if (!executablePath) throw new Error('Chrome/Chromium not found. Set CHROME_PATH.');

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2000));
await page.waitForFunction(() => window.__menuReady === true);
await page.screenshot({ path: `${TMP}/shot1-menu.png` });

// 새 게임 → 첫 실행 튜토리얼 건너뛰기
await page.mouse.click(770, 327);
await page.waitForFunction(() => Boolean(window.__game));
await new Promise((r) => setTimeout(r, 300));
await page.mouse.click(520, 500);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${TMP}/shot2-prep.png` });

const state = () =>
  page.evaluate(() => {
    const g = window.__game;
    return g
      ? {
          phase: g.phase,
          round: g.round,
          gold: g.gold,
          hand: g.hand.length,
          pending: g.pendingUnits.length,
          units: g.field.units.length,
          enemies: g.field.enemies.filter((e) => e.alive).length,
          relicChoices: g.relicChoices.length,
          relics: g.relics.length,
          score: g.score,
        }
      : null;
  });

console.log('초기 상태:', JSON.stringify(await state()));

// 족보 확정 버튼 (694, 640)
await page.mouse.click(694, 640);
await new Promise((r) => setTimeout(r, 300));
console.log('확정 후:', JSON.stringify(await state()));

// 타일 (8,5)에 배치 — 화면 (390, 258)
await page.mouse.click(390, 258);
await new Promise((r) => setTimeout(r, 300));
console.log('배치 후:', JSON.stringify(await state()));
await page.screenshot({ path: `${TMP}/shot3-placed.png` });

// 전투 시작 (1022, 452)
await page.mouse.click(1022, 452);
await new Promise((r) => setTimeout(r, 4000));
const combat = await state();
console.log('전투 4초:', JSON.stringify(combat));
await page.screenshot({ path: `${TMP}/shot4-combat.png` });

// 코어를 결정론적으로 R10 종료까지 진행해 유물 3지선다 확인
await page.evaluate(() => {
  const g = window.__game;
  g.phase = 'prep';
  g.round = 10;
  g.field.enemies = [];
  g.handConfirmed = true;
  g.startCombat();
  for (let i = 0; i < 5000 && g.phase === 'combat'; i++) g.tickCombat(1 / 30);
});
await new Promise((r) => setTimeout(r, 300));
const reward = await state();
console.log('보스 보상:', JSON.stringify(reward));
await page.screenshot({ path: `${TMP}/shot5-relic.png` });
await page.mouse.click(176, 278);
await new Promise((r) => setTimeout(r, 250));
const chosen = await state();
console.log('유물 선택 후:', JSON.stringify(chosen));

await browser.close();

if (errors.length) {
  console.log('JS 에러:', errors.slice(0, 5).join(' | '));
  process.exit(1);
}
if (!combat || combat.phase !== 'combat' || combat.enemies === 0 || combat.units !== 1) {
  console.log('스모크 실패: 상태 불일치');
  process.exit(1);
}
if (!reward || reward.relicChoices !== 3 || !chosen || chosen.relics !== 1 || chosen.relicChoices !== 0) {
  console.log('스모크 실패: 유물 선택 상태 불일치');
  process.exit(1);
}
console.log('SMOKE_OK');
console.log('screenshots:', TMP);
