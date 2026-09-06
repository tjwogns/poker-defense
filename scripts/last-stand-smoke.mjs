import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5178/?visualTest=last-stand';
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

  const result = await page.evaluate(() => {
    const game = window.__game;
    const before = new Set(game.hand.map((card) => `${card.rank}${card.suit}`));
    if (!game.isAllInExchangeNow) throw new Error('마지막 교환 상태가 아님');
    if (!game.doExchange()) throw new Error('5장 올인 교환 실패');
    const redrawn = game.hand.every((card) => !before.has(`${card.rank}${card.suit}`));
    game.confirmHand();
    if (!game.placeUnit(5, 2)) throw new Error('올인 유닛 배치 실패');
    const unit = game.field.units[0];
    return {
      redrawn,
      holds: [...game.holds],
      triggers: [...game.lastRelicTriggers],
      allIn: unit.allIn,
      speedMultiplier: game.unitDpsMult(unit) / game.unitDpsMult({ ...unit, allIn: false }),
    };
  });

  if (!result.redrawn || result.holds.some(Boolean) || !result.allIn) {
    throw new Error(`올인 규칙 실패: ${JSON.stringify(result)}`);
  }
  if (!result.triggers.includes('last_stand') || Math.abs(result.speedMultiplier - 1.15) > 0.001) {
    throw new Error(`올인 보너스 실패: ${JSON.stringify(result)}`);
  }
  if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);

  console.log('LAST_STAND_SMOKE_OK');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
