import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:9077/';
const artifactDir = path.resolve(process.cwd(), process.env.PETBANK_TEST_ARTIFACT_DIR || 'tmp/test-artifacts/travel-memory-real-journey');
const scenarios = [
  { id: 'forest', answer: '2', screenshot: 'travel-memory-real-journey-forest.png' },
  { id: 'beach', answer: '10', screenshot: 'travel-memory-real-journey-beach.png' },
  { id: 'stargarden', answer: '12', screenshot: 'travel-memory-real-journey-stargarden.png' }
];

async function assertScreenshot(filePath) {
  const result = await stat(filePath);
  assert.ok(result.size > 0, `screenshot should be non-empty: ${filePath}`);
}

async function captureScreenshot(page, filePath, options) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.screenshot({ path: filePath, ...options });
      await assertScreenshot(filePath);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(250 * attempt);
    }
  }
  throw lastError;
}

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

async function preparePet() {
  return page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
    const species = window.PetSystem.getAllSpecies()[0];
    if (species && !window.PetSystem.getState().species) window.PetSystem.chooseSpecies(species.id);
    if (window.PetSystem.getState().level < window.PetSystem.MAX_LEVEL) window.PetSystem.addExp(99999);
    const levelUpOverlay = document.getElementById('levelUpOverlay');
    if (levelUpOverlay) levelUpOverlay.remove();
    const state = window.PetSystem.getState();
    window.PetSystem.heal(state.max_hp);
    return {
      speciesId: state.species,
      name: state.species_data?.name || '我的宠物',
      emoji: state.species_data?.emoji || state.stage_emoji || '🐾',
      image: window.PetSystem.getCurrentStageImage?.() || state.species_data?.imageUrl || '',
      stage: state.stage?.name || '成长中'
    };
  });
}

async function ensureUnlocked(sceneId) {
  await page.evaluate(async (id) => {
    await window.PetBankRuntime.ensurePage('explore');
    const scene = window.ExplorationSystem.getSceneById(id);
    if (!scene) throw new Error(`missing scene: ${id}`);
    if (!window.ExplorationSystem.isSceneUnlocked(scene)) {
      if (typeof window.addGrowthPoints === 'function') window.addGrowthPoints(1000);
      const result = window.ExplorationSystem.unlockScene(id);
      if (!result.success) throw new Error(`unlock failed: ${id} ${result.msg}`);
    }
  }, sceneId);
}

async function completeScenario(scenario, expectedPet, expectedCollectionCount) {
  await ensureUnlocked(scenario.id);
  await page.evaluate(() => window.PetSystem.heal(window.PetSystem.getState().max_hp));
  const cardsBefore = await page.evaluate(() => localStorage.getItem('petbank_cards'));
  await page.evaluate(async (sceneId) => {
    window.Math.random = () => 0;
    await window.ExplorationDetail.show(sceneId);
  }, scenario.id);
  await page.waitForSelector('#galgameBox');

  const beats = [await page.locator('#galgameName').textContent()];
  await clickStoryBox();
  beats.push(await page.locator('#galgameName').textContent());
  await clickStoryBox();
  beats.push(await page.locator('#galgameName').textContent());

  const routeOptions = page.locator('#galgameChoices button');
  assert.equal(await routeOptions.count(), 2, `${scenario.id} route choices visible`);
  await routeOptions.first().click();
  await page.waitForTimeout(120);
  const shortActions = page.locator('#galgameChoices button');
  assert.equal(await shortActions.count(), 2, `${scenario.id} short return actions visible`);
  await shortActions.filter({ hasText: '挑战一下' }).click();
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#galgameChoices button').count(), 4, `${scenario.id} optional math options visible`);
  await page.locator('#galgameChoices button').filter({ hasText: new RegExp(`^${scenario.answer}$`) }).first().click();
  await page.waitForTimeout(120);
  await page.locator('#galgameBox').click();
  await page.waitForTimeout(120);
  assert.match(await page.locator('#galgameText').textContent(), /守卫|伙伴|眼睛|沙堡|星光/);
  await page.locator('#galgameChoices button').filter({ hasText: '开始挑战' }).click();

  await page.waitForSelector('#battleModal.show');
  let battleStatus = await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status);
  let turns = 0;
  while (battleStatus === 'ongoing' && turns < 30) {
    await page.locator('#battleActions button').filter({ hasText: '攻击' }).first().click();
    await page.waitForTimeout(150);
    battleStatus = await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status);
    turns += 1;
  }
  assert.equal(battleStatus, 'won', `${scenario.id} encounter won through visible attack button`);
  await page.locator('#battleActions button').filter({ hasText: '继续探索' }).click();
  await page.waitForTimeout(180);
  await page.waitForSelector('.travel-memory-card');
  const screenshotPath = path.join(artifactDir, scenario.screenshot);
  await captureScreenshot(page, screenshotPath, { fullPage: false });

  const result = await page.evaluate((sceneId) => {
    let memories = {};
    try { memories = JSON.parse(localStorage.getItem('petbank_travel_memory_v1') || '{}'); } catch {}
    const memory = memories[sceneId] || null;
    return {
      memory,
      completionCard: Boolean(document.querySelector('.travel-memory-card')),
      badgeAsset: Boolean(document.querySelector('.travel-memory-card .travel-memory-art')),
      currentBattle: window.ExplorationSystem.getCurrentBattle(),
      cardIds: localStorage.getItem('petbank_cards')
    };
  }, scenario.id);
  assert.ok(result.memory, `${scenario.id} memory persisted after real journey`);
  assert.deepEqual(result.memory.pet, expectedPet, `${scenario.id} pet snapshot matches journey pet`);
  assert.equal(result.completionCard, true, `${scenario.id} completion card visible`);
  assert.equal(result.badgeAsset, true, `${scenario.id} badge asset visible`);
  assert.equal(result.currentBattle, null, `${scenario.id} battle ended before completion page`);
  const cardIdsBefore = cardsBefore ? JSON.parse(cardsBefore) : [];
  const cardIdsAfter = result.cardIds ? JSON.parse(result.cardIds) : [];
  assert.ok(cardIdsBefore.every((id) => cardIdsAfter.includes(id)), `${scenario.id} preserves existing battle cards`);

  await page.evaluate(() => window.switchPage('card'));
  await page.waitForFunction((title) => Array.from(document.querySelectorAll('.travel-memory-gallery-card strong')).some((node) => node.textContent.includes(title)), result.memory.title);
  assert.equal(await page.locator('.travel-memory-gallery-card').count(), expectedCollectionCount, `${scenario.id} travel cards visible in collection`);
  await page.evaluate(() => window.ExplorationDetail.exit());
  await page.waitForTimeout(120);
  return { sceneId: scenario.id, beats, battleStatus, turns, pet: result.memory.pet, title: result.memory.title, cardIdsBefore: cardIdsBefore.length, cardIdsAfter: cardIdsAfter.length };
}

try {
  await mkdir(artifactDir, { recursive: true });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 20000 });
  const expectedPet = await preparePet();
  const results = [];
  for (const [index, scenario] of scenarios.entries()) results.push(await completeScenario(scenario, expectedPet, index + 1));
  assert.deepEqual(errors, [], 'real journey console errors');
  console.log(JSON.stringify({ results, errors }));
} finally {
  await browser.close();
}
