import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-hidden-'));
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
await page.mouse.click(770, 310);
await page.waitForFunction(() => Boolean(window.__game));
await page.mouse.click(520, 500);
await new Promise((resolve) => setTimeout(resolve, 250));
await page.screenshot({ path: `${TMP}/hand-reroll-guidance.png` });
await page.keyboard.press('d');
await new Promise((resolve) => setTimeout(resolve, 250));
await page.screenshot({ path: `${TMP}/hidden-deck-recipes.png` });
await page.keyboard.press('d');
await new Promise((resolve) => setTimeout(resolve, 250));

await page.evaluate(() => {
  const game = window.__game;
  const ace = { rank: 14, suit: 'S' };
  game.deckSeals.duplicate = 4;
  for (let count = 0; count < 4; count++) {
    if (!game.applyDeckSeal('duplicate', ace)) throw new Error('히든 테스트 덱 복제 실패');
  }
  game.hand = Array.from({ length: 5 }, () => ({ ...ace }));
  game.holds = Array(5).fill(false);
});
await new Promise((resolve) => setTimeout(resolve, 250));
await page.mouse.click(694, 640);
await new Promise((resolve) => setTimeout(resolve, 500));

const discovered = await page.evaluate(() => {
  const profile = JSON.parse(localStorage.getItem('poker-defense:v2-beta:profile') ?? '{}');
  return {
    rank: window.__game.lastHandRank,
    pending: [...window.__game.pendingUnits],
    discoveredHands: profile.discoveredHands ?? [],
  };
});
await page.screenshot({ path: `${TMP}/hidden-discovered.png` });

await page.keyboard.press('h');
await new Promise((resolve) => setTimeout(resolve, 250));
await page.screenshot({ path: `${TMP}/hidden-guide-unlocked.png` });

await page.reload({ waitUntil: 'networkidle0' });
const persisted = await page.evaluate(() => {
  const profile = JSON.parse(localStorage.getItem('poker-defense:v2-beta:profile') ?? '{}');
  return profile.discoveredHands ?? [];
});
await browser.close();

if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);
if (discovered.rank !== 12 || discovered.pending[0] !== 12) {
  throw new Error(`플러시 파이브 확정 실패: ${JSON.stringify(discovered)}`);
}
if (!discovered.discoveredHands.includes(12) || !persisted.includes(12)) {
  throw new Error(`히든 족보 저장 유지 실패: ${JSON.stringify({ discovered, persisted })}`);
}
console.log('HIDDEN_SMOKE_OK');
console.log('screenshots:', TMP);
