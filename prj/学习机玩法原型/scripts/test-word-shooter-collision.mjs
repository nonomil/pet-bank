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
  const type = absolutePath.endsWith('.html') ? 'text/html; charset=utf-8'
    : absolutePath.endsWith('.css') ? 'text/css; charset=utf-8'
      : absolutePath.endsWith('.json') ? 'application/json; charset=utf-8'
        : 'application/javascript; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(absolutePath).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/${prototypePath}?game=word-shooter`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#wordShooter:not([hidden])');
  await page.evaluate(() => window.LearningArcadePrototype.setWordShooterEnemyFireEnabled(false));
  const initial = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  const wrongLetter = initial.enemies.some(enemy => enemy.word[0] === 'z') ? 'q' : 'z';
  await page.keyboard.press(wrongLetter);
  const afterWrong = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(afterWrong.roundComplete, false, 'a wrong letter should not end the airplane battle');

  const beforeCollision = await page.evaluate(() => window.LearningArcadePrototype.tickWordShooterFrame(100, 300));
  assert.equal(beforeCollision.roundComplete, false, 'approaching enemies should not end the round before collision');
  const atCollision = await page.evaluate(() => window.LearningArcadePrototype.tickWordShooterFrame(100, 400));
  assert.equal(atCollision.roundComplete, true, 'the airplane battle should end when an enemy reaches the player');
  console.log('PASS - word shooter collision');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
