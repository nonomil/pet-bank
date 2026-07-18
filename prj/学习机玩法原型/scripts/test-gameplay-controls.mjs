import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const prototypePath = path.join('prj', '学习机玩法原型', 'index.html');
const playwright = createRequire(import.meta.url)('playwright');
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(candidate => fs.existsSync(candidate));

assert.ok(executablePath, 'Chrome or Edge executable should exist');

const server = http.createServer((request, response) => {
  const relativePath = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname)
    .replace(/^\/+/, '') || prototypePath;
  const absolutePath = path.resolve(repoRoot, relativePath);
  if (!absolutePath.startsWith(repoRoot) || !fs.existsSync(absolutePath)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': absolutePath.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/javascript; charset=utf-8' });
  fs.createReadStream(absolutePath).pipe(response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/${prototypePath}?game=word-cannon`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.LearningArcadePrototype?.wordCannon));
  await page.waitForSelector('#wordCannon:not([hidden])');

  const initial = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.equal(initial.mapIndex, 0, 'racer should begin on its first selected map');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  const moved = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.ok(moved.player.x > initial.player.x, 'ArrowRight should move the racer freely on the x axis');
  assert.ok(moved.player.y < initial.player.y, 'ArrowUp should move the racer freely on the y axis');

  await page.evaluate(() => window.LearningArcadePrototype.selectWordCannonMap(2));
  const selected = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.equal(selected.mapIndex, 2, 'map selector should choose a specific map');
  assert.equal(selected.mapLocked, true, 'selected map should remain locked during the round');

  await page.evaluate(() => window.LearningArcadePrototype.debugAdvanceWordCannon(5));
  const afterFiveCards = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.equal(afterFiveCards.mapIndex, 2, 'map should not auto-change before ten successful cards');

  await page.evaluate(() => window.LearningArcadePrototype.openGame('word-shooter'));
  await page.waitForSelector('#wordShooter:not([hidden])');
  const beforeShot = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  const key = beforeShot.enemies[0]?.word?.[0];
  assert.ok(key, 'word shooter should expose a typeable enemy');
  await page.locator('#wordShooterSettings summary').click();
  await page.locator('#wordDifficultySwitch [data-word-difficulty]').first().click();
  await page.keyboard.press(key);
  const afterShot = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.ok(afterShot.attackEvents.length > beforeShot.attackEvents.length, 'typing should keep firing after a settings interaction');
  assert.equal(await page.evaluate(() => document.activeElement === document.getElementById('gameScreen')), true, 'active game should restore keyboard focus after controls are clicked');

  console.log('PASS - free racer controls, persistent map, and shooter input recovery');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
