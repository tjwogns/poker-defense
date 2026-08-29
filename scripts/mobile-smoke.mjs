import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-mobile-'));
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
await page.setViewport({ width: 780, height: 360, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('poker-defense:v2-beta:analytics', JSON.stringify({
    version: 1, consent: 'denied', visitorId: '', events: [],
  }));
});
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__menuReady === true);
const landscape = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const rect = canvas?.getBoundingClientRect();
  return {
    rotate: getComputedStyle(document.querySelector('#rotate')).display,
    gate: getComputedStyle(document.querySelector('#mobile-gate')).display,
    canvas: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
  };
});
await page.screenshot({ path: `${TMP}/s26-landscape-menu.png` });
if (!landscape.canvas) throw new Error('캔버스 없음');
const scale = landscape.canvas.width / 1280;
await page.touchscreen.tap(
  landscape.canvas.x + 770 * scale,
  landscape.canvas.y + 310 * scale,
);
await page.waitForFunction(() => Boolean(window.__game));
await page.screenshot({ path: `${TMP}/s26-landscape-game.png` });
await page.touchscreen.tap(
  landscape.canvas.x + 520 * scale,
  landscape.canvas.y + 500 * scale,
);
await page.evaluate(() => {
  for (const [tier, tx, ty] of [[0, 5, 2], [1, 6, 3], [3, 8, 4]]) {
    window.__game.pendingUnits.push(tier);
    if (!window.__game.placeUnit(tx, ty)) throw new Error(`캐릭터 배치 실패: ${tier}`);
  }
});
await new Promise((resolve) => setTimeout(resolve, 350));
await page.screenshot({ path: `${TMP}/s26-landscape-units.png` });

await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await new Promise((resolve) => setTimeout(resolve, 250));
const portrait = await page.evaluate(() => ({
  rotate: getComputedStyle(document.querySelector('#rotate')).display,
  gate: getComputedStyle(document.querySelector('#mobile-gate')).display,
}));
await browser.close();

if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);
if (landscape.rotate !== 'none' || landscape.gate !== 'none') {
  throw new Error(`가로 실행 차단: ${JSON.stringify(landscape)}`);
}
if (landscape.canvas.width > 780 || landscape.canvas.height > 360) {
  throw new Error(`캔버스 화면 이탈: ${JSON.stringify(landscape.canvas)}`);
}
if (portrait.rotate === 'none') throw new Error(`세로 회전 안내 미표시: ${JSON.stringify(portrait)}`);
console.log('MOBILE_SMOKE_OK');
console.log(JSON.stringify({ landscape, portrait }));
console.log('screenshots:', TMP);
