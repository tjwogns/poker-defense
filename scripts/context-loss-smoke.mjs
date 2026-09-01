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
  args: ['--no-first-run', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (!text.includes('CONTEXT_LOST_WEBGL')) errors.push(text);
});

await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  const analytics = JSON.stringify({
    version: 1, consent: 'denied', visitorId: '', events: [],
  });
  localStorage.setItem('poker-defense:v2:analytics', analytics);
  localStorage.setItem('poker-defense:v2-beta:analytics', analytics);
});
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__menuReady === true);
const initialRenderer = await page.$eval('canvas', (canvas) => canvas.dataset.renderer);
if (initialRenderer !== 'webgl') throw new Error(`WebGL 테스트 시작 실패: ${initialRenderer}`);

const extensionAvailable = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl');
  const extension = gl?.getExtension('WEBGL_lose_context');
  if (!extension) return false;
  window.__webglLossExtension = extension;
  extension.loseContext();
  return true;
});
if (!extensionAvailable) throw new Error('WEBGL_lose_context 확장을 사용할 수 없습니다.');

await page.waitForFunction(() => document.getElementById('renderer-recovery')?.hidden === false);
await page.evaluate(() => window.__webglLossExtension.restoreContext());
await page.waitForFunction(() => document.getElementById('renderer-recovery')?.hidden === true);
await page.waitForFunction(() => window.__menuReady === true);

await page.evaluate(() => window.__webglLossExtension.loseContext());
await page.waitForFunction(() => document.getElementById('renderer-recovery')?.hidden === false);
await page.waitForFunction(() => document.getElementById('renderer-safe-mode')?.hidden === false, { timeout: 6_000 });
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('#renderer-safe-mode'),
]);
await page.waitForFunction(() => window.__menuReady === true);
const safeRenderer = await page.$eval('canvas', (canvas) => canvas.dataset.renderer);
await page.mouse.click(202, 500);
try {
  await page.waitForFunction(() => Boolean(window.__game && window.__playDebug), { timeout: 8_000 });
} catch (error) {
  const diagnostic = await page.evaluate(() => ({
    menuReady: window.__menuReady,
    renderer: document.querySelector('canvas')?.dataset.renderer,
    recoveryHidden: document.getElementById('renderer-recovery')?.hidden,
    analytics: localStorage.getItem('poker-defense:v2:analytics')
      ?? localStorage.getItem('poker-defense:v2-beta:analytics'),
  }));
  await page.screenshot({ path: '/tmp/poker-defense-canvas-entry-failure.png' });
  throw new Error(`Canvas 게임 진입 대기 실패: ${JSON.stringify({ diagnostic, errors })}`, { cause: error });
}
const safeModePlayable = await page.evaluate(() => window.__game?.phase === 'prep');
await browser.close();

if (errors.length > 0) throw new Error(`브라우저 오류: ${errors.join(' | ')}`);
if (safeRenderer !== 'canvas') throw new Error(`Canvas 안정 모드 실패: ${safeRenderer}`);
if (!safeModePlayable) throw new Error('Canvas 안정 모드에서 게임 진입 실패');
console.log('CONTEXT_LOSS_SMOKE_OK');
console.log(JSON.stringify({ initialRenderer, recovered: true, stalledFallback: true, safeRenderer, safeModePlayable }));
