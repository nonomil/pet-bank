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
    await page.dispatchEvent('#replayRoundButton', 'click');
    await page.waitForFunction(() => document.getElementById('roundSummary').hidden);
    const snakeFeedback = await page.locator('#snakeFeedback').textContent();

    await page.dispatchEvent('#backHomeButton', 'click');
    await page.dispatchEvent('[data-game="word-cannon"]', 'click');
    await page.waitForSelector('#wordCannon:not([hidden])');
    const roundGoal = await page.evaluate(() => window.LearningArcadePrototype.wordCannon().roundGoal);
    for (let cleared = 0; cleared < roundGoal; cleared += 1) {
      const target = await page.evaluate(() => {
        const snap = window.LearningArcadePrototype.wordCannon();
        return {
          correct: snap.targets.find(item => item.correct) || null
        };
      });
      assert.ok(target.correct?.word, `word cannon should expose a correct pinyin card for replay reset ${cleared + 1}`);
      const stageRect = await page.locator('#cannonStage').boundingBox();
      assert.ok(stageRect, 'word cannon stage should be measurable during replay reset');
      await page.mouse.click(
        stageRect.x + stageRect.width * target.correct.x / 100,
        stageRect.y + stageRect.height * 0.72
      );
      await page.evaluate(() => window.LearningArcadePrototype.tickWordCannonFrame(220, 40));
      await page.waitForTimeout(80);
    }
    await page.waitForFunction(() => !document.getElementById('roundSummary').hidden);
    await page.dispatchEvent('#replayRoundButton', 'click');
    await page.waitForFunction(() => document.getElementById('roundSummary').hidden);
    const cannonFeedback = await page.locator('#cannonFeedback').textContent();

    assert.equal(
      snakeFeedback?.trim(),
      '方向键移动，先吃高亮拼音块。',
      'snake replay should restore the default movement hint'
    );
    assert.equal(
      cannonFeedback?.trim(),
      '看汉字，上下左右移动车子，接住正确拼音卡。',
      'pinyin racing replay should restore the default free-movement hint'
    );

    console.log('PASS - replay resets instructional feedback for snake and pinyin racing games');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
