import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:9078/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

async function prepareWithPet() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 20000 });
  await page.evaluate(async () => {
    localStorage.removeItem('petbank_pet_story_cases_v1');
    if (typeof window.addGrowthPoints === 'function') window.addGrowthPoints(100);
    else localStorage.setItem('petbank_points', '100');
    await window.PetBankRuntime.ensurePage('explore');
    const species = window.PetSystem.getAllSpecies()[0];
    if (!window.PetSystem.getState().species && species) window.PetSystem.chooseSpecies(species.id);
    const pet = JSON.parse(localStorage.getItem('petbank_pet'));
    pet.hunger = 10;
    pet.hp = Math.max(20, pet.hp || 100);
    localStorage.setItem('petbank_pet', JSON.stringify(pet));
    window.PetSystem.load();
    await window.switchPage('explore');
    await window.renderExplorePage();
  });
  assert.equal(await page.evaluate(() => Boolean(window.PetStoryCases)), true, 'explore bundle loads story case module');
  await page.waitForSelector('#petStoryCasePanel .story-case-card', { state: 'attached' });
}

try {
  await prepareWithPet();
  assert.match(await page.locator('#petStoryCasePanel').textContent(), /能量星尘/);
  assert.match(await page.locator('[data-story-clue]').textContent(), /需要点心/);
  await page.locator('[data-story-answer="feed-first"]').click();
  await page.locator('[data-story-care]').click();
  await page.waitForSelector('[data-story-reply]');
  const careResult = await page.evaluate(() => ({
    hunger: window.PetSystem.getState().hunger,
    records: JSON.parse(localStorage.getItem('petbank_pet_story_cases_v1') || '{}').records || {},
    battleOpen: Boolean(document.querySelector('#battleModal.show'))
  }));
  assert.ok(careResult.hunger > 10, 'real feed action updates the pet state');
  assert.equal(Object.keys(careResult.records).length, 1, 'care completion writes one scoped story receipt');
  assert.equal(careResult.battleOpen, false, 'detective case does not open battle UI');

  await page.evaluate(async () => {
    localStorage.removeItem('petbank_pet_story_cases_v1');
    localStorage.setItem('petbank_pet', JSON.stringify({ species: null, hp: 100, hunger: 100 }));
    window.PetSystem.load();
    await window.renderExplorePage();
  });
  await page.waitForSelector('[data-story-answer="feed-first"]');
  await page.locator('[data-story-answer="feed-first"]').click();
  await page.locator('[data-story-fallback]').click();
  await page.waitForSelector('[data-story-reply]');
  assert.match(await page.locator('[data-story-reply]').textContent(), /好办法|安全路线/);
  assert.equal(await page.locator('#battleModal.show').count(), 0, 'fallback remains non-combat');

  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
  assert.ok(layout.bodyWidth <= layout.viewportWidth, 'story panel has no mobile horizontal overflow');
  assert.deepEqual(errors, [], 'story panel has no browser console errors');
  console.log(JSON.stringify({ careResult, layout, errors }));
} finally {
  await browser.close();
}
