import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const mainUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const learningUrl = process.env.LEARNING_CENTER_URL || 'http://127.0.0.1:7001/';
const miniGamesUrl = process.env.MINI_GAMES_URL || 'http://127.0.0.1:7003/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
});

async function waitForMain(page) {
  await page.goto(mainUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('petbank_points', '0'));
}

const pages = [];
try {
  const host = await context.newPage();
  pages.push(host);
  await waitForMain(host);
  await host.evaluate(() => window.switchPage('learn', { skipAccessGate: true }));
  await host.waitForSelector('#page-learn.active', { timeout: 20000 });
  await host.waitForSelector('#page-learn.active [data-learn-portal-card]', { timeout: 30000 });
  const [learning] = await Promise.all([
    context.waitForEvent('page'),
    host.getByRole('button', { name: '打开独立学习中心' }).click()
  ]);
  pages.push(learning);
  await learning.waitForLoadState('domcontentloaded');
  assert.equal(new URL(learning.url()).origin, new URL(learningUrl).origin);
  assert.match(new URL(learning.url()).hash, /petbankLaunch=[^&]+&petbankProfile=[^&]+/);
  await learning.waitForSelector('[data-game-count], .pack-card', { timeout: 20000 });
  await learning.getByRole('button', { name: '进入资料包' }).first().click();
  await learning.getByRole('button', { name: '开始这一模块' }).first().click();
  await learning.getByRole('button', { name: /完成这一节/ }).click();
  await host.waitForFunction(() => Number(localStorage.getItem('petbank_points') || 0) === 2, { timeout: 20000 });
  const learningState = await learning.evaluate(() => ({
    petbankKeys: Object.keys(localStorage).filter((key) => key.startsWith('petbank_')),
    projectKeys: Object.keys(localStorage).filter((key) => key.startsWith('learncenter_'))
  }));
  assert.deepEqual(learningState.petbankKeys, []);
  assert.ok(learningState.projectKeys.length > 0);
  await learning.close();

  const host2 = await context.newPage();
  pages.push(host2);
  await waitForMain(host2);
  await host2.evaluate(() => window.switchPage('playground', { skipAccessGate: true }));
  await host2.waitForSelector('#page-playground.active', { timeout: 20000 });
  const [miniHub] = await Promise.all([
    context.waitForEvent('page'),
    host2.getByRole('button', { name: /独立小游戏项目/ }).click()
  ]);
  pages.push(miniHub);
  await miniHub.waitForLoadState('domcontentloaded');
  assert.equal(new URL(miniHub.url()).origin, new URL(miniGamesUrl).origin);
  await miniHub.waitForSelector('[data-game-path]', { timeout: 20000 });
  const hubMobile = await miniHub.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
  assert.ok(hubMobile.bodyWidth <= hubMobile.viewportWidth, `hub mobile overflow: ${JSON.stringify(hubMobile)}`);
  const [game] = await Promise.all([
    context.waitForEvent('page'),
    miniHub.getByRole('link', { name: '打开新窗口' }).first().click()
  ]);
  pages.push(game);
  await game.waitForLoadState('domcontentloaded');
  assert.equal(new URL(game.url()).origin, new URL(miniGamesUrl).origin);
  await game.waitForSelector('#runnerScene', { timeout: 20000 });
  await game.locator('#runnerPet').evaluate((element) => {
    if (!element.complete || element.naturalWidth === 0) throw new Error('runner pet image did not load');
  });

  const launchParams = new URLSearchParams(new URL(miniHub.url()).hash.slice(1));
  const launchId = launchParams.get('petbankLaunch');
  const profileRef = launchParams.get('petbankProfile');
  const hostOrigin = new URL(mainUrl).origin;
  const completion = { type: 'petbank.bridge.v1.completed', version: 1, projectId: 'mini-games', launchId, profileRef, activityId: 'hanzi-bubble-runner', completionId: `browser:${launchId}`, occurredAt: new Date().toISOString() };
  await game.evaluate(({ message }) => window.opener.postMessage(message, window.location.origin), { message: completion });
  await host2.waitForFunction(() => Number(localStorage.getItem('petbank_points') || 0) === 3, { timeout: 20000 });
  await game.waitForFunction(() => /奖励已到账|奖励已处理/.test(document.querySelector('#feedback')?.textContent || ''), { timeout: 20000 });
  const accepted = await host2.evaluate(() => Number(localStorage.getItem('petbank_points') || 0));
  assert.equal(accepted, 3);
  await game.evaluate(({ message, targetOrigin }) => window.opener.postMessage(message, targetOrigin), { message: completion, targetOrigin: new URL(miniGamesUrl).origin });
  await game.waitForFunction(() => /奖励已处理/.test(document.querySelector('#feedback')?.textContent || ''), { timeout: 20000 });
  assert.equal(await host2.evaluate(() => Number(localStorage.getItem('petbank_points') || 0)), 3);

  const gameStorage = await game.evaluate(() => ({ petbankKeys: Object.keys(localStorage).filter((key) => key.startsWith('petbank_')), projectKeys: Object.keys(localStorage).filter((key) => key.startsWith('minigames_')) }));
  assert.deepEqual(gameStorage.petbankKeys, []);
  console.log(JSON.stringify({ learningOrigin: new URL(learning.url()).origin, miniGamesOrigin: new URL(miniHub.url()).origin, acceptedPoints: accepted, duplicatePoints: await host2.evaluate(() => Number(localStorage.getItem('petbank_points') || 0)), learningProjectKeys: learningState.projectKeys.length, gameProjectKeys: gameStorage.projectKeys.length }, null, 2));
} finally {
  await browser.close();
}
