import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
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
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  const text = message.text();
  if (message.type() === 'error' || text.includes('AudioContext was not allowed to start')) errors.push(text);
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
await page.mouse.click(202, 500);
await page.waitForFunction(() => Boolean(window.__game && window.__playDebug));
await page.mouse.click(520, 500);
await page.evaluate(() => {
  window.__game.confirmHand();
  window.__game.pendingUnits.length = 0;
  if (!window.__game.startCombat()) throw new Error('전투 시작 실패');
});
await page.keyboard.press('4');
await new Promise((resolve) => setTimeout(resolve, 150));

const before = await page.evaluate(() => ({
  speed: window.__playDebug.speed(),
  paused: window.__playDebug.paused(),
}));
const other = await browser.newPage();
await other.goto('about:blank');
await other.bringToFront();
await new Promise((resolve) => setTimeout(resolve, 250));
await page.bringToFront();
await new Promise((resolve) => setTimeout(resolve, 300));
const after = await page.evaluate(() => ({
  speed: window.__playDebug.speed(),
  paused: window.__playDebug.paused(),
  backgroundPaused: window.__playDebug.backgroundPaused(),
}));
await browser.close();

if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);
if (before.speed !== 4 || before.paused) throw new Error(`×4 설정 실패: ${JSON.stringify(before)}`);
if (after.speed !== 4 || after.paused || after.backgroundPaused) {
  throw new Error(`포커스 복귀 상태 실패: ${JSON.stringify({ before, after })}`);
}
console.log('FOCUS_SMOKE_OK');
console.log(JSON.stringify({ before, after }));
