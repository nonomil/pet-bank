import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const prototypePath = path.join('prj', '学习机玩法原型', 'index.html');
const requireFromHere = createRequire(import.meta.url);
const playwright = requireFromHere('playwright');

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg'
  })[ext] || 'application/octet-stream';
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || prototypePath;
    const absolutePath = path.resolve(repoRoot, relativePath);
    if (!absolutePath.startsWith(repoRoot) || !fs.existsSync(absolutePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType(absolutePath) });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

function findBrowserExecutable() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  assert.ok(executable, 'Chrome or Edge executable should exist for runtime tests');
  return executable;
}

const server = createStaticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: findBrowserExecutable()
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(`http://127.0.0.1:${port}/${prototypePath}?game=word-shooter`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.LearningArcadePrototype?.wordShooter));
  await page.waitForSelector('#wordShooter:not([hidden])');
  await page.evaluate(() => window.LearningArcadePrototype.setWordShooterEnemyFireEnabled(false));

  const initial = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(initial.phase, 'warmup', 'basic airplane battle should start in the warmup phase');
  assert.equal(initial.spawnCount, initial.enemies.length, 'snapshot should expose generated enemy count');
  assert.ok(initial.enemies.length >= 1 && initial.enemies.length <= 2, 'warmup should keep one or two enemies visible');

  const afterTwentySeconds = await page.evaluate(() => {
    return window.LearningArcadePrototype.tickWordShooterFrame(100, 200);
  });
  assert.equal(afterTwentySeconds.roundComplete, false, 'airplane battle should not end from elapsed time alone');
  assert.ok(afterTwentySeconds.enemies.length <= 2, 'basic battle should keep the warmup enemy cap');

  for (let index = 0; index < 5; index += 1) {
    const targetWord = await page.evaluate(() => {
      const snapshot = window.LearningArcadePrototype.wordShooter();
      return snapshot.enemies.slice().sort((left, right) => left.x - right.x)[0]?.word || '';
    });
    assert.ok(targetWord, `word shooter should expose a target for phase checkpoint ${index + 1}`);
    for (const letter of targetWord) {
      await page.keyboard.press(letter);
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(650);
  }
  const afterWarmup = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(afterWarmup.phase, 'formation', 'five completed words should advance to the formation phase');
  assert.equal(errors.length, 0, `page should not report runtime errors: ${errors.join('; ')}`);
  console.log('PASS - word shooter balance');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
