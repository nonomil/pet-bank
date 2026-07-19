import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const BASE = process.env.MMWG_E2E_BASE_URL || 'http://127.0.0.1:7000';
const REGION_IDS = ['grassland-trail', 'village-gate', 'deep-mine', 'nether-portal', 'ender-dragon-arena'];
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.addInitScript(() => {
  window.__PETBANK_API_BASE_URL__ = '/__local-only-api';
  ['petbank_self_hosted_api_base_url', 'petbank_self_hosted_access_token', 'petbank_self_hosted_refresh_token'].forEach(key => localStorage.removeItem(key));
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => String(input).includes('/__local-only-api')
    ? Promise.resolve(new Response(JSON.stringify({ error: { code: 'LOCAL_ONLY' } }), { status: 404, headers: { 'content-type': 'application/json' } }))
    : nativeFetch(input, init);
});
const errors = [];
page.on('pageerror', error => errors.push(String(error?.message || error)));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

async function waitForPage() {
  await page.waitForSelector('#page-minecraft-vocab.active [data-minecraft-vocab-page]', { timeout: 20000 });
}

async function clearLocalState() {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(key => key.startsWith('petbank_minecraft_expedition_state_') || key.startsWith('petbank_minecraft_vocab_session_') || key.includes('learning_vocab_progress')).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('petbank_game_reward_receipts_v1');
    localStorage.removeItem('petbank_core_reward_receipts_v1');
    window.EnglishVocabProgress?.reset?.();
  });
  await page.evaluate(() => window.switchPage('minecraft-vocab', { skipAccessGate: true }));
  await waitForPage();
}

async function finishCards() {
  for (let count = 0; count < 8; count += 1) {
    const known = page.locator('[data-mv-self-assess="known"]');
    if (await known.count()) {
      await known.click();
    } else {
      const choice = page.locator('[data-mv-choice]').first();
      assert.equal(await choice.count(), 1, 'question card should expose an answer choice');
      await choice.click();
    }
    if (await page.locator('[data-mv-battle]').count()) return;
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('[data-mv-battle]', { timeout: 10000 });
}

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
  await page.evaluate(() => window.switchPage('minecraft-vocab', { skipAccessGate: true }));
  await waitForPage();
  await clearLocalState();

  const home = await page.evaluate(() => {
    const mapImage = document.querySelector('[data-mv-expedition-image]');
    return {
      nodes: document.querySelectorAll('[data-mv-region]').length,
      enabled: document.querySelectorAll('[data-mv-region]:not([disabled])').length,
      mapWidth: mapImage?.naturalWidth || 0,
      mapSrc: mapImage?.getAttribute('src') || ''
    };
  });
  assert.equal(home.nodes, 5, 'five story map regions should render');
  assert.equal(home.enabled, 1, 'only the first region should start unlocked');
  assert.equal(home.mapWidth > 0, true, 'expedition map image should load');
  assert.match(home.mapSrc, /minecraft-expedition\/expedition-map\.png/);

  const snapshots = [];
  for (const regionId of REGION_IDS) {
    await page.locator(`[data-mv-region="${regionId}"]`).click();
    await page.waitForSelector('[data-mv-session]', { timeout: 10000 });
    if (regionId === REGION_IDS[0]) {
      await page.click('[data-mv-flip]');
      const card = await page.evaluate(() => {
        const back = document.querySelector('.mv-card-back');
        const image = back?.querySelector('.mv-card-back-art img');
        return {
          hasArt: !!back?.querySelector('.mv-card-back-art'),
          hasCopy: !!back?.querySelector('.mv-card-back-copy'),
          desktopColumns: getComputedStyle(back).gridTemplateColumns,
          imageWidth: image?.naturalWidth || 0,
          text: back?.innerText || ''
        };
      });
      assert.equal(card.hasArt, true, 'card back should always include an art panel');
      assert.equal(card.hasCopy, true, 'card back should include a copy panel');
      assert.equal(card.imageWidth > 0, true, 'card back fallback or generated image should load');
      assert.match(card.desktopColumns, /\s/);
      assert.match(card.text, /中文释义|短语|场景句/);
      await page.click('.mv-card-back[data-mv-flip]');
      await page.setViewportSize({ width: 390, height: 844 });
      const mobile = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, display: getComputedStyle(document.querySelector('.mv-card-back')).display }));
      assert.equal(mobile.overflow, false, 'mobile card should not overflow horizontally');
      assert.equal(mobile.display, 'flex', 'mobile card back should collapse to one column');
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await finishCards();
    const battle = await page.evaluate(() => ({ text: document.querySelector('[data-mv-battle-panel]')?.innerText || '', bg: getComputedStyle(document.querySelector('[data-mv-battle-panel]')).backgroundImage }));
    assert.match(battle.text, /Start Battle|开始战斗/);
    assert.match(battle.text, /VS/);
    assert.match(battle.bg, /minecraft-expedition|grassland-trail|village-gate|deep-mine|nether-portal|ender-dragon-arena/);
    await page.click('[data-mv-battle]');
    await page.waitForSelector('[data-mv-complete]', { timeout: 10000 });
    const state = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(item => item.startsWith('petbank_minecraft_expedition_state_v2_'));
      return key ? JSON.parse(localStorage.getItem(key)) : null;
    });
    assert.equal(state.regions[regionId], 'cleared', `${regionId} should be cleared after battle`);
    assert.equal(state.experience > 0, true, `${regionId} should add experience`);
    assert.equal(state.inventory.length >= snapshots.length + 1, true, `${regionId} should add an item`);
    snapshots.push({ regionId, experience: state.experience, level: state.level, inventory: state.inventory });
    if (regionId !== REGION_IDS.at(-1)) {
      await page.click('[data-mv-return-camp]');
      await page.waitForSelector('[data-mv-region]', { timeout: 10000 });
      const nextIndex = REGION_IDS.indexOf(regionId) + 1;
      assert.equal(await page.locator(`[data-mv-region="${REGION_IDS[nextIndex]}"]:not([disabled])`).count(), 1, `${REGION_IDS[nextIndex]} should unlock`);
    }
  }

  const finalState = snapshots.at(-1);
  assert.equal(finalState.regionId, 'ender-dragon-arena');
  assert.equal(finalState.inventory.length, 5, 'final route should collect five items');
  const completeText = await page.locator('[data-mv-complete]').innerText();
  assert.match(completeText, /战斗胜利|远征完成|经验/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', regions: snapshots }, null, 2));
} finally {
  await browser.close();
}
