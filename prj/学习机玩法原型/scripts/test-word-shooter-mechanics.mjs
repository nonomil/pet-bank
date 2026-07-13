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

function createStaticServer() {
  return http.createServer((request, response) => {
    const relativePath = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname)
      .replace(/^\/+/, '') || prototypePath;
    const absolutePath = path.resolve(repoRoot, relativePath);
    if (!absolutePath.startsWith(repoRoot) || !fs.existsSync(absolutePath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const type = absolutePath.endsWith('.html') ? 'text/html; charset=utf-8'
      : absolutePath.endsWith('.css') ? 'text/css; charset=utf-8'
        : absolutePath.endsWith('.json') ? 'application/json; charset=utf-8'
          : 'application/javascript; charset=utf-8';
    response.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(absolutePath).pipe(response);
  });
}

const server = createStaticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/${prototypePath}?game=word-shooter`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.LearningArcadePrototype?.wordShooter));
  await page.evaluate(() => window.LearningArcadePrototype.setWordDifficulty('intermediate'));
  await page.waitForSelector('#wordShooter:not([hidden])');
  await page.evaluate(() => window.LearningArcadePrototype.debugSpawnWordShooterHazard('mine'));
  const mineState = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.ok(mineState.hazards.some(hazard => hazard.type === 'mine'), 'intermediate stage should expose a mine hazard');
  const clearedMine = await page.evaluate(() => window.LearningArcadePrototype.debugClearWordShooterHazard('mine'));
  assert.equal(clearedMine, true, 'a mine should be clearable by a player shot');
  assert.equal((await page.evaluate(() => window.LearningArcadePrototype.wordShooter())).hazards.length, 0, 'cleared mine should leave the arena');

  await page.evaluate(() => window.LearningArcadePrototype.setWordDifficulty('full'));
  await page.evaluate(() => window.LearningArcadePrototype.openGame('word-shooter'));
  await page.evaluate(() => window.LearningArcadePrototype.debugSpawnWordShooterHazard('meteor'));
  const meteorState = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.ok(meteorState.hazards.some(hazard => hazard.type === 'meteor'), 'full stage should expose a falling meteor');
  const bossStart = await page.evaluate(() => window.LearningArcadePrototype.debugActivateWordShooterBoss());
  assert.equal(bossStart.boss.active, true, 'full stage should expose a boss phase');
  assert.equal(bossStart.boss.phase, 'shielded', 'boss should start in its shielded phase');
  const enraged = await page.evaluate(() => window.LearningArcadePrototype.debugDamageWordShooterBoss(2));
  assert.equal(enraged.boss.phase, 'enraged', 'boss should change attack phase after half health');
  const charged = await page.evaluate(() => window.LearningArcadePrototype.debugTriggerWordShooterBossAttack());
  assert.ok(charged.hazards.some(hazard => hazard.type === 'charge' || hazard.type === 'meteor'), 'enraged boss should add a charge or falling attack');
  const beforeHit = charged.shield;
  await page.evaluate(() => window.LearningArcadePrototype.debugHitWordShooterHazard());
  const afterHit = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
  assert.equal(afterHit.shield, beforeHit - 1, 'boss hazard collision should damage the player');
  console.log('PASS - word shooter stage mechanics');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
