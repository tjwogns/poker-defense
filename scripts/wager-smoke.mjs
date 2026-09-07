import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/?lang=en';
const executablePath = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find(existsSync);
if (!executablePath) throw new Error('Chrome/Chromium not found. Set CHROME_PATH.');

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-first-run', '--disable-gpu'] });

async function prepare(page, width, height, { consent = 'denied', visualTest = '' } = {}) {
  console.log(`PREPARE_${width}x${height}`);
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const url = new URL(BASE_URL);
  if (visualTest) url.searchParams.set('visualTest', visualTest);
  await page.goto(url.href, { waitUntil: 'networkidle0' });
  await page.evaluate((analyticsConsent) => {
    localStorage.clear();
    localStorage.setItem('poker-defense:v2:analytics', JSON.stringify({
      version: 1, consent: analyticsConsent, visitorId: '', events: [],
    }));
  }, consent);
  await page.reload({ waitUntil: 'networkidle0' });
  const canvas = await page.$('canvas');
  const box = await canvas?.boundingBox();
  if (!box) throw new Error('Canvas not found');
  const click = (x, y, logicalWidth = width === 390 ? 390 : 1280, logicalHeight = width === 390 ? 844 : 720) =>
    page.mouse.click(box.x + x * box.width / logicalWidth, box.y + y * box.height / logicalHeight);
  if (!visualTest) {
    await page.waitForFunction(() => window.__menuReady === true);
    await click(width === 390 ? 195 : 202, width === 390 ? 716 : 500);
  }
  await page.waitForFunction(() => Boolean(window.__game && window.__playDebug));
  console.log(`PLAY_READY_${width}x${height}`);
  return click;
}

try {
  const desktop = await browser.newPage();
  const clickDesktop = await prepare(desktop, 1280, 720);
  const offers = await desktop.evaluate(() => window.__playDebug.wagerOffers());
  if (offers.length !== 3 || new Set(offers).size !== 3) throw new Error(`Invalid offers: ${offers}`);
  await clickDesktop(320, 445);
  await desktop.waitForFunction(() => Boolean(window.__playDebug.wager().selectedId));
  console.log('DESKTOP_SELECTED');
  await desktop.evaluate(() => { window.__game.round = 10; });
  await desktop.waitForFunction(() => window.__playDebug.wager().resolved === true);
  console.log('DESKTOP_RESOLVED');
  const failed = await desktop.evaluate(() => window.__playDebug.wager());
  if (failed.succeeded) throw new Error(`Expected failed wager: ${JSON.stringify(failed)}`);
  const dataOffEvents = await desktop.evaluate(() => JSON.parse(localStorage.getItem('poker-defense:v2:analytics')).events);
  if (dataOffEvents.length !== 0) throw new Error(`DATA OFF recorded events: ${JSON.stringify(dataOffEvents)}`);

  const goldPage = await browser.newPage();
  const clickGold = await prepare(goldPage, 1280, 720, { consent: 'granted', visualTest: 'wager-gold' });
  const goldOffers = await goldPage.evaluate(() => window.__playDebug.wagerOffers());
  const goldIds = new Set(['pristine_three', 'pair_three', 'suit_four', 'two_pair_two']);
  const goldIndex = goldOffers.findIndex((id) => goldIds.has(id));
  if (goldIndex < 0) throw new Error(`No gold wager offered: ${goldOffers}`);
  await clickGold(320 + goldIndex * 320, 445);
  await goldPage.waitForFunction(() => Boolean(window.__playDebug.wager().selectedId));
  const gold = await goldPage.evaluate(() => {
    const id = window.__playDebug.wager().selectedId;
    const targets = { pristine_three: 3, pair_three: 3, suit_four: 4, two_pair_two: 2 };
    const before = window.__game.gold;
    window.__playDebug.setWagerForTest(id, targets[id]);
    window.__game.round = 10;
    window.__game.pendingMaintenanceRound = 10;
    return { id, before };
  });
  await goldPage.waitForFunction(() => window.__playDebug.wager().resolved === true);
  await goldPage.screenshot({ path: '/tmp/poker-wager-gold-notice.png' });
  const goldPaid = await goldPage.evaluate(async () => {
    const once = window.__game.gold;
    window.__game.round = 11;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { once, repeated: window.__game.gold, state: window.__playDebug.wager() };
  });
  const goldAmounts = { pristine_three: 35, pair_three: 35, suit_four: 40, two_pair_two: 30 };
  if (!goldPaid.state.succeeded || goldPaid.once !== gold.before + goldAmounts[gold.id] || goldPaid.repeated !== goldPaid.once) {
    throw new Error(`Gold reward duplicated or missing: ${JSON.stringify({ gold, goldPaid })}`);
  }
  const dataOnEvents = await goldPage.evaluate(() => JSON.parse(localStorage.getItem('poker-defense:v2:analytics')).events);
  for (const name of ['wager_offered', 'wager_selected', 'wager_resolved']) {
    if (!dataOnEvents.some((event) => event.name === name)) throw new Error(`DATA ON missing ${name}`);
  }

  const sealPage = await browser.newPage();
  const clickSeal = await prepare(sealPage, 1280, 720, { visualTest: 'wager-seal' });
  await clickSeal(320, 445);
  await sealPage.waitForFunction(() => Boolean(window.__playDebug.wager().selectedId));
  const sealPaid = await sealPage.evaluate(async () => {
    const before = window.__game.deckSeals.banish;
    window.__playDebug.setWagerForTest('straight_one', 1);
    window.__game.round = 10;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const once = window.__game.deckSeals.banish;
    window.__game.round = 12;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { before, once, repeated: window.__game.deckSeals.banish, state: window.__playDebug.wager() };
  });
  if (!sealPaid.state.succeeded || sealPaid.once !== sealPaid.before + 1 || sealPaid.repeated !== sealPaid.once) {
    throw new Error(`Seal reward duplicated or missing: ${JSON.stringify(sealPaid)}`);
  }

  const skippedPage = await browser.newPage();
  const clickSkip = await prepare(skippedPage, 1280, 720);
  await clickSkip(640, 560);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const skipped = await skippedPage.evaluate(() => window.__playDebug.wager());
  if (skipped.selectedId !== null || skipped.resolved) throw new Error(`Skip changed wager state: ${JSON.stringify(skipped)}`);

  const mobile = await browser.newPage();
  const clickMobile = await prepare(mobile, 390, 844);
  await mobile.screenshot({ path: '/tmp/poker-wager-mobile.png' });
  await clickMobile(195, 710);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const mobileSkipped = await mobile.evaluate(() => window.__playDebug.wager());
  if (mobileSkipped.selectedId !== null) throw new Error('Mobile skip failed');
  console.log('WAGER_SMOKE_OK');
  console.log(JSON.stringify({ offers, failed, goldPaid, sealPaid, skipped, mobileSkipped, dataOnEventNames: dataOnEvents.map((event) => event.name) }));
} finally {
  await browser.close();
}
