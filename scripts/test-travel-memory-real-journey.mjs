import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:9077/';
const screenshotPath = 'docs/releases/travel-memory-real-journey-desktop.png';

const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

async function clickStoryBox() {
  await page.locator('#galgameBox').click();
  await page.waitForTimeout(120);
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 20000 });
  const expectedPet = await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
    const species = window.PetSystem.getAllSpecies()[0];
    if (species) window.PetSystem.chooseSpecies(species.id);
    window.PetSystem.heal(window.PetSystem.getState().max_hp);
    const state = window.PetSystem.getState();
    return {
      speciesId: state.species,
      name: state.species_data?.name || '我的宠物',
      emoji: state.species_data?.emoji || state.stage_emoji || '🐾',
      image: window.PetSystem.getCurrentStageImage?.() || state.species_data?.imageUrl || '',
      stage: state.stage?.name || '成长中'
    };
  });
  await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
    await window.TravelMemory.load();
    window.Math.random = () => 0;
    await window.ExplorationDetail.show('forest');
  });
  await page.waitForSelector('#galgameBox');

  const beatLog = [];
  beatLog.push(await page.locator('#galgameName').textContent());
  await clickStoryBox();
  beatLog.push(await page.locator('#galgameName').textContent());
  await clickStoryBox();
  beatLog.push(await page.locator('#galgameName').textContent());

  const mathOptions = page.locator('#galgameChoices button');
  assert.equal(await mathOptions.count(), 4, 'forest math options visible');
  const correctMath = mathOptions.filter({ hasText: '2' }).first();
  await correctMath.click();
  await page.waitForTimeout(120);
  assert.match(await page.locator('#galgameText').textContent(), /脚印记录补齐|答对了/);
  await clickStoryBox();

  const routeOptions = page.locator('#galgameChoices button');
  assert.equal(await routeOptions.count(), 2, 'forest route choices visible');
  await routeOptions.first().click();
  await page.waitForTimeout(120);
  await clickStoryBox();
  assert.match(await page.locator('#galgameText').textContent(), /树洞里有双眼睛|遭遇/);
  await clickStoryBox();

  await page.waitForSelector('#battleModal.show');
  let battleStatus = await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status);
  let turns = 0;
  while (battleStatus === 'ongoing' && turns < 12) {
    const attack = page.locator('#battleActions button').filter({ hasText: '攻击' }).first();
    await attack.click();
    await page.waitForTimeout(180);
    battleStatus = await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status);
    turns += 1;
  }
  assert.equal(battleStatus, 'won', 'forest encounter won through visible attack button');
  await page.locator('#battleActions button').filter({ hasText: '继续探索' }).click();
  await page.waitForTimeout(180);
  await page.waitForSelector('.travel-memory-card');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const result = await page.evaluate(() => {
    let memories = {};
    try { memories = JSON.parse(localStorage.getItem('petbank_travel_memory_v1') || '{}'); } catch {}
    const forest = memories.forest || null;
    return {
      forestMemory: forest,
      completionCard: Boolean(document.querySelector('.travel-memory-card')),
      badgeAsset: Boolean(document.querySelector('.travel-memory-card .travel-memory-art')),
      currentBattle: window.ExplorationSystem.getCurrentBattle(),
      cardIds: localStorage.getItem('petbank_cards')
    };
  });
  assert.ok(result.forestMemory, 'forest memory persisted after real journey');
  assert.deepEqual(result.forestMemory.pet, expectedPet, 'pet snapshot matches the journey pet');
  assert.equal(result.completionCard, true);
  assert.equal(result.badgeAsset, true);
  assert.equal(result.currentBattle, null, 'battle ended before completion page');
  assert.equal(result.cardIds, null, 'travel completion does not add a battle card');
  await page.evaluate(() => window.switchPage('card'));
  await page.waitForFunction(() => document.querySelector('.travel-memory-gallery-card strong')?.textContent.includes('森林贴纸'));
  assert.equal(await page.locator('.travel-memory-gallery-card').count(), 1, 'forest travel card visible in collection');
  assert.deepEqual(errors, [], 'real journey console errors');
  console.log(JSON.stringify({
    beats: beatLog,
    battleStatus,
    turns,
    sceneId: result.forestMemory.sceneId,
    pet: result.forestMemory.pet,
    completionCard: result.completionCard,
    badgeAsset: result.badgeAsset,
    collectionCardCount: await page.locator('.travel-memory-gallery-card').count(),
    errors
  }));
} finally {
  await browser.close();
}
