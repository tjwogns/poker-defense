import puppeteer from 'puppeteer-core';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = process.env.SMOKE_DIR ?? mkdtempSync(join(tmpdir(), 'poker-defense-'));
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const errors = [];

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
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2000));
await page.waitForFunction(() => window.__menuReady === true);
await page.screenshot({ path: `${TMP}/shot1-menu.png` });

// 새 게임 → 첫 실행 튜토리얼 건너뛰기
await page.mouse.click(770, 327);
await page.waitForFunction(() => Boolean(window.__game));
await new Promise((r) => setTimeout(r, 300));
await page.mouse.click(520, 500);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${TMP}/shot2-prep.png` });

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
          relicChoices: g.relicChoices.length,
          relics: g.relics.length,
          score: g.score,
          powerCharges: { ...g.powerCharges },
        }
      : null;
  });

console.log('초기 상태:', JSON.stringify(await state()));

// 족보 확정 버튼 (694, 640)
await page.mouse.click(694, 640);
await new Promise((r) => setTimeout(r, 300));
console.log('확정 후:', JSON.stringify(await state()));
const charged = await state();
const suit = Object.entries(charged.powerCharges).find(([, count]) => count > 0)?.[0];
if (!suit) throw new Error('족보 확정 후 무늬 스킬이 충전되지 않았습니다.');

// 타일 (8,5)에 배치 — 화면 (390, 258)
await page.mouse.click(390, 258);
await new Promise((r) => setTimeout(r, 300));
console.log('배치 후:', JSON.stringify(await state()));
await page.screenshot({ path: `${TMP}/shot3-placed.png` });

// 전투 시작 (고정 컨트롤 섹션 중앙)
await page.mouse.click(1022, 424);
await new Promise((r) => setTimeout(r, 4000));
const combat = await state();
console.log('전투 4초:', JSON.stringify(combat));
await page.screenshot({ path: `${TMP}/shot4-combat.png` });

// 실제 키 입력으로 충전된 무늬 스킬 사용
const keyForSuit = { S: 'KeyQ', H: 'KeyW', D: 'KeyR', C: 'KeyT' };
const beforePower = combat.powerCharges[suit];
await page.keyboard.press(keyForSuit[suit]);
await new Promise((r) => setTimeout(r, 250));
const afterPower = await state();
console.log('스킬 사용 후:', JSON.stringify(afterPower));
await page.screenshot({ path: `${TMP}/shot4b-power.png` });

// 코어를 결정론적으로 R10 종료까지 진행해 유물 3지선다 확인
await page.evaluate(() => {
  const g = window.__game;
  g.phase = 'prep';
  g.round = 10;
  g.field.enemies = [];
  g.handConfirmed = true;
  g.startCombat();
  for (let i = 0; i < 5000 && g.phase === 'combat'; i++) g.tickCombat(1 / 30);
});
await new Promise((r) => setTimeout(r, 300));
const reward = await state();
console.log('보스 보상:', JSON.stringify(reward));
await page.screenshot({ path: `${TMP}/shot5-relic.png` });
await page.mouse.click(176, 278);
await new Promise((r) => setTimeout(r, 250));
const chosen = await state();
console.log('유물 선택 후:', JSON.stringify(chosen));

// 필드 상한을 넘겨 종료 오버레이와 PNG 결과 카드 버튼 확인
await page.evaluate(() => {
  const g = window.__game;
  const source = g.field.enemies.find((enemy) => enemy.alive);
  if (!source) throw new Error('종료 테스트용 적이 없습니다.');
  g.phase = 'combat';
  while (g.field.enemies.filter((enemy) => enemy.alive).length <= g.fieldCap) {
    g.field.enemies.push({ ...source, id: g.field.nextId++, alive: true });
  }
});
await new Promise((r) => setTimeout(r, 350));
const ended = await state();
console.log('종료 화면:', JSON.stringify(ended));
await page.screenshot({ path: `${TMP}/shot6-end.png` });

// Web Share 미지원 브라우저의 실제 클립보드 폴백
await page.evaluate(() => {
  window.__copiedText = '';
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async (value) => { window.__copiedText = value; } },
    configurable: true,
  });
});
await page.mouse.click(512, 520);
await new Promise((r) => setTimeout(r, 150));
const copiedText = await page.evaluate(() => window.__copiedText);
await page.mouse.click(768, 520);
await new Promise((r) => setTimeout(r, 150));

// 작은 노트북/모바일 가로 크기에서도 캔버스가 비율 유지로 화면 안에 들어오는지 확인
await page.setViewport({ width: 960, height: 540 });
await new Promise((r) => setTimeout(r, 250));
const compactCanvas = await page.$eval('canvas', (canvas) => {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
});
await page.screenshot({ path: `${TMP}/shot7-compact.png` });

await browser.close();

if (errors.length) {
  console.log('JS 에러:', errors.slice(0, 5).join(' | '));
  process.exit(1);
}
if (!combat || combat.phase !== 'combat' || combat.enemies === 0 || combat.units !== 1) {
  console.log('스모크 실패: 상태 불일치');
  process.exit(1);
}
if (afterPower.powerCharges[suit] !== beforePower - 1) {
  console.log('스모크 실패: 무늬 스킬 키 입력 상태 불일치');
  process.exit(1);
}
if (!reward || reward.relicChoices !== 3 || !chosen || chosen.relics !== 1 || chosen.relicChoices !== 0) {
  console.log('스모크 실패: 유물 선택 상태 불일치');
  process.exit(1);
}
if (!ended || ended.phase !== 'defeat') {
  console.log('스모크 실패: 종료/공유 화면 상태 불일치');
  process.exit(1);
}
if (!copiedText.includes('포커 디펜스') || !copiedText.includes('STANDARD RUN')) {
  console.log('스모크 실패: 결과 공유 클립보드 폴백 불일치');
  process.exit(1);
}
if (compactCanvas.right > 960.5 || compactCanvas.bottom > 540.5 || compactCanvas.width / compactCanvas.height < 1.77) {
  console.log('스모크 실패: 작은 가로 화면 캔버스 스케일 불일치');
  process.exit(1);
}
console.log('SMOKE_OK');
console.log('screenshots:', TMP);
