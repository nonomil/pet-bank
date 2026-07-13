import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const assembleScript = path.join(repoRoot, 'scripts', 'assemble-pages-artifact.mjs');
// 并行回归时各实例使用独立目录，避免 Windows 清理共享目录时出现 ENOTEMPTY。
const outputDir = path.join(repoRoot, 'tmp', `word-shooter-published-artifact-test-${process.pid}`);
const screenshotPath = path.join(repoRoot, 'tmp', 'word-shooter-published-artifact.png');
const backgroundFiles = [
  'dawn-training-ground-clean/dawn-training-ground-clean.png',
  'candy-nebula-clean/candy-nebula-clean.png',
  'volcanic-meteor-belt-clean/volcanic-meteor-belt-clean.png'
];

const playwright = createRequire(import.meta.url)('playwright');
const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, 'Chrome or Edge executable should exist');

function mimeType(filePath) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg'
  })[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function createStaticServer(rootDir) {
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '') || path.join('prj', '学习机玩法原型', 'index.html');
    const absolutePath = path.resolve(rootDir, relativePath);
    if (!absolutePath.startsWith(rootDir) || !fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeType(absolutePath) });
    fs.createReadStream(absolutePath).pipe(response);
  });
}

fs.rmSync(outputDir, { recursive: true, force: true });
try {
  const result = spawnSync(process.execPath, [assembleScript, outputDir], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, `Pages artifact assembly should succeed: ${result.stderr}`);
  for (const relativeFile of backgroundFiles) {
    const absoluteFile = path.join(
      outputDir,
      'prj',
      '学习机玩法原型',
      'assets',
      'generated',
      'reference',
      'word-shooter-levels-gpt-20260711',
      'agnes-20260712',
      relativeFile
    );
    assert.ok(fs.existsSync(absoluteFile), `published artifact should include ${relativeFile}`);
    assert.ok(fs.statSync(absoluteFile).size > 0, `published background should not be empty: ${relativeFile}`);
  }

  const server = createStaticServer(outputDir);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await playwright.chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) consoleErrors.push(`${response.status()} ${response.url()}`);
    });
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/prj/学习机玩法原型/index.html?game=word-shooter`, {
      waitUntil: 'domcontentloaded'
    });
    await page.waitForFunction(() => Boolean(window.LearningArcadePrototype?.wordShooter), null, { timeout: 10000 });
    await page.evaluate(() => {
      window.LearningArcadePrototype.setWordDifficulty('basic');
      window.LearningArcadePrototype.openGame('word-shooter');
    });
    await page.waitForFunction(() => document.querySelector('#typingStageBackdropImage')?.naturalWidth > 0, null, { timeout: 10000 });
    const runtime = await page.evaluate(() => {
      const backdrop = document.querySelector('#typingStageBackdropImage');
      const hud = document.querySelector('.word-shooter .game-hud');
      return {
        backgroundLoaded: Boolean(backdrop?.complete && backdrop.naturalWidth > 0),
        hudDisplay: hud ? getComputedStyle(hud).display : 'missing',
        overflowX: document.documentElement.scrollWidth > innerWidth,
        theme: document.querySelector('#typingArena')?.dataset.stageTheme
      };
    });
    await page.screenshot({ path: screenshotPath });
    assert.equal(runtime.backgroundLoaded, true, 'published page should load the Agnes stage background');
    assert.equal(runtime.hudDisplay, 'none', 'published page should hide the duplicate top HUD');
    assert.equal(runtime.overflowX, false, 'published page should not overflow horizontally');
    assert.equal(runtime.theme, 'dawn-training', 'published page should render the basic theme');
    assert.deepEqual(consoleErrors, [], `published page should keep console clean: ${JSON.stringify(consoleErrors)}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  console.log('PASS - word shooter published artifact');
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
