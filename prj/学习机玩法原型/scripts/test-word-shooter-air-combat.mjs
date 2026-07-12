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
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, 'Chrome or Edge executable should exist');

const server = http.createServer((req, res) => {
  const relativePath = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '') || prototypePath;
  const absolutePath = path.resolve(repoRoot, relativePath);
  if (!absolutePath.startsWith(repoRoot) || !fs.existsSync(absolutePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const extension = path.extname(absolutePath).toLowerCase();
  const contentType = extension === '.html' ? 'text/html; charset=utf-8'
    : extension === '.css' ? 'text/css; charset=utf-8'
      : extension === '.json' ? 'application/json; charset=utf-8'
        : 'application/javascript; charset=utf-8';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(absolutePath).pipe(res);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/${prototypePath}?game=word-shooter`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.LearningArcadePrototype?.wordShooter));

  const initial = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.deepEqual(initial.player, { x: 12, y: 50 }, 'air battle should expose the player position');
  assert.equal(initial.shield, 3, 'air battle should start with three shield points');
  assert.deepEqual(initial.enemyBullets, [], 'air battle should start without enemy bullets');

  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(40);
  const moved = await page.evaluate(() => window.LearningArcadePrototype.tickWordShooterFrame(500, 1));
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
  assert.ok(moved.player.x > initial.player.x, 'right input should move the player');
  assert.ok(moved.player.y < initial.player.y, 'up input should move the player');

  const released = await page.evaluate(() => {
    window.LearningArcadePrototype.setWordShooterMoveInput({});
    return window.LearningArcadePrototype.tickWordShooterFrame(100, 20);
  });
  assert.ok(released.enemyBullets.length > 0, 'enemies should fire readable projectiles');

  const hit = await page.evaluate(() => window.LearningArcadePrototype.debugHitWordShooterPlayer());
  assert.equal(hit.shield, 2, 'a projectile hit should remove one shield point');
  const protectedHit = await page.evaluate(() => window.LearningArcadePrototype.debugHitWordShooterPlayer());
  assert.equal(protectedHit.shield, 2, 'invulnerability should prevent immediate double damage');

  await page.evaluate(() => window.LearningArcadePrototype.debugExpireWordShooterInvulnerability());
  await page.evaluate(() => window.LearningArcadePrototype.debugHitWordShooterPlayer());
  await page.evaluate(() => window.LearningArcadePrototype.debugExpireWordShooterInvulnerability());
  const defeated = await page.evaluate(() => window.LearningArcadePrototype.debugHitWordShooterPlayer());
  assert.equal(defeated.shield, 0, 'three shield hits should deplete the shield');
  assert.equal(defeated.roundComplete, true, 'shield depletion should end the round');
  console.log('PASS - word shooter air combat');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
