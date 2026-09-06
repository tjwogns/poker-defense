import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5177/?visualTest=crown-menu';
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
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('poker-defense:v2:analytics', JSON.stringify({
      version: 1, consent: 'denied', visitorId: '', events: [],
    }));
    localStorage.setItem('poker-defense:v2:profile', JSON.stringify({
      version: 6, wins: 1, standardWins: 1,
    }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__menuReady === true);

  const clickMenuButton = async (sceneX, sceneY) => {
    const canvas = await page.$('canvas');
    const box = await canvas?.boundingBox();
    if (!box) throw new Error('캔버스 없음');
    await page.mouse.click(
      box.x + sceneX * (box.width / 1280),
      box.y + sceneY * (box.height / 720),
    );
  };

  await clickMenuButton(414, 500);
  await page.waitForFunction(() => window.__game?.crownLevel === 1);
  const crown = await page.evaluate(() => ({
    crownLevel: window.__game?.crownLevel,
    ruleset: window.__game?.ruleset,
    lives: window.__game?.lives,
  }));
  if (crown.crownLevel !== 1 || crown.ruleset !== 'life-economy' || crown.lives !== 20) {
    throw new Error(`LIFE 왕관 시작 실패: ${JSON.stringify(crown)}`);
  }

  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__menuReady === true);
  await clickMenuButton(614, 500);
  await page.waitForFunction(() => Boolean(window.__game));
  const daily = await page.evaluate(() => ({
    crownLevel: window.__game?.crownLevel,
    ruleset: window.__game?.ruleset,
  }));
  if (daily.crownLevel !== 0 || daily.ruleset !== 'life-economy') {
    throw new Error(`오늘의 도전 왕관 분리 실패: ${JSON.stringify(daily)}`);
  }

  console.log('CROWN_SMOKE_OK');
  console.log(JSON.stringify({ crown, daily }));
} finally {
  await browser.close();
}
