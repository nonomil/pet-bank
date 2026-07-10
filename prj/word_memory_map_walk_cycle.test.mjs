import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const PROTOTYPE_URL = process.env.WORD_MEMORY_MAP_URL
  || 'http://127.0.0.1:8000/prj/%E5%8D%95%E8%AF%8D%E8%AE%B0%E5%BF%86%E5%B0%84%E5%87%BB%E5%9C%BA%E5%8E%9F%E5%9E%8B/index.html';

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1
});

await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hero-sprite');
await page.waitForFunction(() => window.__wordMemoryReady === true, null, { timeout: 5000 });

await page.keyboard.down('ArrowRight');

const spriteKeys = [];
for (let sample = 0; sample < 16; sample += 1) {
  await page.waitForTimeout(80);
  spriteKeys.push(await page.locator('.hero-sprite').getAttribute('data-sprite-key'));
}

await page.keyboard.up('ArrowRight');

await browser.close();

const rightMovingKeys = spriteKeys.filter(key => /^right-walk-/.test(key || ''));
assert.ok(rightMovingKeys.length >= 3, `expected to observe multiple right-walk frames, got: ${spriteKeys.join(', ')}`);
assert.ok(
  new Set(rightMovingKeys).size >= 3,
  `expected a three-beat walk cycle with at least three unique move frames, got: ${rightMovingKeys.join(', ')}`
);

console.log('PASS - word memory map walk cycle');
