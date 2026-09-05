import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5177/?art=pixel&visualTest=pixel-motion';
const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-pixel-'));
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
  await page.waitForFunction(() => window.__game?.field.units.length === 13);
  await new Promise((resolve) => setTimeout(resolve, 1600));

  const state = await page.evaluate(() => ({
    phase: window.__game?.phase,
    unitCount: window.__game?.field.units.length,
    round: window.__game?.round,
    canvas: Boolean(document.querySelector('canvas')),
  }));
  await page.screenshot({ path: join(TMP, 'pixel-motion-roster.png') });

  if (!state.canvas || state.unitCount !== 13 || state.phase !== 'combat') {
    throw new Error(`Unexpected pixel preview state: ${JSON.stringify(state)}`);
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({ ok: true, state, screenshot: join(TMP, 'pixel-motion-roster.png') }));
} finally {
  await browser.close();
}
