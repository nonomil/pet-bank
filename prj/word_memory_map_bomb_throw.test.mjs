import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const PROTOTYPE_URL = process.env.WORD_MEMORY_MAP_URL
  || 'http://127.0.0.1:8000/prj/%E5%8D%95%E8%AF%8D%E8%AE%B0%E5%BF%86%E5%B0%84%E5%87%BB%E5%9C%BA%E5%8E%9F%E5%9E%8B/index.html';

async function openPage() {
  const browser = await chromium.launch(browserLaunchOpts());
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1
  });

  await page.addInitScript(() => {
    class MockAudio {
      constructor(src = '') {
        this._src = src;
        this.onended = null;
        this.onerror = null;
      }

      set src(value) {
        this._src = value;
      }

      get src() {
        return this._src;
      }

      play() {
        if (typeof this.onended === 'function') {
          window.setTimeout(() => this.onended(), 0);
        }
        return Promise.resolve();
      }

      pause() {}
    }

    Object.defineProperty(window, 'Audio', {
      value: MockAudio,
      configurable: true
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel() {},
        speak() {}
      },
      configurable: true
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: function SpeechSynthesisUtterance(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
      },
      configurable: true
    });
  });

  await page.goto(`${PROTOTYPE_URL}?bomb-throw=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero-sprite');
  await page.waitForSelector('[data-orb-id]');
  await page.waitForTimeout(320);
  return { browser, page };
}

async function moveHeroToOrb(page, orbId) {
  for (let step = 0; step < 70; step += 1) {
    const state = await page.evaluate((id) => {
      const hero = document.querySelector('.hero-unit')?.getBoundingClientRect();
      const orb = document.querySelector(`[data-orb-id="${id}"]`)?.getBoundingClientRect();
      const carrying = Boolean(document.querySelector('.hero-carry-orb'));
      if (carrying || !orb) {
        return { picked: true, dx: 0, dy: 0 };
      }
      if (!hero) {
        return { picked: false, dx: 0, dy: 0 };
      }
      const heroCenter = { x: hero.left + hero.width / 2, y: hero.top + hero.height / 2 };
      const orbCenter = { x: orb.left + orb.width / 2, y: orb.top + orb.height / 2 };
      return {
        picked: false,
        dx: orbCenter.x - heroCenter.x,
        dy: orbCenter.y - heroCenter.y
      };
    }, orbId);

    if (state.picked) {
      return;
    }

    const key = Math.abs(state.dx) > Math.abs(state.dy)
      ? (state.dx < 0 ? 'ArrowLeft' : 'ArrowRight')
      : (state.dy < 0 ? 'ArrowUp' : 'ArrowDown');
    await page.keyboard.down(key);
    await page.waitForTimeout(120);
    await page.keyboard.up(key);
    await page.waitForTimeout(24);
  }

  throw new Error(`failed to move hero to ${orbId}`);
}

async function firstVisibleId(page, selector, attr) {
  const value = await page.evaluate(({ selector: query, attr: attribute }) => {
    const nodes = [...document.querySelectorAll(query)];
    const viewport = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };
    const visible = nodes.find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.right > viewport.left
        && rect.left < viewport.right
        && rect.bottom > viewport.top
        && rect.top < viewport.bottom;
    });
    return visible?.getAttribute(attribute) || '';
  }, { selector, attr });
  assert.ok(value, `expected a visible element for ${selector}`);
  return value;
}

{
  const { browser, page } = await openPage();
  const orbId = await firstVisibleId(page, '[data-orb-id]', 'data-orb-id');
  const orb = page.locator(`[data-orb-id="${orbId}"]`);

  await orb.click({ force: true });
  await page.waitForTimeout(120);
  assert.equal(await page.locator('.hero-carry-orb').count(), 1, 'clicking a map bomb should pick it up immediately');
  assert.equal(await page.locator(`[data-orb-id="${orbId}"]`).count(), 0, 'a carried bomb should leave the map layer');

  const targetId = `target-${orbId.replace(/^orb-/, '')}`;
  const scoreBefore = Number(await page.locator('#scoreText').textContent());
  await page.locator(`[data-target-id="${targetId}"]`).click({ force: true });
  await page.waitForFunction(({ id, score }) => {
    const targetGone = !document.querySelector(`[data-target-id="${id}"]`);
    const nextScore = Number(document.querySelector('#scoreText')?.textContent || 0);
    return targetGone && nextScore > score;
  }, { id: targetId, score: scoreBefore }, { timeout: 1800 });

  const nextOrbId = await firstVisibleId(page, '[data-orb-id]', 'data-orb-id');
  const nextOrb = page.locator(`[data-orb-id="${nextOrbId}"]`);
  await nextOrb.click({ force: true });
  await page.waitForTimeout(120);
  assert.equal(await page.locator('.hero-carry-orb').count(), 1, 'clicking another bomb should arm the keyboard throw check');

  const heroPoint = await page.locator('.hero-unit').evaluate(element => ({
    x: parseFloat(element.style.left),
    y: parseFloat(element.style.top)
  }));
  const faceKey = heroPoint.x > 50 ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(faceKey);
  await page.waitForTimeout(72);
  await page.keyboard.up(faceKey);
  await page.keyboard.press('Space');
  await page.waitForSelector('.shot');
  const firstShotPoint = await page.locator('.shot').first().evaluate(element => ({
    x: parseFloat(element.style.left),
    y: parseFloat(element.style.top)
  }));
  assert.ok(Number.isFinite(firstShotPoint.x) && Number.isFinite(firstShotPoint.y), 'pressing Space should launch a visible bomb projectile');
  assert.equal(await page.locator('.hero-carry-orb').count(), 0, 'throwing should remove the carried bomb from the hero');

  await page.waitForFunction((start) => {
    const shot = document.querySelector('.shot');
    if (!shot) {
      return false;
    }
    const point = {
      x: parseFloat(shot.style.left),
      y: parseFloat(shot.style.top)
    };
    return Math.abs(point.x - start.x) > 2 || Math.abs(point.y - start.y) > 2;
  }, firstShotPoint, { timeout: 700 });
  const movedShotPoint = await page.locator('.shot').first().evaluate(element => ({
    x: parseFloat(element.style.left),
    y: parseFloat(element.style.top)
  })).catch(() => null);
  assert.ok(movedShotPoint, 'the thrown bomb should remain visible long enough to read its trajectory');
  assert.ok(
    Math.abs(movedShotPoint.x - firstShotPoint.x) > 2 || Math.abs(movedShotPoint.y - firstShotPoint.y) > 2,
    'the thrown bomb should move continuously after launch'
  );

  await browser.close();
}

console.log('PASS - word memory map bomb throw');
