import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { browserLaunchOpts } from '../../../scripts/playwright-browser.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const prototypePath = path.join('prj', '学习机玩法原型', 'index.html');
const screenshotDir = path.join(repoRoot, 'prj', '学习机玩法原型', 'tmp-screenshots');
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
  const requestProblems = [];
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === '/' ? prototypePath : decodedPath.replace(/^\/+/, '');
    const absolutePath = path.resolve(rootDir, relativePath);
    if (!absolutePath.startsWith(rootDir)) {
      requestProblems.push({ status: 403, path: decodedPath });
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      requestProblems.push({ status: 404, path: decodedPath });
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType(absolutePath) });
    fs.createReadStream(absolutePath).pipe(res);
  });
  server.requestProblems = requestProblems;
  return server;
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

function attachConsoleCollector(page, sink) {
  page.on('console', msg => {
    sink.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    sink.push({ type: 'pageerror', text: err.message });
  });
}

async function openGame(page, gameId) {
  await page.dispatchEvent(`[data-game="${gameId}"]`, 'click');
  const selector = ({
    'word-shooter': '#wordShooter:not([hidden])',
    'word-cannon': '#wordCannon:not([hidden])',
    'pinyin-snake': '#pinyinSnake:not([hidden])',
  })[gameId];
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('gameScreen')?.hasAttribute('aria-busy'), null, { timeout: 15000 });
}

async function closeStaticServer(server) {
  if (!server || !server.listening) return;
  const closeAll = typeof server.closeAllConnections === 'function'
    ? () => server.closeAllConnections()
    : () => {};
  const closeIdle = typeof server.closeIdleConnections === 'function'
    ? () => server.closeIdleConnections()
    : () => {};
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      closeAll();
      closeIdle();
      finish();
    }, 3000);
    closeIdle();
    try {
      server.close(finish);
    } catch (_) {
      finish();
    }
  });
}

async function returnHome(page) {
  await page.dispatchEvent('#backHomeButton', 'click');
  await page.waitForFunction(() => {
    const gameScreen = document.getElementById('gameScreen');
    const gameHome = document.getElementById('gameHome');
    return gameScreen.hidden === true && gameHome.hidden === false;
  });
}

async function runWordShooterRound(page) {
  await openGame(page, 'word-shooter');
  const roundGoal = await page.evaluate(() => window.LearningArcadePrototype.wordShooter().roundGoal);
  const shooterFeedback = await page.locator('#wordFeedback').innerText();
  assert.match(shooterFeedback, /按 [a-z]|按[a-z]/i, 'word shooter should show a lower feedback bar that points to the current starter letter');
  for (let cleared = 0; cleared < roundGoal; cleared += 1) {
    const targetWord = await page.evaluate(() => {
      const snap = window.LearningArcadePrototype.wordShooter();
      return snap.enemies.slice().sort((a, b) => a.x - b.x)[0]?.word || '';
    });
    assert.ok(targetWord, `word shooter should expose a target word for wave ${cleared + 1}`);
    for (const letter of targetWord) {
      await page.keyboard.press(letter);
      if (cleared === 0 && letter === targetWord[0]) {
        await page.waitForFunction(
          () => document.querySelectorAll('#typingProjectileLayer .typing-shot-trail').length >= 1,
          { timeout: 1000 }
        );
        const projectileState = await page.evaluate(() => ({
          legacyBullets: document.querySelectorAll('#typingProjectileLayer .typingBullet').length
        }));
        assert.equal(projectileState.legacyBullets, 0, 'word shooter should not render the old ghost projectile body');
      }
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(900);
  }

  await page.waitForFunction(() => !document.getElementById('roundSummary').hidden);
  const summary = await page.evaluate(() => ({
    text: document.getElementById('roundSummary').innerText,
    progress: document.getElementById('typingProgress').textContent.trim()
  }));
  assert.match(summary.text, new RegExp(`${roundGoal}\\s*/\\s*${roundGoal}`), 'word shooter summary should report a cleared round');
  assert.match(summary.text, /基础训练完成/, 'word shooter summary should use the current difficulty achievement title');
  assert.match(summary.text, /本局模式\s*基础训练/, 'word shooter summary should include the completed low-pressure mode');
  assert.match(summary.text, /金币\s*\+80/, 'word shooter summary should award basic clear coins for the longer low-pressure round');
  assert.match(summary.text, /星星\s*\+3/, 'word shooter summary should award stars for a clear');
  assert.match(summary.text, /武器升级\s*激光炮芯片/, 'word shooter summary should award a weapon upgrade item');
  assert.equal(summary.progress, `${roundGoal} / ${roundGoal}`, 'word shooter HUD should show a finished round before replay');

  await page.dispatchEvent('#replayRoundButton', 'click');
  await page.waitForFunction(goal => {
    return document.getElementById('roundSummary').hidden
      && document.getElementById('typingProgress').textContent.trim() === `0 / ${goal}`;
  }, roundGoal);

  const replayState = await page.evaluate(() => ({
    progress: document.getElementById('typingProgress').textContent.trim(),
    activeGame: document.getElementById('gameScreen').dataset.activeGame
  }));
  assert.equal(replayState.progress, `0 / ${roundGoal}`, 'word shooter replay should reset the round HUD');
  assert.equal(replayState.activeGame, 'word-shooter', 'word shooter replay should keep the player in the same game');
  await returnHome(page);
}

async function runSnakeFinishHome(page) {
  await openGame(page, 'pinyin-snake');
  const snakeVisualState = await page.evaluate(() => ({
    hanziCount: window.LearningArcadePrototype.hanziPool().count,
    stageClass: document.getElementById('snakeReferenceStage')?.className || '',
    statText: [...document.querySelectorAll('.snake-ref-stat')].map(node => node.textContent.trim()).join(' '),
    dotCount: document.querySelectorAll('.snake-food-dot').length,
    foodAssetCount: document.querySelectorAll('.snake-food-asset').length,
    foodLabelCount: document.querySelectorAll('.snake-food-label').length,
    targetLabel: document.querySelector('.snake-food-dot.is-target .snake-food-label')?.textContent.trim() || '',
    controlCount: document.querySelectorAll('.snake-control-pad [data-snake-control]').length,
    feedback: document.getElementById('snakeFeedback').textContent.trim()
  }));
  assert.ok(snakeVisualState.hanziCount >= 30, 'pinyin snake should use the full root hanzi question pool instead of a 12-item slice');
  assert.match(snakeVisualState.stageClass, /snake-reference-stage/, 'snake should render inside a reference-style arena');
  assert.match(snakeVisualState.statText, /长度|星星/, 'snake should show simple length and score stats like the reference');
  assert.ok(snakeVisualState.dotCount >= 1, 'snake should render round dot food markers');
  assert.equal(snakeVisualState.foodAssetCount, snakeVisualState.dotCount, 'every snake food should use a visual food asset');
  assert.equal(snakeVisualState.foodLabelCount, snakeVisualState.dotCount, 'every snake food should show a readable pinyin label');
  assert.match(snakeVisualState.targetLabel, /^[a-z]+$/, 'the target food should expose its pinyin label');
  assert.equal(snakeVisualState.controlCount, 4, 'snake should expose four visible direction controls');
  assert.match(snakeVisualState.feedback, /方向键.*高亮拼音块/, 'pinyin snake should show a gentle first-run starter hint');
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
  const summary = await page.locator('#roundSummary').innerText();
  assert.match(summary, /5\/5/, 'snake summary should report a completed five-star round');
  assert.match(summary, /方向键热身完成/, 'snake summary should use the unified completion title');
  assert.match(summary, /本局模式\s*方向键热身/, 'snake summary should include the completed warmup mode');
  assert.match(summary, /金币\s*\+40/, 'snake summary should award coins for a finished five-star snake round');
  assert.match(summary, /星星\s*\+2/, 'snake summary should award bonus stars for the snake warmup round');
  assert.match(summary, /路线升级\s*尾巴加长/, 'snake summary should award a snake-specific upgrade item');
  await page.dispatchEvent('#roundSummaryHomeButton', 'click');
  await page.waitForFunction(() => {
    const gameScreen = document.getElementById('gameScreen');
    const gameHome = document.getElementById('gameHome');
    return gameScreen.hidden === true
      && gameHome.hidden === false
      && gameScreen.dataset.activeGame === 'home';
  });
}

async function runWordCannonRound(page) {
  await openGame(page, 'word-cannon');
  const roundGoal = await page.evaluate(() => window.LearningArcadePrototype.wordCannon().roundGoal);
  const firstTarget = await page.evaluate(() => {
    const snap = window.LearningArcadePrototype.wordCannon();
    return snap.targets[0] || null;
  });
  const hanziPool = await page.evaluate(() => window.LearningArcadePrototype.hanziPool());
  assert.ok(hanziPool.count >= 30, 'pinyin racing should use the full root hanzi question pool instead of a 12-item slice');
  const cannonMap = await page.evaluate(() => {
    const snap = window.LearningArcadePrototype.wordCannon();
    return {
      title: snap.mapTitle,
      asset: snap.mapAsset,
      stageImage: getComputedStyle(document.getElementById('cannonStage')).getPropertyValue('--cannon-stage-image')
    };
  });
  assert.match(cannonMap.title, /星光赛道|赛车/, 'pinyin racing should start with the GPT-generated racing track');
  assert.match(cannonMap.stageImage, /assets\/拼音赛车|pinyin-racer-retheme-20260711|pinyin-racer-long-track-strip\.png/, 'pinyin racing stage CSS should receive a prepared rethemed or legacy track background');
  const racerAssets = await page.evaluate(() => ({
    car: document.querySelector('.pinyin-race-car-img')?.getAttribute('src') || '',
    trail: document.querySelector('.pinyin-race-speed-trail')?.getAttribute('src') || '',
    sign: document.querySelector('.cannon-target-frame')?.getAttribute('src') || '',
    feedback: document.getElementById('cannonFeedback').textContent.trim()
  }));
  assert.match(racerAssets.car, /pinyin-racer-assets\/race_car_/, 'pinyin racing should render the GPT-generated race car PNG');
  assert.match(racerAssets.trail, /pinyin-racer-assets\/speed_trail_long\.png/, 'pinyin racing should render the GPT-generated speed trail PNG');
  assert.match(racerAssets.sign, /pinyin-racer-semantic-assets|pinyin-racer-retheme-assets|pinyin-racer-assets\/road_sign_/, 'pinyin racing should render prepared semantic facilities or legacy road-sign targets');
  assert.match(racerAssets.feedback, /第一次玩.*认汉字.*基础/, 'pinyin racing should show a gentle first-run starter recommendation');
  assert.ok(firstTarget?.pinyin, 'pinyin racing should expose pinyin targets');
  assert.ok(/^[a-z]+$/.test(firstTarget.word), 'pinyin racing option cards should be normalized pinyin');
  assert.ok(firstTarget.char, 'pinyin racing should keep the paired hanzi character');
  assert.equal(firstTarget.translation, firstTarget.char, 'pinyin racing target translation should be the paired hanzi character');
  for (let cleared = 0; cleared < roundGoal; cleared += 1) {
    const target = await page.evaluate(() => {
      const snap = window.LearningArcadePrototype.wordCannon();
      return {
        playerLane: snap.playerLane,
        correct: snap.targets.find(item => item.correct) || null
      };
    });
    assert.ok(target.correct?.word, `pinyin racing should expose a correct card for checkpoint ${cleared + 1}`);
    const stageBox = await page.locator('#cannonStage').boundingBox();
    assert.ok(stageBox, `pinyin racing stage should be measurable at checkpoint ${cleared + 1}`);
    await page.mouse.click(
      stageBox.x + stageBox.width * (target.correct.x / 100),
      stageBox.y + stageBox.height * 0.5
    );
    await page.waitForFunction(expectedX => {
      return Math.abs(window.LearningArcadePrototype.wordCannon().player.x - expectedX) < 1;
    }, target.correct.x);
    await page.evaluate(() => window.LearningArcadePrototype.tickWordCannonFrame(220, 40));
    await page.waitForTimeout(80);
  }

  await page.waitForFunction(() => !document.getElementById('roundSummary').hidden);
  const summary = await page.locator('#roundSummary').innerText();
  assert.match(summary, new RegExp(`${roundGoal}\\s*/\\s*${roundGoal}`), 'pinyin racing summary should report a completed round');
  assert.match(summary, /基础训练完成/, 'pinyin racing summary should use the current difficulty achievement title');
  assert.match(summary, /本局模式\s*基础训练/, 'pinyin racing summary should include the completed low-pressure mode');
  assert.match(summary, /复习一下\s*[\u4e00-\u9fff]\s+[a-z]+/, 'pinyin racing summary should include a short hanzi-pinyin review');
  assert.match(summary, /金币\s*\+80/, 'pinyin racing summary should award coins based on its lighter basic round');
  assert.match(summary, /星星\s*\+3/, 'pinyin racing summary should award stars for a clear');
  assert.match(summary, /武器升级\s*轮胎升级/, 'pinyin racing summary should award a racing upgrade item');
  await page.dispatchEvent('#replayRoundButton', 'click');
  await page.waitForFunction(() => {
    const goal = window.LearningArcadePrototype.wordCannon().roundGoal;
    return document.getElementById('roundSummary').hidden
      && document.getElementById('cannonProgress').textContent.trim() === `0 / ${goal}`;
  });
  const replayState = await page.evaluate(() => ({
    progress: document.getElementById('cannonProgress').textContent.trim(),
    feedback: document.getElementById('cannonFeedback').textContent.trim(),
    roundGoal: window.LearningArcadePrototype.wordCannon().roundGoal
  }));
  assert.equal(replayState.progress, `0 / ${replayState.roundGoal}`, 'pinyin racing replay should reset the visible progress');
  assert.equal(
    replayState.feedback,
    '看汉字，上下左右移动车子，接住正确拼音卡。',
    'pinyin racing replay should restore the default free-movement hint'
  );
  await returnHome(page);
}

async function runDifficultySwitchChecks(page) {
  await openGame(page, 'word-shooter');
  const packState = await page.evaluate(() => window.LearningArcadePrototype.wordPack());
  assert.equal(packState.current, 'minecraft', 'word shooter should default to the Minecraft vocab pack');
  assert.ok(packState.packs.some(pack => pack.id === 'kindergarten' && pack.count > 0), 'word shooter should expose the kindergarten external vocab pack');
  assert.ok(packState.packs.some(pack => pack.id === 'elementary' && pack.count > 0), 'word shooter should expose the elementary external vocab pack');
  assert.ok(packState.packs.some(pack => pack.id === 'junior_high' && pack.count > 0), 'word shooter should expose the junior-high external vocab pack');
  assert.ok(packState.packs.some(pack => pack.id === 'all' && pack.count > packState.count), 'word shooter should expose an all-English external vocab pack');
  await page.evaluate(() => { document.getElementById('wordShooterSettings').open = true; });
  const packSwitchText = await page.locator('#wordPackSwitch').innerText();
  assert.match(packSwitchText, /Minecraft/, 'word shooter should show the current Minecraft pack choice');
  assert.match(packSwitchText, /幼儿园\s*\d+/, 'word shooter should allow choosing the kindergarten pack and show its word count');
  assert.match(packSwitchText, /小学\s*\d+/, 'word shooter should allow choosing the elementary pack and show its word count');

  await page.dispatchEvent('#wordPackSwitch [data-word-pack="kindergarten"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.wordPack().current === 'kindergarten');
  const kindergartenPack = await page.evaluate(() => ({
    pack: window.LearningArcadePrototype.wordPack(),
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    shooter: window.LearningArcadePrototype.wordShooter(),
    activeLabels: [...document.querySelectorAll('#wordPackSwitch .difficulty-chip.is-active')].map(node => node.textContent.trim())
  }));
  assert.equal(kindergartenPack.activeLabels.length, 1, 'word shooter should visibly select only one vocab pack');
  assert.match(kindergartenPack.activeLabels[0], /幼儿园\s*557/, 'word shooter should visibly select the kindergarten vocab pack with its word count');
  assert.equal(kindergartenPack.pack.current, 'kindergarten', 'word shooter should switch to kindergarten vocab');
  assert.ok(kindergartenPack.pack.count > 100, 'kindergarten pack should include the merged external words');
  assert.ok(kindergartenPack.difficulty.sampleWords.every(card => card.sourcePackGroup === 'kindergarten'), 'difficulty samples should come from the selected kindergarten pack');
  assert.equal(kindergartenPack.shooter.roundGoal, 8, 'switching vocab pack should restart the longer low-pressure basic round');
  assert.ok(
    kindergartenPack.shooter.enemies.every(enemy => enemy.sourcePackGroup === 'kindergarten'),
    'word shooter enemies should come from the selected kindergarten vocab pack'
  );
  assert.ok(
    kindergartenPack.shooter.enemies.some(enemy => !['smile', 'kiss', 'look', 'clean', 'hide'].includes(enemy.word)),
    'word shooter should not always restart from the first few kindergarten words'
  );
  const kindergartenBadge = await page.locator('#wordDifficultyBadge').innerText();
  assert.match(kindergartenBadge, /幼儿园\s*\d+词/, 'word shooter HUD badge should visibly show the selected kindergarten pack count');

  await page.dispatchEvent('#wordPackSwitch [data-word-pack="minecraft"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.wordPack().current === 'minecraft');
  const shooterBasic = await page.evaluate(() => window.LearningArcadePrototype.wordDifficulty());
  assert.equal(shooterBasic.current, 'basic', 'word shooter should default to basic vocab difficulty');
  assert.ok(shooterBasic.levelCounts.basic > 0, 'basic difficulty should have a non-empty dedicated tier');
  assert.ok(shooterBasic.levelCounts.intermediate > 0, 'intermediate difficulty should have a non-empty dedicated tier');
  assert.ok(shooterBasic.levelCounts.full > 0, 'full difficulty should have a non-empty dedicated tier');
  assert.ok(new Set(Object.values(shooterBasic.levelCounts)).size > 1, 'difficulty tiers should not all collapse to the same size');
  assert.ok(shooterBasic.sampleWords.every(card => card.level === 'basic'), 'basic difficulty should sample only basic-level words');
  const shooterBasicTuning = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(shooterBasicTuning.difficulty.maxEnemies, 2, 'basic word shooter should keep the screen calmer with two enemies');
  assert.equal(shooterBasicTuning.roundGoal, 8, 'basic word shooter should stay long enough to feel like a playable practice round');
  assert.equal(shooterBasicTuning.difficulty.crashOnly, true, 'basic word shooter should only end when an enemy collides with the player');
  const shooterBasicBadge = await page.locator('#wordDifficultyBadge').innerText();
  assert.match(shooterBasicBadge, /基础训练/, 'word shooter should explain the selected basic difficulty in the HUD badge');
  assert.match(shooterBasicBadge, /8词.*2架/, 'word shooter basic badge should summarize the calmer longer round and enemy count');

  await page.dispatchEvent('#wordDifficultySwitch [data-word-difficulty="intermediate"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.wordDifficulty().current === 'intermediate');
  const shooterIntermediate = await page.evaluate(() => ({
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    activeLabels: [...document.querySelectorAll('#wordDifficultySwitch .difficulty-chip.is-active')].map(node => node.textContent.trim())
  }));
  assert.equal(shooterIntermediate.difficulty.current, 'intermediate', 'word shooter should switch to intermediate difficulty');
  assert.ok(shooterIntermediate.difficulty.count > 0, 'intermediate difficulty should expose a non-empty word list');
  assert.ok(shooterIntermediate.difficulty.sampleWords.every(card => card.level === 'intermediate'), 'intermediate difficulty should sample only intermediate-level words');
  assert.notEqual(shooterIntermediate.difficulty.count, shooterBasic.count, 'intermediate difficulty should expose a different pool size from basic');
  assert.deepEqual(shooterIntermediate.activeLabels, ['进阶'], 'word shooter should highlight the intermediate difficulty chip');
  const shooterIntermediateTuning = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(shooterIntermediateTuning.difficulty.maxEnemies, 3, 'intermediate word shooter should add a third enemy lane');
  assert.equal(shooterIntermediateTuning.roundGoal, 10, 'intermediate word shooter should use a longer ten-word round');
  const shooterIntermediateBadge = await page.locator('#wordDifficultyBadge').innerText();
  assert.match(shooterIntermediateBadge, /进阶战斗/, 'word shooter should update the HUD badge after switching to intermediate');
  assert.match(shooterIntermediateBadge, /10词.*3架/, 'word shooter intermediate badge should summarize the tuned challenge');
  await page.waitForFunction(() => document.querySelector('#wordDifficultyBadge')?.classList.contains('is-pulsing'), null, { timeout: 2000 });
  assert.deepEqual(
    await page.evaluate(() => window.LearningArcadePrototype.wordDifficulty().lastCue),
    { gameId: 'word-shooter', level: 'intermediate' },
    'word shooter should record the latest difficulty cue for switch feedback'
  );

  await page.dispatchEvent('#wordDifficultySwitch [data-word-difficulty="full"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.wordDifficulty().current === 'full');
  const shooterFull = await page.evaluate(() => ({
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    activeLabels: [...document.querySelectorAll('#wordDifficultySwitch .difficulty-chip.is-active')].map(node => node.textContent.trim())
  }));
  assert.equal(shooterFull.difficulty.current, 'full', 'word shooter should switch to full difficulty');
  assert.ok(shooterFull.difficulty.count >= shooterIntermediate.difficulty.count, 'full difficulty should expose at least as many words as intermediate');
  assert.ok(shooterFull.difficulty.count > shooterBasic.count, 'full difficulty should expose a larger pool than basic');
  assert.deepEqual(shooterFull.activeLabels, ['完整'], 'word shooter should highlight the full difficulty chip');
  const shooterFullTuning = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(shooterFullTuning.difficulty.maxEnemies, 4, 'full word shooter should allow four enemies for a denser arcade feel');
  assert.equal(shooterFullTuning.roundGoal, 12, 'full word shooter should use a longer twelve-word round');
  assert.equal(shooterFullTuning.difficulty.crashOnly, true, 'full word shooter should only end when an enemy collides with the player');
  assert.ok(
    shooterFullTuning.difficulty.speedMultiplier > shooterBasicTuning.difficulty.speedMultiplier,
    'full word shooter should move enemies faster than basic'
  );
  const shooterFullBadge = await page.locator('#wordDifficultyBadge').innerText();
  assert.match(shooterFullBadge, /完整挑战/, 'word shooter should update the HUD badge after switching to full');
  assert.match(shooterFullBadge, /12词.*4架/, 'word shooter full badge should summarize the tuned challenge');
  await page.waitForFunction(() => document.querySelector('#wordDifficultyBadge')?.classList.contains('is-pulsing'), null, { timeout: 2000 });
  await page.reload({ waitUntil: 'networkidle' });
  await openGame(page, 'word-shooter');
  const restoredWordSettings = await page.evaluate(() => ({
    pack: window.LearningArcadePrototype.wordPack(),
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    packLabels: [...document.querySelectorAll('#wordPackSwitch .difficulty-chip.is-active')].map(node => node.textContent.trim()),
    difficultyLabels: [...document.querySelectorAll('#wordDifficultySwitch .difficulty-chip.is-active')].map(node => node.textContent.trim())
  }));
  assert.equal(restoredWordSettings.pack.current, 'minecraft', 'word shooter should restore the selected vocab pack after reload');
  assert.equal(restoredWordSettings.difficulty.current, 'full', 'word shooter should restore the selected difficulty after reload');
  assert.equal(restoredWordSettings.packLabels.length, 1, 'restored vocab pack should visibly select one pack after reload');
  assert.match(restoredWordSettings.packLabels[0], /Minecraft\s*514/, 'restored vocab pack should be visibly selected with its word count after reload');
  assert.deepEqual(restoredWordSettings.difficultyLabels, ['完整'], 'restored difficulty should be visibly selected after reload');
  await page.locator('#wordShooterSettings summary').click();
  assert.match(await page.locator('#wordSettingsReset').innerText(), /默认/, 'word shooter should expose a reset-to-default settings action');
  await page.dispatchEvent('#wordSettingsReset', 'click');
  await page.waitForFunction(() => {
    return window.LearningArcadePrototype.wordPack().current === 'minecraft'
      && window.LearningArcadePrototype.wordDifficulty().current === 'basic';
  });
  await page.reload({ waitUntil: 'networkidle' });
  const resetWordSettings = await page.evaluate(() => ({
    pack: window.LearningArcadePrototype.wordPack().current,
    difficulty: window.LearningArcadePrototype.wordDifficulty().current
  }));
  assert.deepEqual(resetWordSettings, { pack: 'minecraft', difficulty: 'basic' }, 'reset settings should persist the default word shooter setup after reload');
  await returnHome(page);

  await openGame(page, 'word-cannon');
  await page.dispatchEvent('#cannonDifficultySwitch [data-word-difficulty="basic"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.wordDifficulty().current === 'basic');
  const cannonBasic = await page.evaluate(() => ({
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    hanziPack: window.LearningArcadePrototype.hanziPack(),
    cannon: window.LearningArcadePrototype.wordCannon(),
    activeLabels: [...document.querySelectorAll('#cannonDifficultySwitch .difficulty-chip.is-active')].map(node => node.textContent.trim()),
    activePackLabels: [...document.querySelectorAll('#cannonPackSwitch .difficulty-chip.is-active')].map(node => node.textContent.trim()),
    packHint: document.getElementById('cannonPackHint').textContent.trim(),
    targetWords: window.LearningArcadePrototype.wordCannon().targets.map(target => target.word),
    targetChars: window.LearningArcadePrototype.wordCannon().targets.map(target => target.char),
    prompt: document.getElementById('cannonPromptChinese').textContent.trim()
  }));
  assert.equal(cannonBasic.difficulty.current, 'basic', 'pinyin racing should share the selected basic difficulty');
  assert.equal(cannonBasic.hanziPack.current, 'kindergarten-hanzi', 'pinyin racing should default to the lightest hanzi starter pack');
  assert.equal(cannonBasic.activePackLabels.length, 1, 'pinyin racing should visibly select only one hanzi pack');
  assert.match(cannonBasic.activePackLabels[0], /认汉字\s*\d+/, 'pinyin racing should visibly highlight the starter hanzi pack');
  assert.match(cannonBasic.packHint, /适合第一次玩/, 'pinyin racing should show a parent-friendly starter hint');
  assert.ok(cannonBasic.hanziPack.packs.some(pack => pack.id === 'kindergarten-pinyin' && pack.count > 50), 'pinyin racing should expose a pinyin starter pack');
  assert.ok(cannonBasic.hanziPack.packs.some(pack => pack.id === 'bridge-hanzi' && /幼小衔接/.test(pack.title) && pack.count > 50), 'pinyin racing should expose a parent-friendly bridge pack');
  assert.ok(cannonBasic.hanziPack.packs.some(pack => pack.id === 'grade1-ready' && /一年级预备/.test(pack.title) && pack.count > 80), 'pinyin racing should expose a grade-1 preparation pack');
  assert.deepEqual(cannonBasic.activeLabels, ['基础'], 'pinyin racing should highlight the basic difficulty chip');
  assert.ok(cannonBasic.targetWords.length > 0, 'pinyin racing should still spawn option cards after difficulty switches');
  assert.ok(cannonBasic.cannon.targets.every(target => target.pinyin && target.word && target.char), 'pinyin racing should use pinyin option cards instead of English vocab cards');
  assert.equal(cannonBasic.targetWords.length, 3, 'basic pinyin racing should spawn three visible lane cards');
  assert.equal(cannonBasic.cannon.targets.filter(target => target.correct).length, 1, 'each pinyin racing wave should have one correct card');
  assert.ok(cannonBasic.targetWords.every(word => /^[a-z]+$/.test(word)), 'pinyin racing should show lowercase pinyin targets');
  assert.ok(cannonBasic.targetChars.every(char => /[\u4e00-\u9fff]/.test(char)), 'pinyin racing should pair each target with a hanzi character');
  assert.ok(/[\u4e00-\u9fff]/.test(cannonBasic.prompt), 'pinyin racing HUD should prompt with a hanzi character');
  assert.equal(cannonBasic.cannon.roundGoal, 8, 'basic pinyin racing should use a very short 8-word round');
  assert.equal(cannonBasic.cannon.stageGoal, 20, 'basic pinyin racing should not switch maps inside an 8-card round');
  assert.equal(cannonBasic.cannon.difficulty.missLimit, 99, 'basic pinyin racing should avoid ending the round because a few road signs slipped by');
  const cannonBasicBadge = await page.locator('#cannonDifficultyBadge').innerText();
  assert.match(cannonBasicBadge, /基础训练/, 'pinyin racing should explain the selected basic difficulty in the HUD badge');
  assert.match(cannonBasicBadge, /认汉字\s*\d+卡/, 'pinyin racing HUD badge should show the active hanzi pack and card count');
  assert.match(cannonBasicBadge, /8词.*3车道/, 'pinyin racing basic badge should summarize the lighter round length and lane count');

  await page.dispatchEvent('#cannonPackSwitch [data-hanzi-pack="kindergarten-pinyin"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.hanziPack().current === 'kindergarten-pinyin');
  const cannonPinyinPack = await page.evaluate(() => ({
    hanziPack: window.LearningArcadePrototype.hanziPack(),
    cannon: window.LearningArcadePrototype.wordCannon(),
    activePackLabels: [...document.querySelectorAll('#cannonPackSwitch .difficulty-chip.is-active')].map(node => node.textContent.trim()),
    packHint: document.getElementById('cannonPackHint').textContent.trim()
  }));
  assert.equal(cannonPinyinPack.activePackLabels.length, 1, 'switching hanzi pack should still keep only one active pack chip');
  assert.match(cannonPinyinPack.activePackLabels[0], /拼音启蒙\s*\d+/, 'pinyin racing should visibly switch to the pinyin starter pack');
  assert.equal(cannonPinyinPack.hanziPack.current, 'kindergarten-pinyin', 'pinyin racing should switch to the pinyin starter pack');
  assert.match(cannonPinyinPack.packHint, /适合会一点拼音/, 'pinyin racing should update the parent hint after switching to the pinyin starter pack');
  assert.ok(cannonPinyinPack.cannon.targets.every(target => /^[a-z]+$/.test(target.word)), 'pinyin starter pack should still produce lowercase pinyin lane cards');

  await page.evaluate(() => { document.getElementById('wordCannonSettings').open = true; });
  await page.dispatchEvent('#cannonSettingsReset', 'click');
  await page.waitForFunction(() => {
    return window.LearningArcadePrototype.hanziPack().current === 'kindergarten-hanzi'
      && window.LearningArcadePrototype.wordDifficulty().current === 'basic';
  });
  const cannonReset = await page.evaluate(() => ({
    hanziPack: window.LearningArcadePrototype.hanziPack(),
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    activePackLabels: [...document.querySelectorAll('#cannonPackSwitch .difficulty-chip.is-active')].map(node => node.textContent.trim()),
    feedback: document.getElementById('cannonFeedback').textContent.trim()
  }));
  assert.equal(cannonReset.activePackLabels.length, 1, 'resetting pinyin racing settings should keep one active starter pack');
  assert.equal(cannonReset.hanziPack.current, 'kindergarten-hanzi', 'resetting pinyin racing settings should restore the starter hanzi pack');
  assert.equal(cannonReset.difficulty.current, 'basic', 'resetting pinyin racing settings should restore the basic difficulty');
  assert.match(cannonReset.feedback, /看汉字|第一次玩/, 'resetting pinyin racing settings should reopen a playable round with visible guidance');

  await page.dispatchEvent('#cannonPackSwitch [data-hanzi-pack="grade1-ready"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.hanziPack().current === 'grade1-ready');
  const cannonGrade1Pack = await page.evaluate(() => ({
    hanziPack: window.LearningArcadePrototype.hanziPack(),
    cannon: window.LearningArcadePrototype.wordCannon(),
    activePackLabels: [...document.querySelectorAll('#cannonPackSwitch .difficulty-chip.is-active')].map(node => node.textContent.trim()),
    packHint: document.getElementById('cannonPackHint').textContent.trim()
  }));
  assert.equal(cannonGrade1Pack.activePackLabels.length, 1, 'grade-1 preparation pack should still keep a single active pack chip');
  assert.match(cannonGrade1Pack.activePackLabels[0], /一年级预备\s*\d+/, 'pinyin racing should visibly switch to the grade-1 preparation pack');
  assert.equal(cannonGrade1Pack.hanziPack.current, 'grade1-ready', 'pinyin racing should switch to the grade-1 preparation pack');
  assert.match(cannonGrade1Pack.packHint, /适合准备上一年级/, 'pinyin racing should show a parent hint for the grade-1 preparation pack');
  assert.ok(cannonGrade1Pack.cannon.targets.every(target => /[\u4e00-\u9fff]/.test(target.char)), 'grade-1 preparation pack should still produce hanzi prompts');

  await page.dispatchEvent('#cannonDifficultySwitch [data-word-difficulty="full"]', 'click');
  await page.waitForFunction(() => window.LearningArcadePrototype.wordDifficulty().current === 'full');
  const cannonFull = await page.evaluate(() => ({
    difficulty: window.LearningArcadePrototype.wordDifficulty(),
    cannon: window.LearningArcadePrototype.wordCannon(),
    targetWords: window.LearningArcadePrototype.wordCannon().targets.map(target => target.word)
  }));
  assert.equal(cannonFull.targetWords.length, 3, 'full pinyin racing should keep three lane cards while increasing speed and length');
  assert.equal(cannonFull.cannon.roundGoal, 24, 'full pinyin racing should keep a longer but child-sized map cycle');
  assert.equal(cannonFull.cannon.stageGoal, 20, 'full pinyin racing should stay on one track for about 20 correct cards before switching');
  assert.equal(cannonFull.cannon.difficulty.missLimit, 3, 'full pinyin racing can keep the arcade fail limit');
  assert.ok(
    cannonFull.cannon.difficulty.speedMultiplier > cannonBasic.cannon.difficulty.speedMultiplier,
    'full pinyin racing road signs should move faster than basic'
  );
  const cannonFullBadge = await page.locator('#cannonDifficultyBadge').innerText();
  assert.match(cannonFullBadge, /完整挑战/, 'pinyin racing should update the HUD badge after switching to full');
  assert.match(cannonFullBadge, /24词.*3车道/, 'pinyin racing full badge should summarize the tuned challenge');
  await page.waitForFunction(() => document.querySelector('#cannonDifficultyBadge')?.classList.contains('is-pulsing'), null, { timeout: 2000 });
  assert.deepEqual(
    await page.evaluate(() => window.LearningArcadePrototype.wordDifficulty().lastCue),
    { gameId: 'word-cannon', level: 'full' },
    'pinyin racing should record the latest difficulty cue for switch feedback'
  );
  await returnHome(page);
}

async function collectLayoutMetrics(page, gameId) {
  return page.evaluate(gid => {
    const doc = document.documentElement;
    const body = document.body;
    const screen = document.getElementById('gameScreen');
    const panels = {
      'word-shooter': document.getElementById('wordShooter'),
      'word-cannon': document.getElementById('wordCannon'),
      'pinyin-snake': document.getElementById('pinyinSnake'),
    };
    const panel = panels[gid];
    const screenRect = screen.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const metrics = {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: doc.scrollWidth > window.innerWidth + 1 || body.scrollWidth > window.innerWidth + 1,
      overflowY: doc.scrollHeight > window.innerHeight + 1 || body.scrollHeight > window.innerHeight + 1,
      panelRect: { x: panelRect.x, y: panelRect.y, w: panelRect.width, h: panelRect.height },
      screenRect: { x: screenRect.x, y: screenRect.y, w: screenRect.width, h: screenRect.height }
    };
    if (gid === 'word-shooter') {
      const arenaRect = document.getElementById('typingArena').getBoundingClientRect();
      const panelRectForRatio = panel.getBoundingClientRect();
      const settings = document.getElementById('wordShooterSettings');
      const settingsRect = settings.getBoundingClientRect();
      const gunRect = document.getElementById('typingGun').getBoundingClientRect();
      const enemies = [...document.querySelectorAll('.typing-enemy')].map(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      });
      metrics.arenaRect = { x: arenaRect.x, y: arenaRect.y, w: arenaRect.width, h: arenaRect.height };
      metrics.arenaHeightRatio = arenaRect.height / panelRectForRatio.height;
      metrics.settingsRect = { x: settingsRect.x, y: settingsRect.y, w: settingsRect.width, h: settingsRect.height };
      metrics.gunRect = { x: gunRect.x, y: gunRect.y, w: gunRect.width, h: gunRect.height };
      metrics.enemyRects = enemies;
    }
    if (gid === 'pinyin-snake') {
      const snakeStageRect = document.getElementById('snakeReferenceStage').getBoundingClientRect();
      const boardRect = document.getElementById('snakeBoard').getBoundingClientRect();
      metrics.snakeStageRect = { x: snakeStageRect.x, y: snakeStageRect.y, w: snakeStageRect.width, h: snakeStageRect.height };
      metrics.boardRect = { x: boardRect.x, y: boardRect.y, w: boardRect.width, h: boardRect.height };
    }
    if (gid === 'word-cannon') {
      const stageRect = document.getElementById('cannonStage').getBoundingClientRect();
      metrics.stageRect = { x: stageRect.x, y: stageRect.y, w: stageRect.width, h: stageRect.height };
    }
    return metrics;
  }, gameId);
}

function assertWithinViewport(label, rect, viewport) {
  const detail = `rect=${JSON.stringify(rect)} viewport=${JSON.stringify(viewport)}`;
  assert.ok(rect.w > 0 && rect.h > 0, `${label} should have visible size (${detail})`);
  assert.ok(rect.x >= -1 && rect.y >= -1, `${label} should start within the viewport (${detail})`);
  assert.ok(rect.x + rect.w <= viewport.w + 1, `${label} should not overflow horizontally (${detail})`);
  assert.ok(rect.y + rect.h <= viewport.h + 1, `${label} should not overflow vertically (${detail})`);
}

async function runResponsiveChecks(browser, baseUrl) {
  const viewportCases = [
    { width: 844, height: 390 },
    { width: 390, height: 844 }
  ];

  for (const viewport of viewportCases) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(5000);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    for (const gameId of ['word-shooter', 'word-cannon', 'pinyin-snake']) {
      await openGame(page, gameId);
      const metrics = await collectLayoutMetrics(page, gameId);
      assert.equal(metrics.overflowX, false, `${gameId} should not overflow horizontally at ${viewport.width}x${viewport.height}`);
      assert.equal(metrics.overflowY, false, `${gameId} should not overflow vertically at ${viewport.width}x${viewport.height}`);
      assertWithinViewport(`${gameId} panel`, metrics.panelRect, metrics.viewport);
      if (metrics.arenaRect) {
        assertWithinViewport(`${gameId} arena`, metrics.arenaRect, metrics.viewport);
        assert.ok(
          metrics.arenaHeightRatio >= 0.68,
          `word shooter arena should use most of the full-screen panel instead of leaving a large top gap: ${JSON.stringify(metrics)}`
        );
        assert.ok(
          metrics.settingsRect.x + metrics.settingsRect.w > metrics.viewport.w * 0.9 && metrics.settingsRect.y < metrics.viewport.h * 0.18,
          `word shooter settings should live in the upper-right corner: ${JSON.stringify(metrics.settingsRect)}`
        );
        assert.ok(
          Math.abs((metrics.gunRect.y + metrics.gunRect.h / 2) - (metrics.arenaRect.y + metrics.arenaRect.h / 2)) <= metrics.arenaRect.h * 0.18,
          `word shooter player ship should sit around the left-middle of the arena: ${JSON.stringify(metrics.gunRect)} arena=${JSON.stringify(metrics.arenaRect)}`
        );
        assert.ok(
          metrics.gunRect.x < metrics.arenaRect.x + metrics.arenaRect.w * 0.16,
          `word shooter player ship should stay on the left side: ${JSON.stringify(metrics.gunRect)} arena=${JSON.stringify(metrics.arenaRect)}`
        );
        assert.ok(
          metrics.enemyRects.every(rect => rect.x > metrics.gunRect.x + metrics.gunRect.w),
          `word shooter enemy fighters should approach from the right side of the player ship: ${JSON.stringify(metrics.enemyRects)} gun=${JSON.stringify(metrics.gunRect)}`
        );
      }
      if (metrics.boardRect) {
        assertWithinViewport(`${gameId} board`, metrics.boardRect, metrics.viewport);
      }
      if (metrics.snakeStageRect) {
        assertWithinViewport(`${gameId} full-screen stage`, metrics.snakeStageRect, metrics.viewport);
        const isLandscape = viewport.width > viewport.height;
        const minStageWidthRatio = isLandscape ? 0.78 : 0.9;
        const minStageHeightRatio = isLandscape ? 0.58 : 0.48;
        const minBoardRatio = isLandscape ? 0.52 : 0.78;
        assert.ok(
          metrics.snakeStageRect.w >= metrics.viewport.w * minStageWidthRatio,
          `pinyin snake stage should feel full-screen wide at ${viewport.width}x${viewport.height}: ${JSON.stringify(metrics.snakeStageRect)}`
        );
        assert.ok(
          metrics.snakeStageRect.h >= metrics.viewport.h * minStageHeightRatio,
          `pinyin snake stage should feel full-screen tall at ${viewport.width}x${viewport.height}: ${JSON.stringify(metrics.snakeStageRect)}`
        );
        assert.ok(
          metrics.boardRect.w >= Math.min(metrics.viewport.w, metrics.viewport.h) * minBoardRatio,
          `pinyin snake board should stay large inside the full-screen stage at ${viewport.width}x${viewport.height}: ${JSON.stringify(metrics.boardRect)}`
        );
      }
      if (metrics.stageRect) {
        assertWithinViewport(`${gameId} stage`, metrics.stageRect, metrics.viewport);
      }
      if (viewport.width === 844 && viewport.height === 390) {
        await page.screenshot({
          path: path.join(screenshotDir, `responsive-${gameId}-844x390.png`),
          fullPage: true
        });
      }
      await returnHome(page);
    }
    await page.close();
  }
}

function assertNoConsoleNoise(messages) {
  const noisy = messages.filter(message => {
    if (message.type === 'pageerror') return true;
    if (message.type === 'error') return true;
    return message.type === 'warning' || message.type === 'warn';
  });
  assert.deepEqual(noisy, [], `browser console should stay clean during smoke run: ${JSON.stringify(noisy, null, 2)}`);
}

async function main() {
  const { chromium } = requirePlaywright();
  const server = createStaticServer(repoRoot);
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}/${prototypePath}`;
  const browser = await chromium.launch(browserLaunchOpts({ args: ['--disable-gpu', '--mute-audio'] }));
  const consoleMessages = [];
  const networkProblems = [];
  browser.on('disconnected', () => {
    networkProblems.push({ type: 'browser-disconnected' });
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(5000);
    attachConsoleCollector(page, consoleMessages);
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText || '';
      if (failure !== 'net::ERR_ABORTED') networkProblems.push({ type: 'requestfailed', url: request.url(), failure });
    });
    page.on('response', response => {
      if (response.status() >= 400) networkProblems.push({ type: 'http', status: response.status(), url: response.url() });
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const shooterCardText = await page.locator('[data-game="word-shooter"]').innerText();
    const cannonCardText = await page.locator('[data-game="word-cannon"]').innerText();
    const snakeCardText = await page.locator('[data-game="pinyin-snake"]').innerText();
    assert.match(shooterCardText, /熟悉字母/, 'word shooter home card should explain that it is the letter-key warmup');
    assert.match(cannonCardText, /拼音赛车/, 'home card should clearly separate pinyin racing from English word shooter');
    assert.match(cannonCardText, /认汉字/, 'pinyin racing home card should hint at the easiest starter pack');
    assert.match(snakeCardText, /方向键/, 'snake home card should position itself as a direction-key warmup');

    await runWordShooterRound(page);
    await runSnakeFinishHome(page);
    await runWordCannonRound(page);
    await runDifficultySwitchChecks(page);
    await page.close();

    const responsiveProbe = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    attachConsoleCollector(responsiveProbe, consoleMessages);
    responsiveProbe.on('requestfailed', request => {
      const failure = request.failure()?.errorText || '';
      if (failure !== 'net::ERR_ABORTED') networkProblems.push({ type: 'requestfailed', url: request.url(), failure });
    });
    responsiveProbe.on('response', response => {
      if (response.status() >= 400) networkProblems.push({ type: 'http', status: response.status(), url: response.url() });
    });
    await responsiveProbe.goto(baseUrl, { waitUntil: 'networkidle' });
    await responsiveProbe.close();

    await runResponsiveChecks(browser, baseUrl);
    assertNoConsoleNoise(consoleMessages);

    console.log('PASS - full prototype smoke covers gameplay rounds, summary flow, responsive layout and clean console output');
  } finally {
    if (networkProblems.length || server.requestProblems.length) {
      console.error(`Smoke network diagnostics: ${JSON.stringify({ browser: networkProblems, server: server.requestProblems }, null, 2)}`);
    }
    await browser.close();
    await closeStaticServer(server);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
