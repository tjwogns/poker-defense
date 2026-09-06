import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5178/?visualTest=crossroad-mark';
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

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => Boolean(window.__game));

  const state = await page.evaluate(() => ({
    ruleset: window.__game.ruleset,
    mapId: window.__game.mapId,
    hasRelic: window.__game.relics.includes('crossroad_mark'),
  }));
  if (state.ruleset !== 'life-economy' || state.mapId !== 'cross-road' || !state.hasRelic) {
    throw new Error(`교차로 표식 프리뷰 상태 실패: ${JSON.stringify(state)}`);
  }
  if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);

  await page.screenshot({ path: '/tmp/poker-crossroad-mark.png' });
  console.log('CROSSROAD_MARK_SMOKE_OK');
  console.log(JSON.stringify(state));
} finally {
  await browser.close();
}
