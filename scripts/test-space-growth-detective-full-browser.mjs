import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const root = process.cwd();
const packRoot = path.join(root, 'data', 'story-packs', '03-space-growth-detective');
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'manifest.json'), 'utf8'));
const cases = manifest.caseIds.map((caseId) => JSON.parse(fs.readFileSync(path.join(packRoot, 'cases', `${caseId}.json`), 'utf8')));
const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8897/app/explore?story_test=space-growth-detective';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

async function storyState() {
  return page.evaluate(() => ({
    records: JSON.parse(localStorage.getItem('petbank_pet_story_cases_v1') || '{}').records || {},
    collection: JSON.parse(localStorage.getItem('petbank_space_growth_collectibles_v1') || '{}').profiles || {},
    mapText: document.querySelector('[data-space-growth-map]')?.textContent || ''
  }));
}

async function dismissTransientOverlays() {
  await page.evaluate(() => {
    document.getElementById('levelUpOverlay')?.remove();
    document.querySelectorAll('.confetti-piece').forEach((node) => node.remove());
  });
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 30000 });
  await page.evaluate(async () => {
    localStorage.removeItem('petbank_pet_story_cases_v1');
    localStorage.removeItem('petbank_space_growth_collectibles_v1');
    localStorage.setItem('petbank_points', '500');
    await window.PetBankRuntime.ensurePage('explore');
    const species = window.PetSystem.getAllSpecies()[0];
    if (!window.PetSystem.getState().species && species) window.PetSystem.chooseSpecies(species.id);
    await window.switchPage('explore');
    await window.renderExplorePage();
    window.SpaceGrowthDetective.prepareTestPet();
  });
  await dismissTransientOverlays();
  assert.equal(await page.locator('[data-space-growth-node]').count(), 5, 'test map has five nodes');

  const results = [];
  for (const item of cases) {
    await page.evaluate(() => window.SpaceGrowthDetective.prepareTestPet());
    await dismissTransientOverlays();
    await page.locator(`[data-space-growth-node][data-case-id="${item.id}"]`).click();
    await page.waitForSelector(`#petStoryCasePanel [data-story-answer="${item.question.answers.find((answer) => answer.isCorrect)?.id}"]`);
    const correctAnswer = item.question.answers.find((answer) => answer.isCorrect === true);
    await page.locator(`[data-story-answer="${correctAnswer.id}"]`).click();
    await page.locator('[data-story-care]').click();
    await page.waitForSelector('#battleModal.show', { timeout: 10000 });
    const beforeBattle = await storyState();
    assert.equal(Object.keys(beforeBattle.records).length, results.length, `${item.id}: no receipt before victory`);

    let turns = 0;
    while (await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status) === 'ongoing' && turns < 60) {
      await page.locator('#battleActions button').filter({ hasText: '攻击' }).first().click();
      turns += 1;
    }
    assert.equal(await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status), 'won', `${item.id}: battle won`);
    await page.locator('#battleActions button').filter({ hasText: '继续探索' }).click();
    await page.waitForSelector('#battleModal.show', { state: 'hidden' });
    await page.waitForFunction((caseId) => Object.values(JSON.parse(localStorage.getItem('petbank_pet_story_cases_v1') || '{}').records || {}).some((record) => record.caseId === caseId), item.id);
    const afterBattle = await storyState();
    const collection = afterBattle.collection.p_default || { cards: [], badges: [] };
    assert.ok(collection.cards.includes(item.rewards.cardId), `${item.id}: story card claimed`);
    assert.ok(collection.badges.includes(item.rewards.badgeId), `${item.id}: badge claimed`);
    results.push({ caseId: item.id, turns, records: Object.keys(afterBattle.records).length, cards: collection.cards.length, badges: collection.badges.length });
  }

  assert.equal(results.length, 5);
  assert.equal(results.at(-1).records, 5, 'all five scoped receipts exist');
  assert.equal(results.at(-1).cards, 5, 'all five cards collected');
  assert.equal(results.at(-1).badges, 5, 'all five badges collected');
  assert.deepEqual(errors, [], 'full story run has no browser errors');
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser.close();
}
