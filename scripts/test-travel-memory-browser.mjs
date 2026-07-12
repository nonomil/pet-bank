import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:9077/';
const artifactDir = path.resolve(process.cwd(), process.env.PETBANK_TEST_ARTIFACT_DIR || 'tmp/test-artifacts/travel-memory-browser');
const desktopShot = path.join(artifactDir, 'travel-card-composition-desktop.png');
const mobileShot = path.join(artifactDir, 'travel-card-composition-mobile.png');

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
      if (attempt < 3) await sleep(250 * attempt);
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTravelPage(page, pageName, selector) {
  await page.evaluate(async (name) => {
    await window.PetBankRuntime.ensurePage(name);
    window.switchPage(name);
  }, pageName);
  await page.waitForFunction((target) => {
    const element = document.querySelector(target);
    return element && element.offsetParent !== null;
  }, selector, { timeout: 20000 });
  await sleep(250);
}

async function inspect(page, pageName, selector, assetSelector, imageSelector = 'img') {
  await waitForTravelPage(page, pageName, selector);
  const result = await page.evaluate(({ assetTarget, imageTarget }) => {
    const root = document.querySelector(assetTarget);
    const images = Array.from(root?.querySelectorAll(imageTarget) || []);
    return {
      collectionVisible: Boolean(root && root.offsetParent !== null),
      cardCount: root?.querySelectorAll('article').length || 0,
      assetCount: images.filter((image) => image.complete && image.naturalWidth > 0).length,
      assetWidths: images.map((image) => image.naturalWidth),
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      cssLoaded: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('travel-memory.css'))
    };
  }, { assetTarget: assetSelector, imageTarget: imageSelector });
  assert.equal(result.collectionVisible, true, `${pageName} collection visible`);
  assert.equal(result.cardCount, 3, `${pageName} card count`);
  assert.equal(result.assetCount, 3, `${pageName} image count`);
  assert.deepEqual(result.assetWidths, [1024, 1024, 1024], `${pageName} image widths`);
  assert.ok(result.bodyWidth <= result.viewportWidth, `${pageName} horizontal overflow`);
  assert.equal(result.cssLoaded, true, `${pageName} travel-memory.css loaded`);
  return result;
}

const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
  if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem, { timeout: 20000 });
  await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('home');
    const species = window.PetSystem.getAllSpecies()[0];
    if (species && !window.PetSystem.getState().species) window.PetSystem.chooseSpecies(species.id);
    await window.PetBankRuntime.ensurePage('card');
    window.switchPage('card');
  });
  await page.waitForFunction(() => document.querySelector('#card-collection-container')?.innerHTML.includes('card-collection-shell'), { timeout: 20000 });
  await sleep(300);
  const collectionBefore = await page.evaluate(() => {
    let pet = null;
    try {
      pet = JSON.parse(localStorage.getItem('petbank_pet') || 'null');
      if (pet) delete pet.last_home_ts;
    } catch {}
    return {
      cards: localStorage.getItem('petbank_cards'),
      awardedSeries: localStorage.getItem('petbank_awarded_series'),
      arenaPoints: localStorage.getItem('arena_points'),
      points: localStorage.getItem('petbank_points'),
      pet
    };
  });
  await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('home');
    await window.TravelMemory.load();
    const species = window.PetSystem.getAllSpecies()[0];
    if (species && !window.PetSystem.getState().species) window.PetSystem.chooseSpecies(species.id);
    const state = window.PetSystem.getState();
    const pet = state.species ? {
      speciesId: state.species,
      name: state.species_data?.name || '测试宠物',
      emoji: state.species_data?.emoji || '🐾',
      image: window.PetSystem.getCurrentStageImage?.() || '',
      stage: state.stage?.name || '成长中'
    } : null;
    ['forest', 'beach', 'stargarden'].forEach((sceneId) => window.TravelMemory.record({ sceneId, pet }));
  });
  const desktopHome = await inspect(page, 'home', '#home-container', '.travel-memory-collection', '.travel-memory-collection-art');
  await captureScreenshot(page, desktopShot, { fullPage: true });
  const desktopCard = await inspect(page, 'card', '#card-collection-container', '.travel-memory-gallery', '.travel-memory-card-bg');
  const desktopComposition = await page.evaluate(() => ({
    cards: document.querySelectorAll('.travel-memory-card-composition').length,
    frames: document.querySelectorAll('.travel-memory-card-frame').length,
    pets: document.querySelectorAll('.travel-memory-card-pet').length,
    backgrounds: document.querySelectorAll('.travel-memory-card-bg').length
  }));
  assert.deepEqual(desktopComposition, { cards: 3, frames: 3, pets: 3, backgrounds: 3 });
  const desktopLayerWidths = await page.evaluate(() => ({
    frames: Array.from(document.querySelectorAll('.travel-memory-card-frame')).map((image) => image.naturalWidth),
    backgrounds: Array.from(document.querySelectorAll('.travel-memory-card-bg')).map((image) => image.naturalWidth),
    pets: Array.from(document.querySelectorAll('.travel-memory-card-pet img')).map((image) => image.naturalWidth)
  }));
  assert.deepEqual(desktopLayerWidths.frames, [1024, 1024, 1024]);
  assert.deepEqual(desktopLayerWidths.backgrounds, [1024, 1024, 1024]);
  assert.ok(desktopLayerWidths.pets.every((width) => width > 0));
  assert.equal(desktopHome.bodyWidth <= desktopHome.viewportWidth, true);
  assert.equal(desktopCard.bodyWidth <= desktopCard.viewportWidth, true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHome = await inspect(page, 'home', '#home-container', '.travel-memory-collection', '.travel-memory-collection-art');
  await captureScreenshot(page, mobileShot, { fullPage: true });
  const mobileCard = await inspect(page, 'card', '#card-collection-container', '.travel-memory-gallery', '.travel-memory-card-bg');
  const mobileComposition = await page.evaluate(() => ({
    cards: document.querySelectorAll('.travel-memory-card-composition').length,
    frames: document.querySelectorAll('.travel-memory-card-frame').length,
    pets: document.querySelectorAll('.travel-memory-card-pet').length,
    backgrounds: document.querySelectorAll('.travel-memory-card-bg').length
  }));
  assert.deepEqual(mobileComposition, { cards: 3, frames: 3, pets: 3, backgrounds: 3 });
  const mobileLayerWidths = await page.evaluate(() => ({
    frames: Array.from(document.querySelectorAll('.travel-memory-card-frame')).map((image) => image.naturalWidth),
    backgrounds: Array.from(document.querySelectorAll('.travel-memory-card-bg')).map((image) => image.naturalWidth),
    pets: Array.from(document.querySelectorAll('.travel-memory-card-pet img')).map((image) => image.naturalWidth)
  }));
  assert.deepEqual(mobileLayerWidths.frames, [1024, 1024, 1024]);
  assert.deepEqual(mobileLayerWidths.backgrounds, [1024, 1024, 1024]);
  assert.ok(mobileLayerWidths.pets.every((width) => width > 0));
  await page.screenshot({ path: mobileShot, fullPage: true });
  assert.equal(mobileHome.bodyWidth <= mobileHome.viewportWidth, true);
  assert.equal(mobileCard.bodyWidth <= mobileCard.viewportWidth, true);
  const collectionAfter = await page.evaluate(() => {
    let pet = null;
    try {
      pet = JSON.parse(localStorage.getItem('petbank_pet') || 'null');
      if (pet) delete pet.last_home_ts;
    } catch {}
    return {
      cards: localStorage.getItem('petbank_cards'),
      awardedSeries: localStorage.getItem('petbank_awarded_series'),
      arenaPoints: localStorage.getItem('arena_points'),
      points: localStorage.getItem('petbank_points'),
      pet
    };
  });
  assert.deepEqual(collectionAfter, collectionBefore, 'travel cards do not mutate progression state');
  assert.deepEqual(errors, [], 'browser console errors');
  console.log(JSON.stringify({ desktopHome, desktopCard, desktopComposition, desktopLayerWidths, mobileHome, mobileCard, mobileComposition, mobileLayerWidths, collectionBefore, collectionAfter, errors }));
} finally {
  await browser.close();
}
