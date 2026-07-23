import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const hostUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const wordQuestUrl = process.env.WORD_QUEST_URL || 'http://127.0.0.1:7002/';
const hostOrigin = new URL(hostUrl).origin;

const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const host = await context.newPage();
await host.addInitScript(() => localStorage.setItem('petbank_points', '0'));
const childErrors = [];
host.on('pageerror', (error) => childErrors.push(`host: ${error.message}`));
try {
  await host.goto(hostUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await host.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
  await host.evaluate(() => window.switchPage('minecraft-vocab', { skipAccessGate: true }));
  await host.waitForSelector('#page-minecraft-vocab.active [data-minecraft-vocab-page]', { timeout: 20000 });
  await host.waitForSelector('#minecraft-vocab-root [data-mv-open-wordquest]', { timeout: 20000 });

  const [child] = await Promise.all([
    context.waitForEvent('page'),
    host.locator('#minecraft-vocab-root [data-mv-open-wordquest]').click()
  ]);
  await child.waitForLoadState('domcontentloaded');
  const childUrl = new URL(child.url());
  assert.equal(childUrl.origin, new URL(wordQuestUrl).origin, 'external project origin');
  const launchParams = new URLSearchParams(childUrl.hash.slice(1));
  const launchId = launchParams.get('petbankLaunch') || '';
  const profileRef = launchParams.get('petbankProfile') || '';
  assert.ok(launchId, 'launch id must be passed to the independent project');
  assert.ok(profileRef, 'profile reference must be passed to the independent project');

  await child.waitForSelector('[data-action="start-quest"]', { timeout: 20000 });
  await child.locator('[data-action="start-quest"]').first().click();
  for (let index = 0; index < 10; index += 1) {
    await child.locator('[data-action="mark-learned"]').click();
  }
  await child.waitForSelector('[data-game="word-racer"] iframe', { timeout: 20000 });

  const recognitionFrame = child.frames().find((frame) => frame !== child.mainFrame() && frame.url().includes('word-quest-games/learning-arcade'));
  assert.ok(recognitionFrame, 'recognition game iframe must expose a real Playwright Frame');
  await recognitionFrame.evaluate(() => {
    window.parent.postMessage({
      source: 'word-quest-racer-host',
      kind: 'result',
      payload: { won: true, accuracy: 100, hintsUsed: 0 }
    }, '*');
  });

  await child.waitForSelector('[data-game="creeper-typing"] iframe', { timeout: 20000 });
  const typingFrame = child.frames().find((frame) => frame !== child.mainFrame() && frame.url().includes('word-quest-games/typing-defense'));
  assert.ok(typingFrame, 'typing game iframe must expose a real Playwright Frame');
  await typingFrame.evaluate(() => {
    window.parent.postMessage({
      source: 'petbank-typing-defense',
      kind: 'result',
      payload: { won: true, accuracy: 100 }
    }, '*');
  });

  await child.waitForFunction(() => globalThis.WordQuest?.read?.()?.setCompleted === true, { timeout: 30000 });
  await host.waitForFunction(
    () => /获得 \+10 成长分和 \+5 宠物经验/.test(document.querySelector('[data-word-quest-external-feedback]')?.textContent || ''),
    { timeout: 20000 }
  );

  const accepted = await host.evaluate(() => ({
    points: Number(localStorage.getItem('petbank_points') || 0),
    petExp: Number(window.PetSystem?.getState?.()?.exp || 0)
  }));
  assert.equal(accepted.points, 10, 'host growth points');
  assert.equal(accepted.petExp, 5, 'host pet experience');

  const childState = await child.evaluate(() => ({
    storageKeys: Object.keys(localStorage),
    profileKeys: Object.keys(localStorage).filter((key) => key.startsWith('wordquest_')),
    petbankKeys: Object.keys(localStorage).filter((key) => key.startsWith('petbank_')),
    profileId: globalThis.WordQuest?.profileId || '',
    completionId: globalThis.WordQuest.read().rewardEventId,
    activityId: globalThis.WordQuest.read().groupId
  }));
  assert.equal(childState.petbankKeys.length, 0, 'independent project must not write the host points namespace');
  assert.ok(childState.profileKeys.some((key) => key.endsWith(`_${profileRef}`)), 'child progress must be scoped to the host profile reference');
  assert.equal(childState.profileId, profileRef, 'child router profile must match the host reference');

  await child.evaluate(({ launchId: id, profileRef: ref, activityId, completionId, hostOrigin: origin }) => {
    window.opener.postMessage({
      type: 'petbank.bridge.v1.completed',
      version: 1,
      launchId: id,
      profileRef: ref,
      projectId: 'word-quest',
      activityId,
      completionId,
      occurredAt: new Date().toISOString()
    }, origin);
  }, { launchId, profileRef, activityId: childState.activityId, completionId: childState.completionId, hostOrigin });
  await host.waitForFunction(
    () => /成长奖励已经领取过了/.test(document.querySelector('[data-word-quest-external-feedback]')?.textContent || ''),
    { timeout: 20000 }
  );
  const duplicate = await host.evaluate(() => ({
    points: Number(localStorage.getItem('petbank_points') || 0),
    petExp: Number(window.PetSystem?.getState?.()?.exp || 0)
  }));
  assert.deepEqual(duplicate, accepted, 'duplicate completion must not add a second reward');

  console.log(JSON.stringify({
    hostOrigin,
    childOrigin: childUrl.origin,
    launchId,
    profileRef,
    accepted,
    duplicate,
    childProfileKeys: childState.profileKeys.length,
    childPetbankKeys: childState.petbankKeys.length
  }, null, 2));
} finally {
  await browser.close();
}
