import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:9077/';
const desktopShot = 'docs/releases/travel-memory-assets-desktop.png';
const mobileShot = 'docs/releases/travel-memory-assets-mobile.png';

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

async function inspect(page, pageName, selector, assetSelector) {
  await waitForTravelPage(page, pageName, selector);
  const result = await page.evaluate((target) => {
    const root = document.querySelector(target);
    const images = Array.from(root?.querySelectorAll('img') || []);
    return {
      collectionVisible: Boolean(root && root.offsetParent !== null),
      cardCount: root?.querySelectorAll('article').length || 0,
      assetCount: images.filter((image) => image.complete && image.naturalWidth > 0).length,
      assetWidths: images.map((image) => image.naturalWidth),
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      cssLoaded: Array.from(document.styleSheets).some((sheet) => sheet.href?.includes('travel-memory.css'))
    };
  }, assetSelector);
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
    await window.TravelMemory.load();
    ['forest', 'beach', 'stargarden'].forEach((sceneId) => window.TravelMemory.record({ sceneId }));
  });
  const desktopHome = await inspect(page, 'home', '#home-container', '.travel-memory-collection');
  await page.screenshot({ path: desktopShot, fullPage: true });
  const desktopCard = await inspect(page, 'card', '#card-collection-container', '.travel-memory-gallery');
  assert.equal(desktopHome.bodyWidth <= desktopHome.viewportWidth, true);
  assert.equal(desktopCard.bodyWidth <= desktopCard.viewportWidth, true);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHome = await inspect(page, 'home', '#home-container', '.travel-memory-collection');
  await page.screenshot({ path: mobileShot, fullPage: true });
  const mobileCard = await inspect(page, 'card', '#card-collection-container', '.travel-memory-gallery');
  assert.equal(mobileHome.bodyWidth <= mobileHome.viewportWidth, true);
  assert.equal(mobileCard.bodyWidth <= mobileCard.viewportWidth, true);
  assert.deepEqual(errors, [], 'browser console errors');
  console.log(JSON.stringify({ desktopHome, desktopCard, mobileHome, mobileCard, errors }));
} finally {
  await browser.close();
}
