import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_URL = process.env.BASE_URL
  ?? 'http://127.0.0.1:5178/?enemyArt=discarded&visualTest=enemy-roster';
const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-enemies-'));
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);
if (!executablePath) throw new Error('Chrome/Chromium not found. Set CHROME_PATH.');

const errors = [];
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__game?.field.enemies.length === 5);
  const state = await page.evaluate(() => ({
    phase: window.__game?.phase,
    enemyKinds: window.__game?.field.enemies.map((enemy) => enemy.kind).sort(),
    loadedEnemyAssets: performance.getEntriesByType('resource')
      .filter((entry) => entry.name.includes('/assets/enemies/')).length,
    canvas: Boolean(document.querySelector('canvas')),
  }));
  const screenshot = join(TMP, 'discarded-enemy-roster.png');
  await page.screenshot({ path: screenshot });

  const expectedKinds = ['fast', 'normal', 'regen', 'splitter', 'tank'];
  if (!state.canvas || state.phase !== 'combat'
    || JSON.stringify(state.enemyKinds) !== JSON.stringify(expectedKinds)
    || state.loadedEnemyAssets !== 5) {
    throw new Error(`Unexpected enemy preview state: ${JSON.stringify(state)}`);
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ok: true, state, screenshot }));
} finally {
  await browser.close();
}
