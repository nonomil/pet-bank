import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const results = [];
function check(name, condition, detail = '') {
  const pass = Boolean(condition);
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

const failedRequests = [];
page.on('requestfailed', (request) => {
  failedRequests.push(`${request.url()} -> ${request.failure()?.errorText || 'failed'}`);
});

await page.route('**/data/pets.json', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await route.continue();
});

await page.addInitScript(() => {
  localStorage.clear();
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });

await page.evaluate(() => window.switchPage('card'));
await page.waitForFunction(
  () => document.querySelectorAll('.card-gallery-card').length >= 4,
  { timeout: 20000 }
);

const cardCatalogProbe = await page.evaluate(() => ({
  speciesCount: window.PetSystem?.getAllSpecies?.().length || 0,
  galleryCards: document.querySelectorAll('.card-gallery-card').length,
  galleryCoverSources: Array.from(document.querySelectorAll('.card-gallery-cover-image')).map((img) => img.getAttribute('src') || '')
}));

check(
  'slow pet catalog still renders all four card halls',
  cardCatalogProbe.speciesCount >= 200 && cardCatalogProbe.galleryCards >= 4,
  JSON.stringify(cardCatalogProbe)
);
check(
  'card hall covers use webp assets',
  cardCatalogProbe.galleryCoverSources.length >= 4 && cardCatalogProbe.galleryCoverSources.every((src) => /\.webp(?:$|\?)/i.test(src)),
  cardCatalogProbe.galleryCoverSources.join(', ')
);

await page.evaluate(() => window.CardCollection.showDetail('dog'));
await page.waitForSelector('#cardDetailModal.show .card-detail-stage', { timeout: 10000 });

const detailProbe = await page.evaluate(() => ({
  stageCount: document.querySelectorAll('.card-detail-stage').length,
  clickableStageCount: Array.from(document.querySelectorAll('.card-detail-stage')).filter((el) => (
    el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || typeof el.onclick === 'function'
  )).length
}));

check(
  'card detail stage thumbnails are clickable controls',
  detailProbe.stageCount > 0 && detailProbe.clickableStageCount === detailProbe.stageCount,
  JSON.stringify(detailProbe)
);

await page.click('.card-detail-stage');
await page.waitForSelector('#cardStageLightbox.show img', { timeout: 5000 }).catch(() => {});
const cardStageZoomProbe = await page.evaluate(() => ({
  shown: Boolean(document.querySelector('#cardStageLightbox.show img')),
  src: document.querySelector('#cardStageLightbox.show img')?.getAttribute('src') || ''
}));
check(
  'card detail stage thumbnail opens large image',
  cardStageZoomProbe.shown && /\.webp(?:$|\?)/i.test(cardStageZoomProbe.src),
  JSON.stringify(cardStageZoomProbe)
);

await page.evaluate(() => {
  window.CardCollection.closeDetail();
  window.PetSystem.chooseSpecies('dog');
  window.switchPage('pet');
});
await page.waitForSelector('#petDisplayImg', { timeout: 10000 });
await page.click('#petDisplayImg');
await page.waitForSelector('#petLightbox .pet-lightbox-stage', { timeout: 5000 }).catch(() => {});

const petLightboxProbe = await page.evaluate(() => ({
  open: Boolean(document.getElementById('petLightbox')) && getComputedStyle(document.getElementById('petLightbox')).display !== 'none',
  stages: document.querySelectorAll('#petLightbox .pet-lightbox-stage').length
}));
check(
  'my pet sprite opens multi-stage gallery',
  petLightboxProbe.open && petLightboxProbe.stages >= 4,
  JSON.stringify(petLightboxProbe)
);

if (petLightboxProbe.stages > 0) {
  await page.click('#petLightbox .pet-lightbox-stage');
  await page.waitForSelector('#petStageZoom.show img', { timeout: 5000 }).catch(() => {});
}
const petStageZoomProbe = await page.evaluate(() => ({
  shown: Boolean(document.querySelector('#petStageZoom.show img')),
  src: document.querySelector('#petStageZoom.show img')?.getAttribute('src') || ''
}));
check(
  'my pet stage gallery opens each stage as a large image',
  petStageZoomProbe.shown && /\.webp(?:$|\?)/i.test(petStageZoomProbe.src),
  JSON.stringify(petStageZoomProbe)
);

await page.evaluate(() => {
  window.closeLightbox?.();
  document.getElementById('petStageZoom')?.remove();
  window.switchPage('hanzi');
});
let hanziReady = true;
await page.waitForFunction(() => window.HanziGame && typeof window.HanziGame.start === 'function', { timeout: 15000 })
  .catch(() => { hanziReady = false; });
if (hanziReady) {
  let started = false;
  for (let attempt = 0; attempt < 2 && !started; attempt += 1) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.evaluate(() => window.HanziGame.start());
      started = true;
    } catch (error) {
      if (!/Execution context was destroyed|navigation/i.test(String(error))) throw error;
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 10000 });
      await page.evaluate(() => window.switchPage('hanzi'));
      await page.waitForFunction(() => window.HanziGame && typeof window.HanziGame.start === 'function', { timeout: 15000 });
    }
  }
  hanziReady = started;
  await page.waitForSelector('#hz-overlay .hz-stage', { timeout: 10000 }).catch(() => {});
}

const hanziProbe = await page.evaluate(() => {
  const overlay = document.getElementById('hz-overlay');
  const stage = document.querySelector('#hz-overlay .hz-stage');
  return {
    cssBg: overlay ? getComputedStyle(overlay).getPropertyValue('--hz-bg').trim() : '',
    stageWidth: stage ? Math.round(stage.getBoundingClientRect().width) : 0,
    viewportWidth: window.innerWidth
  };
});

check(
  'hanzi game overlay uses rotating background and wide stage',
  hanziReady && /url\(/i.test(hanziProbe.cssBg) && hanziProbe.stageWidth >= 960,
  JSON.stringify({ hanziReady, ...hanziProbe })
);

await page.evaluate(() => {
  window.HanziGame?._exit?.();
  window.switchPage('home');
});
let homeBgReady = true;
await page.waitForSelector('.home-bg-img', { timeout: 15000 }).catch(() => { homeBgReady = false; });
if (homeBgReady) {
  await page.waitForFunction(() => {
  const img = document.querySelector('.home-bg-img');
  return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 15000 }).catch(() => { homeBgReady = false; });
}

const homeProbe = await page.evaluate(() => {
  const img = document.querySelector('.home-bg-img');
  return {
    src: img?.getAttribute('src') || '',
    naturalWidth: img?.naturalWidth || 0
  };
});
check(
  'pet home background image loads after lazy page activation',
  homeBgReady && homeProbe.naturalWidth > 0 && /\.webp(?:$|\?)/i.test(homeProbe.src),
  JSON.stringify({ homeBgReady, ...homeProbe })
);

check(
  'no missing local runtime image/data requests during alignment flow',
  failedRequests.filter((item) => /127\.0\.0\.1|localhost/i.test(item)).length === 0,
  failedRequests.join(' | ')
);

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
  console.log('FAILURES:', failed.map((item) => item.name).join('; '));
  process.exit(1);
}
