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

const initialDustCount = await page.locator('.spark .spark-image[src*="dust_puff"]').count();
assert.equal(initialDustCount, 0, 'movement dust should not exist before the hero starts moving');

await page.keyboard.down('ArrowRight');
await page.waitForFunction(() => {
  const hero = document.querySelector('.hero-unit');
  const sprite = document.querySelector('.hero-sprite');
  return hero?.classList.contains('is-moving')
    && /right-walk/.test(sprite?.getAttribute('data-sprite-key') || '');
}, null, { timeout: 1500 });
await page.waitForTimeout(120);

const movementState = await page.evaluate(() => {
  const hero = document.querySelector('.hero-unit');
  const sprite = document.querySelector('.hero-sprite');
  const dustNodes = Array.from(document.querySelectorAll('.spark .spark-image[src*="dust_puff"]'));
  return {
    heroClass: hero?.className ?? '',
    spriteKey: sprite?.getAttribute('data-sprite-key') ?? '',
    dustCount: dustNodes.length,
    dustSources: dustNodes.map(node => node.getAttribute('src'))
  };
});

await page.keyboard.up('ArrowRight');

await browser.close();

assert.match(movementState.heroClass, /is-moving/, 'hero should enter moving state after movement input');
assert.match(movementState.spriteKey, /right-walk/, 'hero should switch to a right-walk sprite while moving right');
assert.ok(movementState.dustCount > 0, 'hero should spawn at least one dust puff when starting to move');
assert.ok(
  movementState.dustSources.every(src => /dust_puff/.test(src || '')),
  `movement dust should use dust puff assets, got: ${movementState.dustSources.join(', ')}`
);

console.log('PASS - word memory map movement FX');
