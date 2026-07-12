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
  const expected = {
    basic: 'dawn-training',
    intermediate: 'candy-nebula',
    full: 'volcanic-meteor'
  };
  for (const [difficulty, theme] of Object.entries(expected)) {
    const snapshot = await page.evaluate(level => {
      window.LearningArcadePrototype.setWordDifficulty(level);
      window.LearningArcadePrototype.openGame('word-shooter');
      return window.LearningArcadePrototype.wordShooter();
    }, difficulty);
    assert.equal(snapshot.stageTheme.id, theme, `${difficulty} should map to the correct stage theme`);
    assert.match(snapshot.stageTheme.background, new RegExp(`${theme}.*\\.png$`), `${difficulty} should expose its generated background`);
    assert.equal(await page.locator('#typingArena').getAttribute('data-stage-theme'), theme, `${difficulty} should update the arena theme`);
    assert.equal(await page.locator('#typingStageBackdropImage').evaluate(image => image.naturalWidth > 0), true, `${difficulty} background should load`);
    assert.equal(await page.locator('#typingPlayerShield').evaluate(image => image.naturalWidth > 0), true, 'Agnes player shield should load');
  }
  console.log('PASS - word shooter stage themes');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
