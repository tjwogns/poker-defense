import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-bosses-'));
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
const canvas = await page.evaluate(() => {
  const rect = document.querySelector('canvas')?.getBoundingClientRect();
  return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
});
if (!canvas) throw new Error('캔버스 없음');
const scale = canvas.width / 1280;
await page.touchscreen.tap(canvas.x + 770 * scale, canvas.y + 310 * scale);
await page.waitForFunction(() => Boolean(window.__game));
await page.touchscreen.tap(canvas.x + 520 * scale, canvas.y + 500 * scale);
await new Promise((resolve) => setTimeout(resolve, 180));
await page.evaluate(() => {
  const game = window.__game;
  game.field.enemies.length = 0;
  const rounds = [10, 20, 30, 40, 50, 60];
  const distances = [0, 150, 300, 450, 600, 750];
  for (let index = 0; index < rounds.length; index++) {
    const round = rounds[index];
    const hp = round === 60 ? 40 : 100;
    game.field.enemies.push({
      id: game.field.nextId++, kind: 'boss', hp, maxHp: 100, dist: distances[index],
      slowUntil: 0, slowPct: 0, stunUntil: 0, bounty: 0, round, alive: true,
    });
  }
});
await new Promise((resolve) => setTimeout(resolve, 1200));
await page.screenshot({ path: `${TMP}/s26-boss-lineup.png` });
await new Promise((resolve) => setTimeout(resolve, 450));
await page.screenshot({ path: `${TMP}/s26-boss-enrage.png` });
await browser.close();

if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);
console.log('BOSS_VISUAL_SMOKE_OK');
console.log('screenshots:', TMP);
