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
    Object.keys(localStorage).filter(key => key.startsWith('petbank_minecraft_vocab_level_v1_')).forEach(key => localStorage.removeItem(key));
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
    } else if (await page.locator('[data-mv-choice]').count()) {
      const choice = page.locator('[data-mv-choice]').first();
      assert.equal(await choice.count(), 1, 'question card should expose an answer choice');
      await choice.click();
    } else {
      const flip = page.locator('[data-mv-flip]').first();
      assert.equal(await flip.count(), 1, 'new card should expose a flip target');
      await flip.click();
      await page.waitForFunction(() => document.querySelector('[data-mv-flip-card]')?.classList.contains('is-flipped'));
      await page.locator('[data-mv-self-assess="known"]').click();
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
    const progressSidebar = document.querySelector('.mv-progress-sidebar');
    return {
      nodes: document.querySelectorAll('[data-mv-region]').length,
      enabled: document.querySelectorAll('[data-mv-region]:not([disabled])').length,
      title: document.querySelector('[data-mv-region="grassland-trail"]')?.innerText || '',
      campTitle: document.querySelector('#mvCampMapTitle')?.innerText || '',
      todayStatus: progressSidebar?.querySelector('.mv-sidebar-kicker')?.innerText || '',
      todayProgress: progressSidebar?.querySelector('.mv-progress-count')?.innerText || '',
      todayPercent: progressSidebar?.querySelector('.mv-progress-meter')?.innerText || '',
      mapWidth: mapImage?.naturalWidth || 0,
      mapSrc: mapImage?.getAttribute('src') || ''
    };
  });
  assert.equal(home.nodes, 5, 'five story map regions should render');
  assert.equal(home.enabled, 1, 'only the first region should start unlocked');
  assert.match(home.title, /草原小径|Grassland Trail/);
  assert.match(home.campTitle, /方块营地|Block Camp/);
  assert.match(home.todayStatus, /今日远征/);
  assert.match(home.todayProgress, /0\s*\/\s*11\s*张卡片/);
  assert.match(home.todayPercent, /0%/);
  assert.equal(home.mapWidth > 0, true, 'expedition map image should load');
  assert.match(home.mapSrc, /minecraft-expedition\/expedition-map\.png/);

  const kindergarten = await page.evaluate(async () => {
    const levels = window.MinecraftVocabLevels;
    const module = await window.MinecraftVocabLoader.loadForSelection('kindergarten');
    const response = await fetch('data/learn/minecraft-expedition/camp-regions.json');
    if (!response.ok) throw new Error(`expedition data request failed: ${response.status}`);
    const pack = await response.json();
    const selected = levels.get('kindergarten');
    const advancedRegions = pack.regions.filter(region => (levels.get(region.minVocabLevel)?.rank || 0) > selected.rank);
    const advancedRegionStates = advancedRegions.map(region => {
      const button = document.querySelector(`[data-mv-region="${region.id}"]`);
      return {
        id: region.id,
        minVocabLevel: region.minVocabLevel,
        disabled: !!button?.disabled,
        levelLocked: button?.classList.contains('is-level-locked') || false
      };
    });
    const filteredCards = levels.filterCards(module.cards, 'kindergarten');
    const cardsById = new Map(module.cards.map(card => [card.id, card]));
    const sessionKey = Object.keys(localStorage).find(key => key.startsWith('petbank_minecraft_vocab_session_v1_'));
    const session = sessionKey ? JSON.parse(localStorage.getItem(sessionKey)) : null;
    const queue = (session?.queue || []).map(task => task.cardId);
    const queueAdvancedCards = queue.filter(cardId => {
      const card = cardsById.get(cardId);
      const cardLevel = levels.get(levels.cardLevel(card));
      return !cardLevel || cardLevel.rank > selected.rank;
    });
    return {
      selectedLevel: document.querySelector('[data-mv-level="kindergarten"]')?.getAttribute('aria-checked') || '',
      advancedRegionStates,
      queue,
      queueUsesFilteredPool: queue.every(cardId => filteredCards.some(card => card.id === cardId)),
      queueAdvancedCards
    };
  });
  assert.equal(kindergarten.selectedLevel, 'true', 'the default level should be kindergarten');
  assert.ok(kindergarten.advancedRegionStates.length > 0, 'kindergarten must have higher-level expedition regions to guard');
  assert.equal(kindergarten.advancedRegionStates.every(region => region.disabled && region.levelLocked), true, 'higher-level regions must be disabled in kindergarten');
  assert.equal(kindergarten.queueUsesFilteredPool, true, 'the default queue must use kindergarten-filtered cards');
  assert.deepEqual(kindergarten.queueAdvancedCards, [], 'the default queue must not select cards above kindergarten');

  await page.click('[data-mv-level="all"]');
  await page.waitForFunction(() => document.querySelector('[data-mv-level="all"]')?.getAttribute('aria-checked') === 'true');

  const snapshots = [];
  for (const regionId of REGION_IDS) {
    await page.locator(`[data-mv-region="${regionId}"]`).click();
    await page.waitForSelector('[data-mv-story]', { timeout: 10000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-mv-story-image]');
      return !!image && image.complete && image.naturalWidth > 0;
    }, { timeout: 15000 });
    const story = await page.evaluate(async regionId => {
      const root = document.querySelector('#minecraft-vocab-root');
      const image = root?.querySelector('[data-mv-story-image]');
      const response = await fetch('data/learn/minecraft-expedition/camp-regions.json');
      if (!response.ok) throw new Error(`expedition data request failed: ${response.status}`);
      const pack = await response.json();
      const region = pack.regions.find(item => item.id === regionId);
      const module = await window.MinecraftVocabLoader.loadForSelection('all');
      const cardsById = new Map(module.cards.map(card => [card.id, card]));
      const targetCards = (region?.mission?.cardIds || []).map(cardId => cardsById.get(cardId));
      return {
        beats: root?.querySelectorAll('.mv-story-beat').length || 0,
        hasBilingual: !!root?.querySelector('.mv-story-intro strong') && !!root?.querySelector('.mv-story-intro p') && root?.querySelectorAll('.mv-story-beat p.is-en').length >= 3,
        previewCards: root?.querySelectorAll('.mv-story-card-chip').length || 0,
        missionCardIds: region?.mission?.cardIds || [],
        targetWords: targetCards.map(card => card?.word || ''),
        previewWords: [...(root?.querySelectorAll('.mv-story-card-chip strong') || [])].map(node => node.innerText.trim()),
        imageWidth: image?.naturalWidth || 0,
        study: !!root?.querySelector('[data-mv-story-study]')
      };
    }, regionId);
    assert.equal(story.beats >= 3, true, `${regionId} should show story beats`);
    assert.equal(story.hasBilingual, true, `${regionId} should show bilingual story text`);
    assert.equal(story.previewCards, story.missionCardIds.length, `${regionId} story should preview only its bound cards`);
    assert.equal(story.targetWords.includes(''), false, `${regionId} mission cards should resolve to vocabulary cards`);
    assert.deepEqual(story.previewWords, story.targetWords, `${regionId} story preview should match mission.cardIds in order`);
    assert.equal(story.imageWidth > 0, true, `${regionId} story image should load`);
    assert.equal(story.study, true, `${regionId} should link story to vocabulary study`);
    if (regionId === REGION_IDS[0]) {
      await page.screenshot({ path: 'tmp/minecraft-expedition-story-1280.png', fullPage: true });
      for (const width of [320, 375, 768]) {
        await page.setViewportSize({ width, height: 844 });
        const storyMobile = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          beats: document.querySelectorAll('.mv-story-beat').length
        }));
        assert.equal(storyMobile.overflow, false, `story page should not overflow at ${width}px`);
        assert.equal(storyMobile.beats >= 3, true, `story page should keep all beats at ${width}px`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'tmp/minecraft-expedition-story-390.png', fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      const storyDesktop = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      }));
      assert.equal(storyDesktop.overflow, false, 'story page should not overflow at 1280px');
    }
    await page.click('[data-mv-story-study]');
    await page.waitForSelector('[data-mv-session]', { timeout: 10000 });
    if (regionId === REGION_IDS[0]) {
      const lowAgeSession = await page.evaluate(() => ({
        hasAudio: document.querySelectorAll('[data-mv-listen]').length > 0,
        hasImage: (document.querySelector('[data-mv-card-image]')?.naturalWidth || 0) > 0
      }));
      assert.equal(lowAgeSession.hasAudio, true, 'low-age cards should expose audio controls');
      assert.equal(lowAgeSession.hasImage, true, 'low-age cards should expose a real image');
    }
    const sessionBinding = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(item => item.startsWith('petbank_minecraft_vocab_session_'));
      const value = key ? JSON.parse(localStorage.getItem(key)) : null;
      return { regionId: value?.regionId || '', queue: (value?.queue || []).map(task => task.cardId) };
    });
    assert.equal(sessionBinding.regionId, regionId, `${regionId} session should retain the story region`);
    assert.deepEqual(new Set(sessionBinding.queue), new Set(REGION_CARD_IDS[regionId]), `${regionId} session should load only bound cards`);
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
      assert.equal(await page.locator(`[data-mv-region="${regionId}"].is-cleared`).count(), 1, `${regionId} should remain cleared in camp`);
    }
  }

  const finalState = snapshots.at(-1);
  assert.equal(finalState.regionId, 'ender-dragon-arena');
  assert.equal(finalState.inventory.length, 5, 'final route should collect five items');
  const completeText = await page.locator('[data-mv-complete]').innerText();
  assert.match(completeText, /战斗胜利|远征完成|经验/);
  await page.click('[data-mv-return-camp]');
  await page.waitForSelector('[data-mv-region]', { timeout: 10000 });
  assert.equal(await page.locator('.mv-region-node.is-cleared').count(), REGION_IDS.length, 'camp should retain all cleared regions after the final complete screen');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', regions: snapshots }, null, 2));
} finally {
  await browser.close();
}
