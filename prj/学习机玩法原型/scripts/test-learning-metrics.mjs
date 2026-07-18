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
  const baseUrl = `http://127.0.0.1:${server.address().port}/${prototypePath}`;
  await page.goto(`${baseUrl}?game=word-cannon`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#wordCannon:not([hidden]) .cannon-target');

  const initialCannon = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.equal(initialCannon.learning.tasksPresented, 1, 'pinyin racer should register its first learning task');
  assert.equal(initialCannon.learning.voiceAnnounced, 1, 'pinyin racer should expose one voice announcement');
  const wrongTarget = initialCannon.targets.find(target => !target.correct);
  const correctTarget = initialCannon.targets.find(target => target.correct);
  const stageRect = await page.locator('#cannonStage').boundingBox();
  assert.ok(stageRect && wrongTarget && correctTarget, 'pinyin racer should expose wrong and correct targets');
  await page.mouse.click(stageRect.x + stageRect.width * wrongTarget.x / 100, stageRect.y + stageRect.height * 0.72);
  await page.evaluate(() => window.LearningArcadePrototype.tickWordCannonFrame(220, 40));
  const afterWrongCannon = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.equal(afterWrongCannon.learning.retryCount, 1, 'pinyin racer should count a retry after a wrong catch');
  assert.equal(afterWrongCannon.learning.correctChoice, 0, `wrong pinyin catch should not count as a correct choice: ${JSON.stringify({ player: afterWrongCannon.player, targets: afterWrongCannon.targets })}`);

  const retryTarget = afterWrongCannon.targets.find(target => target.correct);
  const retryStageRect = await page.locator('#cannonStage').boundingBox();
  await page.mouse.click(retryStageRect.x + retryStageRect.width * retryTarget.x / 100, retryStageRect.y + retryStageRect.height * 0.72);
  await page.evaluate(() => window.LearningArcadePrototype.tickWordCannonFrame(220, 40));
  const completedCannon = await page.evaluate(() => window.LearningArcadePrototype.wordCannon());
  assert.equal(completedCannon.learning.correctChoice, 1, 'pinyin racer should count the recovered correct choice');
  assert.equal(completedCannon.learning.firstTryAccuracy, 0, 'a retried pinyin task should not count as first-try accuracy');

  await page.goto(`${baseUrl}?game=word-shooter`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#wordShooter:not([hidden]) .typing-enemy');
  await page.evaluate(() => window.LearningArcadePrototype.setWordShooterEnemyFireEnabled(false));
  const initialShooter = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  const targetWord = initialShooter.enemies[0].word;
  const wrongLetter = 'abcdefghijklmnopqrstuvwxyz'.split('').find(letter => (
    !'wasd'.includes(letter) &&
    letter !== targetWord[0] && !initialShooter.enemies.some(enemy => enemy.word[0] === letter)
  ));
  assert.ok(wrongLetter, 'word shooter should have an unassigned wrong letter for the metric probe');
  await page.keyboard.press(wrongLetter);
  const afterWrongShooter = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(afterWrongShooter.learning.wrongLetters, 1, 'word shooter should count a wrong letter');
  for (const letter of targetWord) await page.keyboard.press(letter);
  await page.waitForTimeout(650);
  const completedShooter = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(completedShooter.learning.wordsCompleted, 1, 'word shooter should count the completed word');
  assert.equal(completedShooter.learning.firstTryAccuracy, 0, 'a word with a wrong letter should not count as first-try accuracy');
  assert.ok(completedShooter.learning.letterAccuracy < 1, 'word shooter should expose letter accuracy below 100%');
  assert.ok(completedShooter.learning.voiceAnnounced >= 1, 'word shooter should expose voice announcement count');
  console.log(JSON.stringify({ cannon: completedCannon.learning, shooter: completedShooter.learning }, null, 2));
  console.log('PASS - learning metrics');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
