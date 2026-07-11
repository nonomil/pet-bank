import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:9077/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

async function prepare() {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 20000 });
  await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
    const species = window.PetSystem.getAllSpecies()[0];
    if (species && !window.PetSystem.getState().species) window.PetSystem.chooseSpecies(species.id);
    if (window.PetSystem.getState().level < window.PetSystem.MAX_LEVEL) window.PetSystem.addExp(99999);
    const overlay = document.getElementById('levelUpOverlay');
    if (overlay) overlay.remove();
    window.PetSystem.heal(window.PetSystem.getState().max_hp);
    localStorage.removeItem('petbank_travel_memory_v1');
    localStorage.removeItem('petbank_exploration_progress_v1:forest');
    localStorage.removeItem('petbank_exploration_progress_v1:beach');
  });
}

async function show(sceneId) {
  await page.evaluate(async (id) => {
    window.Math.random = () => 0;
    await window.ExplorationDetail.show(id);
  }, sceneId);
  await page.waitForSelector('#galgameBox');
}

async function advanceSeeToChoice() {
  await page.locator('#galgameBox').click();
  await page.waitForTimeout(80);
  await page.locator('#galgameBox').click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#galgameChoices button').count(), 2, 'short flow exposes one choice after two see cards');
}

try {
  await prepare();

  await show('forest');
  await advanceSeeToChoice();
  await page.locator('#galgameChoices button').first().click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#galgameChoices button').count(), 2, 'choice feedback offers return or challenge');
  assert.equal(await page.locator('#battleModal.show').count(), 0, 'short default path has no battle');
  await page.locator('#galgameChoices button').filter({ hasText: '带回家' }).click();
  await page.waitForSelector('.travel-memory-card');
  assert.match(await page.locator('#galgameName').textContent(), /冒险完成/);
  const forestState = await page.evaluate(() => ({
    memory: Boolean(JSON.parse(localStorage.getItem('petbank_travel_memory_v1') || '{}').forest),
    progress: localStorage.getItem('petbank_exploration_progress_v1:forest')
  }));
  assert.equal(forestState.memory, true, 'short return records travel memory');
  assert.equal(forestState.progress, null, 'short return clears progress');
  const forestItems = await page.evaluate(() => ({
    mushroom: window.InventorySystem.getCount('mushroom'),
    leaf: window.InventorySystem.getCount('leaf')
  }));
  assert.ok(forestItems.mushroom + forestItems.leaf > 0, 'short return grants discovered or chosen item');

  await page.evaluate(() => window.ExplorationDetail.exit());
  await show('beach');
  await advanceSeeToChoice();
  await page.locator('#galgameChoices button').first().click();
  await page.locator('#galgameChoices button').filter({ hasText: '挑战一下' }).click();
  await page.waitForSelector('#galgameChoices button');
  assert.equal(await page.locator('#galgameChoices button').count(), 4, 'challenge path shows math options');
  const beachProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('petbank_exploration_progress_v1:beach') || '{}'));
  assert.equal(beachProgress.flowMode, 'short');
  assert.equal(beachProgress.flowPhase, 'math');
  // Python 静态服务器不提供前端 history fallback；从根入口刷新再恢复场景。
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 20000 });
  await page.evaluate(async () => { await window.PetBankRuntime.ensurePage('explore'); await window.ExplorationDetail.show('beach'); });
  await page.waitForSelector('#galgameChoices button');
  assert.equal(await page.locator('#galgameChoices button').count(), 4, 'refresh restores short math challenge');
  await page.locator('#galgameChoices button').filter({ hasText: '10' }).first().click();
  await page.waitForTimeout(100);
  await page.locator('#galgameBox').click();
  await page.waitForTimeout(100);
  await page.locator('#galgameChoices button').filter({ hasText: '开始挑战' }).click();
  await page.waitForSelector('#battleModal.show');
  let status = await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status);
  let turns = 0;
  while (status === 'ongoing' && turns < 30) {
    await page.locator('#battleActions button').filter({ hasText: '攻击' }).first().click();
    await page.waitForTimeout(100);
    status = await page.evaluate(() => window.ExplorationSystem.getCurrentBattle()?.status);
    turns += 1;
  }
  assert.equal(status, 'won', 'challenge path reaches existing battle victory');
  await page.locator('#battleActions button').filter({ hasText: '继续探索' }).click();
  await page.waitForSelector('.travel-memory-card');
  assert.equal(await page.locator('#battleModal.show').count(), 0);

  await page.evaluate(() => window.ExplorationDetail.exit());
  await page.evaluate(async () => { localStorage.removeItem('petbank_exploration_progress_v1:candy'); await window.ExplorationDetail.show('candy'); });
  await page.waitForSelector('#galgameBox');
  await page.locator('#galgameBox').click();
  await page.locator('#galgameBox').click();
  assert.equal(await page.locator('#galgameChoices button').count(), 4, 'legacy flow still reaches math after two story cards');

  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
  assert.ok(layout.bodyWidth <= layout.viewportWidth, 'short flow mobile has no horizontal overflow');
  assert.deepEqual(errors, [], 'short flow browser console errors');
  console.log(JSON.stringify({ defaultPath: 'forest', challengePath: 'beach', battle: status, layout, errors }));
} finally {
  await browser.close();
}
