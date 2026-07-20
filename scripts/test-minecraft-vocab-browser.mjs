import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || process.env.MMWG_E2E_BASE_URL || 'http://127.0.0.1:7000';
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
const minecraftDataRequests = [];
page.on('pageerror', error => errors.push(String(error?.message || error)));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('request', request => {
  const url = request.url();
  if (url.includes('/data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab')) {
    minecraftDataRequests.push(url);
  }
});

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });
  await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
  await page.evaluate(() => window.switchPage('learn', { skipAccessGate: true }));
  await page.waitForFunction(() => document.querySelector('#page-learn.active .learn-shell'), { timeout: 15000 });
  await page.waitForSelector('#page-learn.active [data-minecraft-vocab-launch], #page-learn.active .learn-demo-resource-card-words button', { timeout: 15000 });
  const learnEntry = await page.evaluate(() => {
    const root = document.querySelector('#page-learn.active');
    const direct = root?.querySelector('[data-minecraft-vocab-launch]');
    const resource = root?.querySelector('.learn-demo-resource-card-words button');
    return {
      text: root?.innerText || '',
      direct: !!(direct || resource),
      label: (direct || resource)?.textContent?.trim() || ''
    };
  });
  assert.match(learnEntry.text, /单词远征/);
  assert.equal(learnEntry.direct, true);
  assert.match(learnEntry.label, /开始|进入|单词/);
  await page.locator('[data-minecraft-vocab-launch], .learn-demo-resource-card-words button').first().click();
  await page.waitForFunction(() => document.querySelector('#page-minecraft-vocab.active [data-minecraft-vocab-page]'), { timeout: 15000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('#minecraft-vocab-root .mv-hero-companion');
    return !!image && image.complete && image.naturalWidth > 0;
  }, { timeout: 15000 });
  await page.evaluate(() => {
    Object.keys(localStorage).filter(key => key.includes('minecraft_vocab_session')).forEach(key => localStorage.removeItem(key));
    Object.keys(localStorage).filter(key => key.includes('learning_vocab_progress')).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('petbank_game_reward_receipts_v1');
    localStorage.removeItem('petbank_core_reward_receipts_v1');
    localStorage.setItem('petbank_points', '0');
    window.EnglishVocabProgress?.reset?.();
    return window.switchPage('minecraft-vocab');
  });
  await page.waitForFunction(() => document.querySelector('#page-minecraft-vocab.active [data-minecraft-vocab-page]'), { timeout: 15000 });

  const home = await page.evaluate(() => {
    const root = document.querySelector('#minecraft-vocab-root');
    const hero = root?.querySelector('[data-mv-hero]');
    const pageRoot = root?.querySelector('[data-minecraft-vocab-page]');
    return {
      text: root?.innerText || '',
      stageCount: root?.querySelectorAll('.mv-sidebar-stages li').length || 0,
      taskCount: root?.querySelectorAll('.mv-progress-count').length || 0,
      heroBg: hero ? getComputedStyle(hero).backgroundImage : '',
      cardFrame: pageRoot ? getComputedStyle(pageRoot).getPropertyValue('--mv-card-frame') : '',
      start: !!root?.querySelector('[data-mv-start]'),
      companion: root?.querySelector('.mv-hero-companion')?.naturalWidth || 0,
      stageBadges: root?.querySelectorAll('.mv-sidebar-stage-icon').length || 0
    };
  });
  assert.match(home.text, /Minecraft 单词远征|方块营地|今日远征/);
  assert.match(home.text, /今日远征/);
  assert.equal(home.stageCount, 4);
  assert.equal(home.taskCount, 1);
  assert.match(home.heroBg, /study-camp-hero\.png/);
  assert.match(home.cardFrame, /card-frame-sheet\.png/);
  assert.equal(home.start, true);
  assert.equal(home.companion > 0, true);
  assert.equal(home.stageBadges, 4);
  assert.equal(await page.locator('.mv-level-option').count(), 5);
  assert.match(home.text, /幼儿园/);
  assert.equal(minecraftDataRequests.some(url => url.endsWith('/minecraft-vocab.json')), false);
  assert.equal(minecraftDataRequests.some(url => url.includes('minecraft-vocab-runtime-starter.json')), true);
  await page.click('[data-mv-level="bridge"]');
  await page.waitForFunction(() => document.querySelector('[data-mv-level="bridge"]')?.getAttribute('aria-checked') === 'true');
  const bridgeSelection = await page.evaluate(() => ({
    stored: Object.entries(localStorage).find(([key]) => key.startsWith('petbank_minecraft_vocab_level_v1_'))?.[1] || '',
    selected: document.querySelector('[data-mv-level="bridge"]')?.getAttribute('aria-checked') || '',
    deepMineLocked: document.querySelector('[data-mv-region="deep-mine"]')?.disabled || false,
    netherLocked: document.querySelector('[data-mv-region="nether-portal"]')?.disabled || false
  }));
  assert.equal(bridgeSelection.stored, 'bridge');
  assert.equal(bridgeSelection.selected, 'true');
  assert.equal(bridgeSelection.deepMineLocked, true);
  assert.equal(bridgeSelection.netherLocked, true);
  await page.click('[data-mv-level="kindergarten"]');
  await page.waitForFunction(() => document.querySelector('[data-mv-level="kindergarten"]')?.getAttribute('aria-checked') === 'true');
  await page.click('[data-mv-level="minecraft"]');
  await page.waitForFunction(() => document.querySelector('[data-mv-level="minecraft"]')?.getAttribute('aria-checked') === 'true' && document.querySelectorAll('[data-mv-band]').length === 6);
  const minecraftBandSelection = await page.evaluate(() => ({
    bandCount: document.querySelectorAll('[data-mv-band]').length,
    selected: document.querySelector('[data-mv-band="minecraft-core"]')?.getAttribute('aria-checked') || '',
    stored: Object.entries(localStorage).find(([key]) => key.startsWith('petbank_minecraft_vocab_band_v1_'))?.[1] || '',
    hasCoreCount: document.querySelector('#minecraft-vocab-root')?.innerText.includes('123 张') || false
  }));
  assert.equal(minecraftBandSelection.bandCount, 6);
  assert.equal(minecraftBandSelection.selected, 'true');
  assert.equal(minecraftBandSelection.stored, 'minecraft-core');
  assert.equal(minecraftBandSelection.hasCoreCount, true);
  assert.equal(minecraftDataRequests.some(url => url.includes('minecraft-vocab-runtime-minecraft-core.json')), true);
  await page.click('[data-mv-band="minecraft-advanced"]');
  await page.waitForFunction(() => document.querySelector('[data-mv-band="minecraft-advanced"]')?.getAttribute('aria-checked') === 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem([...Object.keys(localStorage)].find(key => key.startsWith('petbank_minecraft_vocab_band_v1_')) || '')), 'minecraft-advanced');
  assert.equal(minecraftDataRequests.some(url => url.includes('minecraft-vocab-runtime-minecraft-advanced.json')), true);
  await page.click('[data-mv-level="kindergarten"]');
  await page.waitForFunction(() => document.querySelector('[data-mv-level="kindergarten"]')?.getAttribute('aria-checked') === 'true');
  assert.equal(await page.locator('[data-mv-open-review]').count(), 1);
  await page.screenshot({ path: 'tmp/minecraft-vocab-home-gpt-ui-1280.png', fullPage: true });

  await page.click('[data-mv-start]');
  await page.waitForSelector('#minecraft-vocab-root [data-mv-session]', { timeout: 10000 });
  const session = await page.evaluate(() => {
    const root = document.querySelector('#minecraft-vocab-root');
    return {
      text: root?.innerText || '',
      audio: !!root?.querySelector('[data-mv-listen]'),
      audioKeys: [...new Set((root ? [...root.querySelectorAll('[data-mv-listen]')] : []).map(button => button.dataset.mvListen))],
      flip: !!root?.querySelector('[data-mv-flip]'),
      sidebar: !!root?.querySelector('.mv-session-layout .mv-progress-sidebar'),
      progressToggle: !!root?.querySelector('[data-mv-toggle-progress]'),
      detailsPanel: !!root?.querySelector('[data-mv-progress-panel]'),
      upcomingVisible: root?.querySelector('.mv-upcoming-cards') ? getComputedStyle(root.querySelector('.mv-upcoming-cards')).display !== 'none' : false,
      phrase: root?.querySelector('.mv-card-detail-block.is-phrase')?.textContent || '',
      sentence: root?.querySelector('.mv-card-detail-block.is-sentence')?.textContent || '',
      actionCount: root?.querySelectorAll('[data-mv-answer], [data-mv-self-assess]').length || 0,
      gradeButtons: root ? [...root.querySelectorAll('[data-mv-grade]')].map(button => button.dataset.mvGrade) : [],
      hintButtonCount: root?.querySelectorAll('[data-mv-hint]').length || 0,
      cornerCount: root?.querySelectorAll('.mv-card-corner').length || 0,
      taskMode: root?.querySelector('[data-mv-session]')?.dataset.mvMode || '',
      sessionBg: getComputedStyle(root?.querySelector('[data-mv-session]')).backgroundImage,
      cardImage: root?.querySelector('[data-mv-card-image]')?.getAttribute('src') || '',
      cardImageWidth: root?.querySelector('[data-mv-card-image]')?.naturalWidth || 0,
      cardArtSize: Math.round(root?.querySelector('[data-mv-card-art]')?.getBoundingClientRect().width || 0),
      cardObjectFit: root?.querySelector('[data-mv-card-image]') ? getComputedStyle(root.querySelector('[data-mv-card-image]')).objectFit : '',
      shellDisplay: getComputedStyle(document.querySelector('.page-shell')).display,
      primarySidebarDisplay: getComputedStyle(document.querySelector('#childPrimarySidebar')).display,
      progressRailDisplay: getComputedStyle(document.querySelector('#childProgressRail')).display,
      learningWidth: Math.round(root?.querySelector('.mv-learning-column')?.getBoundingClientRect().width || 0),
      cardBackWidth: Math.round(root?.querySelector('.mv-card-back')?.getBoundingClientRect().width || 0)
    };
  });
  assert.match(session.text, /第 1\/11|1 \/ 11/);
  assert.equal(session.audio, true);
  assert.deepEqual(session.audioKeys.sort(), ['phrase', 'phraseTranslation', 'sentence', 'sentenceTranslation', 'translation', 'word'].sort());
  assert.equal(session.flip, true);
  assert.equal(session.sidebar, false);
  assert.equal(session.progressToggle, true);
  assert.equal(session.detailsPanel, false);
  assert.equal(session.upcomingVisible, false);
  assert.match(session.phrase, /短语/);
  assert.match(session.sentence, /场景句/);
  assert.equal(session.actionCount, 0);
  assert.deepEqual(session.gradeButtons, []);
  assert.equal(session.cornerCount, 0);
  assert.equal(session.cardObjectFit, 'contain');
  assert.equal(session.cardArtSize > 280, true);
  assert.equal(session.taskMode, 'review');
  assert.match(session.sessionBg, /warmup-grove\.png/);
  assert.match(session.cardImage, /(?:assets\/learn\/english-vocab\/minecraft-cards\/normalized\/card-\d{4}-|assets\/learn\/english-vocab\/minecraft-cards\/card-\d{3}-|prj\/anki-minecraft-vocab\/assets\/media\/)/);
  assert.equal(session.cardImageWidth > 0, true);
  assert.equal(session.shellDisplay, 'block');
  assert.equal(session.primarySidebarDisplay, 'none');
  assert.equal(session.progressRailDisplay, 'none');
  assert.equal(session.learningWidth > 900, true);
  assert.equal(session.cardBackWidth > 900, true);
  await page.click('[data-mv-toggle-progress]');
  await page.waitForSelector('[data-mv-progress-panel][data-open="true"]');
  const expandedProgress = await page.evaluate(() => ({
    panel: getComputedStyle(document.querySelector('[data-mv-progress-panel]')).display,
    stages: document.querySelectorAll('[data-mv-progress-panel] .mv-sidebar-stages li').length,
    upcoming: document.querySelector('.mv-upcoming-cards') ? getComputedStyle(document.querySelector('.mv-upcoming-cards')).display !== 'none' : false
  }));
  assert.notEqual(expandedProgress.panel, 'none');
  assert.equal(expandedProgress.stages, 4);
  assert.equal(expandedProgress.upcoming, false);
  await page.click('[data-mv-flip]');
  await page.waitForFunction(() => document.querySelector('[data-mv-flip-card]')?.classList.contains('is-flipped'));
  const flipped = await page.evaluate(() => ({
    isFlipped: document.querySelector('[data-mv-flip-card]')?.classList.contains('is-flipped') || false,
    backText: document.querySelector('.mv-card-back')?.textContent || '',
    gradeButtons: [...document.querySelectorAll('[data-mv-grade]')].map(button => button.dataset.mvGrade)
  }));
  assert.equal(flipped.isFlipped, true);
  assert.match(flipped.backText, /短语|场景句/);
  assert.deepEqual(flipped.gradeButtons, ['again', 'hard', 'good', 'easy']);
  await page.screenshot({ path: 'tmp/minecraft-vocab-card-back-1280.png', fullPage: true });

  await page.click('[data-mv-self-assess="known"]');
  await page.waitForTimeout(120);
  const afterOne = await page.evaluate(() => document.querySelector('[data-mv-progress]')?.textContent || '');
  assert.match(afterOne, /1\s*\/\s*11/);
  const firstReviewEvent = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(item => item.startsWith('petbank_learning_vocab_review_events_'));
    const events = key ? JSON.parse(localStorage.getItem(key) || '[]') : [];
    const state = window.MinecraftVocabSession.readState();
    return { event: events[events.length - 1] || null, sessionId: state?.sessionId || '' };
  });
  assert.equal(typeof firstReviewEvent.event?.reviewId, 'string');
  assert.equal(firstReviewEvent.event?.responseMode, 'review');
  assert.equal(firstReviewEvent.event?.responseMs > 0, true);
  assert.equal(firstReviewEvent.sessionId.length > 0, true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => {
    const bar = document.querySelector('[data-mv-mobile-actions]');
    const rect = bar?.getBoundingClientRect();
    return {
      width: Math.round(rect?.width || 0),
      fixed: bar ? getComputedStyle(bar).position : '',
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
  });
  assert.equal(mobile.fixed, 'sticky');
  assert.equal(mobile.width > 300, true);
  assert.equal(mobile.horizontalOverflow, false);
  await page.setViewportSize({ width: 1280, height: 900 });

  for (let index = 0; index < 10; index += 1) {
    const taskMode = await page.locator('[data-mv-session]').getAttribute('data-mv-mode');
    if (taskMode === 'recall' || taskMode === 'scene') {
      assert.equal(await page.locator('[data-mv-hint]').count(), 1);
      await page.click('[data-mv-hint]');
      assert.equal(await page.locator('[data-mv-hint-status]').count(), 1);
    }
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-mv-card-image]');
      return !image || image.naturalWidth > 0;
    });
    const cardMedia = await page.evaluate(() => ({
      src: document.querySelector('[data-mv-card-image]')?.getAttribute('src') || '',
      width: document.querySelector('[data-mv-card-image]')?.naturalWidth || 0
    }));
    assert.match(cardMedia.src, /(?:assets\/learn\/english-vocab\/minecraft-cards\/normalized\/card-\d{4}-|assets\/learn\/english-vocab\/minecraft-cards\/card-\d{3}-|prj\/anki-minecraft-vocab\/assets\/media\/)/);
    assert.equal(cardMedia.width > 0, true);
    const selfAssess = page.locator('[data-mv-self-assess="known"]');
    if (await selfAssess.count()) {
      await selfAssess.click();
    } else if (await page.locator('[data-mv-choice]').count()) {
      const choices = await page.evaluate(async () => {
        const state = window.MinecraftVocabSession.readState();
        const levelId = [...Object.keys(localStorage)].find(key => key.startsWith('petbank_minecraft_vocab_level_v1_')) ? localStorage[[...Object.keys(localStorage)].find(key => key.startsWith('petbank_minecraft_vocab_level_v1_'))] : 'kindergarten';
        const bandKey = [...Object.keys(localStorage)].find(key => key.startsWith('petbank_minecraft_vocab_band_v1_'));
        const bandId = bandKey ? localStorage[bandKey] : 'minecraft-core';
        const module = await window.MinecraftVocabLoader.loadForSelection(levelId, bandId);
        const cardId = state?.queue?.find(item => !state.completed.includes(item.cardId))?.cardId;
        const card = module.cards.find(item => item.id === cardId);
        const values = [...document.querySelectorAll('[data-mv-choice]')].map(button => button.dataset.mvChoice);
        return { values, correctIndex: values.indexOf(card?.word) };
      });
      assert.equal(new Set(choices.values).size, choices.values.length);
      assert.equal(choices.correctIndex > 0, true);
      await page.locator('[data-mv-choice]').first().click();
    } else {
      await page.click('[data-mv-flip]');
      await page.waitForFunction(() => document.querySelector('[data-mv-flip-card]')?.classList.contains('is-flipped'));
      await page.locator('[data-mv-self-assess="known"]').click();
    }
    await page.waitForTimeout(80);
  }
  await page.waitForSelector('#minecraft-vocab-root [data-mv-complete]', { timeout: 10000 });
  await page.waitForFunction(() => {
    const root = document.querySelector('#minecraft-vocab-root');
    const chest = root?.querySelector('.mv-reward-chest');
    const star = root?.querySelector('.mv-reward-star');
    return !!chest && !!star && chest.complete && star.complete && chest.naturalWidth > 0 && star.naturalWidth > 0;
  }, { timeout: 15000 });
  const completeVisual = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector('#minecraft-vocab-root [data-mv-complete]')).backgroundImage,
    chest: document.querySelector('#minecraft-vocab-root .mv-reward-chest')?.naturalWidth || 0,
    star: document.querySelector('#minecraft-vocab-root .mv-reward-star')?.naturalWidth || 0
  }));
  assert.match(completeVisual.background, /reward-word-stars\.png/);
  assert.equal(completeVisual.chest > 0, true);
  assert.equal(completeVisual.star > 0, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tmp/minecraft-vocab-complete-gpt-ui-390.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  const pointsAfterComplete = await page.evaluate(() => window.PetBankPoints?.get?.() ?? Number(localStorage.getItem('petbank_points') || 0));
  assert.equal(pointsAfterComplete, 10);

  await page.evaluate(() => window.switchPage('minecraft-vocab'));
  await page.waitForTimeout(300);
  const repeatView = await page.evaluate(() => ({
    complete: !!document.querySelector('#minecraft-vocab-root [data-mv-complete]'),
    points: window.PetBankPoints?.get?.() ?? Number(localStorage.getItem('petbank_points') || 0)
  }));
  assert.equal(repeatView.complete, true);
  assert.equal(repeatView.points, 10);

  await page.evaluate(() => {
    const state = window.MinecraftVocabSession.readState();
    const cardId = state?.queue?.[0]?.cardId;
    window.EnglishVocabProgress.record(cardId, 'again', {
      reviewId: 'browser-due-review',
      now: Date.now() - (60 * 60 * 1000),
      responseMode: 'manual-review',
      responseMs: 2100
    });
  });
  await page.click('[data-mv-open-review]');
  await page.waitForSelector('#minecraft-vocab-root [data-mv-review]');
  const reviewView = await page.evaluate(() => ({
    due: Number(document.querySelector('[data-mv-review-due]')?.textContent || 0),
    dailyCells: document.querySelectorAll('[data-mv-review-day]').length,
    weakCards: document.querySelectorAll('[data-mv-review-weak-card]').length,
    startDisabled: document.querySelector('[data-mv-review-start]')?.hasAttribute('disabled') || false
  }));
  assert.equal(reviewView.due > 0, true);
  assert.equal(reviewView.dailyCells, 7);
  assert.equal(reviewView.weakCards > 0, true);
  assert.equal(reviewView.startDisabled, false);
  await page.screenshot({ path: 'tmp/minecraft-vocab-review-1280.png', fullPage: true });
  await page.click('[data-mv-review-start]');
  await page.waitForSelector('#minecraft-vocab-root [data-mv-session][data-mv-mode="review"]');
  const reviewSession = await page.evaluate(() => window.MinecraftVocabSession.readState());
  assert.equal(reviewSession.sessionType, 'review');
  assert.equal(reviewSession.reviewOnly, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tmp/minecraft-vocab-review-session-390.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  assert.deepEqual(errors, []);
  console.log('minecraft vocab browser: PASS');
} finally {
  await browser.close();
}
