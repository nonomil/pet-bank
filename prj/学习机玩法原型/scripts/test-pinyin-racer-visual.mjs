import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const prototypePath = path.join('prj', '学习机玩法原型', 'index.html');
const screenshotDir = path.join(repoRoot, 'prj', '学习机玩法原型', 'tmp-screenshots');
const playwrightSearchPaths = [
  process.env.CODEX_NODE_MODULES,
  'C:/Users/No\'mi\'l/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
].filter(Boolean);
const chromeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];

function requirePlaywright() {
  const baseRequire = createRequire(import.meta.url);
  for (const basePath of playwrightSearchPaths) {
    try {
      const resolved = baseRequire.resolve('playwright', { paths: [basePath] });
      return baseRequire(resolved);
    } catch (err) {
      // Try the next known runtime path.
    }
  }
  return baseRequire('playwright');
}

function findChrome() {
  const chromePath = chromeCandidates.find(candidate => fs.existsSync(candidate));
  assert.ok(chromePath, 'Chrome or Edge executable should exist for visual smoke tests');
  return chromePath;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg'
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
  fs.mkdirSync(screenshotDir, { recursive: true });
  const server = createStaticServer(repoRoot);
  const port = await listen(server);
  const { chromium } = requirePlaywright();
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  try {
    await page.goto(`http://127.0.0.1:${port}/${prototypePath.replaceAll('\\', '/')}`, { waitUntil: 'networkidle' });
    await page.dispatchEvent('[data-game="word-cannon"]', 'click');
    await page.waitForSelector('#wordCannon:not([hidden]) .pinyin-race-car-img');
    await page.waitForSelector('#wordCannon:not([hidden]) .cannon-target-frame');

    const before = await page.evaluate(() => {
      const imageInfo = selector => {
        const node = document.querySelector(selector);
        return node ? { src: node.getAttribute('src'), width: node.naturalWidth, height: node.naturalHeight } : null;
      };
      const stage = document.getElementById('cannonStage');
      return {
        car: imageInfo('.pinyin-race-car-img'),
        trail: imageInfo('.pinyin-race-speed-trail'),
        checkpointArch: imageInfo('.race-checkpoint-arch'),
        sign: imageInfo('.cannon-target-frame'),
        targetCount: document.querySelectorAll('.cannon-target').length,
        targetRect: document.querySelector('.cannon-target')?.getBoundingClientRect().toJSON() || null,
        targetRects: [...document.querySelectorAll('.cannon-target')].map(node => node.getBoundingClientRect().toJSON()),
        taskRect: document.querySelector('.cannon-current-word')?.getBoundingClientRect().toJSON() || null,
        targetLabels: [...document.querySelectorAll('.cannon-target small')].map(node => node.textContent.trim()),
        selectedLane: Number(document.querySelector('.pinyin-race-car')?.dataset.racerLane || 0),
        carAnimation: getComputedStyle(document.querySelector('.pinyin-race-car')).animationName,
        controlRects: [...document.querySelectorAll('.pinyin-stage-controls .key-button')].map(node => node.getBoundingClientRect().toJSON()),
        stageImage: getComputedStyle(stage).getPropertyValue('--cannon-stage-image'),
        stageRect: stage.getBoundingClientRect().toJSON(),
        carRect: document.querySelector('.pinyin-race-car')?.getBoundingClientRect().toJSON() || null,
        feedback: document.getElementById('cannonFeedback').textContent.trim(),
        correctTarget: window.LearningArcadePrototype.wordCannon().targets.find(target => target.correct) || null,
        optionWords: window.LearningArcadePrototype.wordCannon().targets.map(target => ({
          word: target.word,
          correct: target.correct,
          cardType: target.cardType || ''
        }))
      };
    });

    assert.match(before.stageImage, /assets\/拼音赛车|pinyin-racer-retheme-20260711|pinyin-racer-long-track-strip\.png/, 'racing stage should use a prepared rethemed or legacy track background');
    assert.ok(before.car?.width > 0 && before.car?.height > 0, 'race car asset should load');
    assert.match(before.car.src, /race_car_top_up\.svg/, 'pinyin racer should use the clean vertical top-down car asset');
    assert.ok(before.car.height > before.car.width, 'top-down race car asset should be taller than wide so it reads as pointing upward');
    assert.equal(before.carAnimation, 'none', 'race car should not idle-bob or scale while waiting');
    assert.ok(before.trail?.width > 0 && before.trail?.height > 0, 'speed trail PNG should load');
    assert.ok(before.checkpointArch?.width > 0 && before.checkpointArch?.height > 0, 'checkpoint arch PNG should load');
    assert.match(before.checkpointArch.src, /pinyin-racer-assets\/checkpoint_arch\.png/, 'checkpoint arch should use the prepared transparent racer asset');
    assert.ok(before.sign?.width > 0 && before.sign?.height > 0, 'road sign PNG should load');
    assert.equal(before.targetCount, 3, 'pinyin racing should show one option card in each lane');
    assert.ok(before.targetLabels.every(label => label && label !== before.correctTarget?.word), 'pinyin facility labels should remain instructional without revealing the answer text');
    assert.ok(before.targetRect?.width <= 150, 'pinyin option cards should stay child-readable without covering the road');
    assert.ok(before.targetRect?.height <= 86, 'pinyin option cards should remain compact');
    assert.ok(before.stageRect.width >= 900 && before.stageRect.height >= 360, 'desktop racing stage should be large enough for fullscreen play');
    assert.equal(before.controlRects.length, 2, 'pinyin racer should show two large touch controls');
    assert.ok(before.controlRects.every(rect => rect.width >= 90 && rect.height >= 50), 'touch controls should be large enough for a young child');
    assert.ok(before.controlRects.every(rect => rect.top >= before.stageRect.top && rect.bottom <= before.stageRect.bottom), 'touch controls should stay visible inside the game stage');
    const overlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    assert.ok(before.targetRects.every(rect => !overlaps(before.taskRect, rect)), 'hanzi task card should not cover pinyin option cards');
    assert.ok(before.controlRects.every(rect => !overlaps(before.taskRect, rect)), 'hanzi task card should not cover touch controls');
    assert.ok(before.correctTarget?.correct, 'one pinyin option should be marked as the correct catch target');
    assert.ok(new Set(before.optionWords.map(item => item.cardType)).size >= 2, 'pinyin racer should render varied card facility types, not one generic card shape');
    assert.ok(/^[a-z]+$/.test(before.correctTarget?.word || ''), 'correct pinyin option should use lowercase letters');
    assert.ok(
      before.optionWords.filter(item => !item.correct).every(item => item.word[0] !== before.correctTarget.word[0]),
      'basic pinyin racer distractors should be easy to distinguish by initial sound'
    );

    await page.screenshot({ path: path.join(screenshotDir, 'pinyin-racer-desktop.png'), fullPage: true });
    const wrongLane = (before.correctTarget.laneIndex + 1) % 3;
    const laneClickX = [0.28, 0.5, 0.72][wrongLane];
    await page.mouse.click(before.stageRect.left + before.stageRect.width * laneClickX, before.stageRect.top + before.stageRect.height * 0.72);
    await page.waitForTimeout(80);
    const afterClick = await page.evaluate(() => ({
      selectedLane: window.LearningArcadePrototype.wordCannon().playerLane,
      feedback: document.getElementById('cannonFeedback').textContent.trim()
    }));
    assert.equal(afterClick.selectedLane, wrongLane, 'clicking the stage should move the car to a child-friendly touch lane');
    assert.match(afterClick.feedback, /左车道|中间车道|右车道|已经在/, 'touch lane movement should show simple lane feedback');

    await page.evaluate(() => window.LearningArcadePrototype.tickWordCannonFrame(220, 40));
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({
      feedback: document.getElementById('cannonFeedback').textContent.trim(),
      selectedLane: window.LearningArcadePrototype.wordCannon().playerLane,
      carSrc: document.querySelector('.pinyin-race-car-img')?.getAttribute('src') || '',
      carRect: document.querySelector('.pinyin-race-car')?.getBoundingClientRect().toJSON() || null,
      cannon: window.LearningArcadePrototype.wordCannon(),
      targetLabels: [...document.querySelectorAll('.cannon-target small')].map(node => node.textContent.trim())
    }));
    assert.ok(after.carRect?.y < before.carRect?.y - 1, 'race car should visibly advance upward during a wave');
    assert.equal(after.cannon.completedWords.length, 0, 'a wrong catch should not count as a completed pinyin card');
    assert.equal(after.cannon.currentTask.char, before.correctTarget.char, 'after a wrong catch, the same hanzi should be retried for learning');
    assert.equal(after.cannon.targets.find(target => target.correct)?.pinyin, before.correctTarget.pinyin, 'retry wave should keep the same correct pinyin');
    assert.equal(after.cannon.hintActive, true, 'wrong catch should activate a short gentle hint');
    assert.ok(after.targetLabels.includes('再找这个'), 'retry should gently mark the correct card after a miss');
    assert.match(after.feedback, /再找/, 'wrong catch feedback should tell the child to try the same pinyin again');
    assert.match(after.carSrc, /pinyin-racer-assets\/(car_pose_drift|race_car_)/, 'car should stay on GPT-generated racer assets after moving');

    const segmentTrace = [];
    for (let wave = 0; wave < 5; wave += 1) {
      const waveState = await page.evaluate(() => {
        const stage = document.getElementById('cannonStage');
        const cannon = window.LearningArcadePrototype.wordCannon();
        const correct = cannon.targets.find(target => target.correct);
        return {
          segment: stage?.dataset.segment || '',
          mapId: stage?.dataset.mapId || '',
          route: stage?.dataset.route || '',
          taskType: stage?.dataset.taskType || '',
          correctLane: correct?.laneIndex ?? -1,
          laneXs: cannon.targets.map(target => target.x),
          completed: cannon.completedWords.length
        };
      });
      assert.ok(waveState.correctLane >= 0, `wave ${wave + 1} should expose a correct lane`);
      segmentTrace.push(waveState);
      await page.screenshot({ path: path.join(screenshotDir, `pinyin-racer-segment-${wave + 1}.png`), fullPage: true });
      const stageRect = await page.locator('#cannonStage').boundingBox();
      const laneClickX = [0.28, 0.5, 0.72][waveState.correctLane];
      await page.mouse.click(stageRect.x + stageRect.width * laneClickX, stageRect.y + stageRect.height * 0.72);
      await page.evaluate(() => window.LearningArcadePrototype.tickWordCannonFrame(220, 40));
      await page.waitForTimeout(60);
      const progressed = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
      assert.equal(progressed.completedWords.length, waveState.completed + 1, `wave ${wave + 1} should advance after the correct answer`);
    }
    assert.deepEqual(segmentTrace.map(item => item.segment), ['s-bend', 'fork', 'bridge', 'tunnel', 'finish-sprint'], 'five consecutive correct waves should cover the five designed race segments');
    assert.ok(new Set(segmentTrace.map(item => item.mapId)).size >= 2, 'race segments should switch visual map backgrounds');
    assert.ok(new Set(segmentTrace.map(item => item.laneXs.join(','))).size >= 4, 'race segments should change lane geometry');
    assert.ok(segmentTrace.every(item => item.route), 'each segment should expose a correct or recovery route');

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true
    });
    try {
      await mobile.goto(`http://127.0.0.1:${port}/${prototypePath.replaceAll('\\\\', '/')}`, { waitUntil: 'networkidle' });
      await mobile.dispatchEvent('[data-game="word-cannon"]', 'click');
      await mobile.waitForSelector('#wordCannon:not([hidden]) .pinyin-race-car-img');
      const mobileState = await mobile.evaluate(() => {
        const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null;
        const stage = rect('#cannonStage');
        return {
          stage,
          task: rect('.cannon-current-word'),
          targets: [...document.querySelectorAll('.cannon-target')].map(node => node.getBoundingClientRect().toJSON()),
          controls: [...document.querySelectorAll('.pinyin-stage-controls .key-button')].map(node => node.getBoundingClientRect().toJSON())
        };
      });
      const mobileOverlaps = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      assert.ok(mobileState.stage?.width >= 350, 'mobile racing stage should use almost the full screen width');
      assert.equal(mobileState.controls.length, 2, 'mobile racing stage should keep both touch controls');
      assert.ok(mobileState.controls.every(rect => rect.width >= 90 && rect.height >= 50), 'mobile touch controls should remain large enough for a child');
      assert.ok(mobileState.controls.every(rect => rect.top >= mobileState.stage.top && rect.bottom <= mobileState.stage.bottom), 'mobile touch controls should remain inside the visible stage');
      assert.ok(mobileState.targets.every(rect => !mobileOverlaps(mobileState.task, rect)), 'mobile task card should not cover pinyin options');
      assert.ok(mobileState.controls.every(rect => !mobileOverlaps(mobileState.task, rect)), 'mobile task card should not cover touch controls');
      assert.ok(mobileState.targets.every((rect, index, all) => all.every((other, otherIndex) => index === otherIndex || !mobileOverlaps(rect, other))), 'mobile pinyin cards should stay separated across the three lanes');
      await mobile.screenshot({ path: path.join(screenshotDir, 'pinyin-racer-mobile.png'), fullPage: true });
    } finally {
      await mobile.close();
    }

    const badLogs = logs.filter(item => item.type === 'error' || item.type === 'pageerror');
    assert.deepEqual(badLogs, [], 'visual smoke should have no console errors');
    console.log(JSON.stringify({ screenshot: path.join(screenshotDir, 'pinyin-racer-desktop.png'), before, after, segmentTrace }, null, 2));
    console.log('PASS - pinyin racer visual smoke');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
