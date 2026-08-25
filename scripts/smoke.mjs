import puppeteer from 'puppeteer-core';

const TMP = '/Users/jerry/.claude/jobs/95f41d16/tmp';
const errors = [];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: `${TMP}/shot1-prep.png` });

const state = () =>
  page.evaluate(() => {
    const g = window.__game;
    return g
      ? {
          phase: g.phase,
          round: g.round,
          gold: g.gold,
          hand: g.hand.length,
          pending: g.pendingUnits.length,
          units: g.field.units.length,
          enemies: g.field.enemies.filter((e) => e.alive).length,
        }
      : null;
  });

console.log('초기 상태:', JSON.stringify(await state()));

// 족보 확정 버튼 (694, 640)
await page.mouse.click(694, 640);
await new Promise((r) => setTimeout(r, 300));
console.log('확정 후:', JSON.stringify(await state()));

// 타일 (8,5)에 배치 — 화면 (390, 258)
await page.mouse.click(390, 258);
await new Promise((r) => setTimeout(r, 300));
console.log('배치 후:', JSON.stringify(await state()));
await page.screenshot({ path: `${TMP}/shot2-placed.png` });

// 전투 시작 (1022, 452)
await page.mouse.click(1022, 452);
await new Promise((r) => setTimeout(r, 4000));
const combat = await state();
console.log('전투 4초:', JSON.stringify(combat));
await page.screenshot({ path: `${TMP}/shot3-combat.png` });

await browser.close();

if (errors.length) {
  console.log('JS 에러:', errors.slice(0, 5).join(' | '));
  process.exit(1);
}
if (!combat || combat.phase !== 'combat' || combat.enemies === 0 || combat.units !== 1) {
  console.log('스모크 실패: 상태 불일치');
  process.exit(1);
}
console.log('SMOKE_OK');
