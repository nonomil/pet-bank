import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const prototypePath = path.join('prj', '学习机玩法原型', 'index.html');
const chromeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];
const playwrightSearchPaths = [
  process.env.CODEX_NODE_MODULES,
  'C:/Users/No\'mi\'l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
].filter(Boolean);

function requirePlaywright() {
  const baseRequire = createRequire(import.meta.url);
  for (const basePath of playwrightSearchPaths) {
    try {
      const resolved = baseRequire.resolve('playwright', { paths: [basePath] });
      return baseRequire(resolved);
    } catch (err) {
      continue;
    }
  }
  return baseRequire('playwright');
}

function findChrome() {
  const chromePath = chromeCandidates.find(candidate => fs.existsSync(candidate));
  assert.ok(chromePath, 'Chrome or Edge executable should exist for runtime smoke tests');
  return chromePath;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
  })[ext] || 'application/octet-stream';
}

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === '/' ? prototypePath : decodedPath.replace(/^\/+/, '');
    const absolutePath = path.resolve(rootDir, relativePath);
    if (!absolutePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType(absolutePath) });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function main() {
  const { chromium } = requirePlaywright();
  const server = createStaticServer(repoRoot);
  const port = await listen(server);
  const browser = await chromium.launch({
    headless: true,
    executablePath: findChrome()
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(5000);
    await page.goto(`http://127.0.0.1:${port}/${prototypePath}`, { waitUntil: 'networkidle' });
    await page.dispatchEvent('[data-game="pinyin-snake"]', 'click');
    await page.waitForSelector('#pinyinSnake:not([hidden])');

    await page.evaluate(() => {
      const snake = window.LearningArcadePrototype.pinyinSnake();
      snake.body = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }];
      snake.dir = { x: 1, y: 0 };
      snake.score = snake.roundGoal - 1;
      snake.combo = 3;
      snake.moves = 22;
      snake.targetIndex = 0;
      snake.roundComplete = false;
      snake.pieceIndex = snake.pieces.length - 1;
      snake.lastResult = 'ready';
      snake.feedbackTick = 0;
      snake.currentFoodState = 'target';
      snake.foods = [{ x: 5, y: 4, label: snake.pieces[snake.pieceIndex], correct: true }];
    });

    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !document.getElementById('roundSummary').hidden);
    await page.dispatchEvent('#roundSummaryHomeButton', 'click');
    await page.waitForFunction(() => {
      const gameScreen = document.getElementById('gameScreen');
      const gameHome = document.getElementById('gameHome');
      return gameScreen.hidden === true && gameHome.hidden === false;
    });

    const finalState = await page.evaluate(() => ({
      gameScreenHidden: document.getElementById('gameScreen').hidden,
      gameHomeHidden: document.getElementById('gameHome').hidden,
      activeGame: document.getElementById('gameScreen').dataset.activeGame,
      roundSummary: document.getElementById('gameScreen').dataset.roundSummary
    }));

    assert.equal(finalState.gameScreenHidden, true, 'game screen should be hidden after choosing return home');
    assert.equal(finalState.gameHomeHidden, false, 'home screen should be visible after choosing return home');
    console.log('PASS - round summary home action returns to home screen');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(async err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
