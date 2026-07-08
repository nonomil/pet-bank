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
await page.waitForTimeout(320);

const missionRail = page.locator('#missionRail');
await assert.doesNotReject(async () => {
  await missionRail.waitFor({ state: 'visible', timeout: 1500 });
}, 'mission rail should exist on the HUD');

const comboText = page.locator('#comboText');
const comboLabel = page.locator('#comboChip');
const progressFill = page.locator('#missionProgressFill');

async function solveOneWord() {
  const orbId = await page.locator('[data-orb-id]').first().getAttribute('data-orb-id');
  assert.ok(orbId, 'expected an orb id');
  const targetId = `target-${orbId.replace(/^orb-/, '')}`;
  await page.locator(`[data-orb-id="${orbId}"]`).click({ force: true });
  await page.locator(`[data-target-id="${targetId}"]`).click({ force: true });
  await page.waitForTimeout(420);
}

await solveOneWord();
await solveOneWord();

const comboValue = await comboText.textContent();
const comboClass = await comboLabel.getAttribute('class');
const progressStyle = await progressFill.getAttribute('style');

await browser.close();

assert.match(comboValue || '', /2/, `combo HUD should show streak 2 after two correct hits, got: ${comboValue}`);
assert.match(comboClass || '', /is-hot/, `combo HUD should highlight after two correct hits, got: ${comboClass}`);
assert.match(progressStyle || '', /--mission-progress:/, 'mission progress fill should expose a progress style variable');

console.log('PASS - word memory map rewards UI');
