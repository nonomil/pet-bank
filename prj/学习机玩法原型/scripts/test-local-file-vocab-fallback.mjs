import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const prototypeDir = path.resolve(scriptDir, '..');
const indexPath = path.join(prototypeDir, 'index.html');
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
  assert.ok(chromePath, 'Chrome or Edge executable should exist for local file smoke tests');
  return chromePath;
}

async function main() {
  assert.ok(fs.existsSync(indexPath), 'learning arcade index.html should exist');
  const { chromium } = requirePlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: findChrome()
  });
  const consoleMessages = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => consoleMessages.push({ type: 'pageerror', text: err.message }));
    await page.goto(pathToFileURL(indexPath).href, { waitUntil: 'load' });
    await page.waitForFunction(() => window.LearningArcadePrototype?.wordPack?.().total > 3000);

    const initialPack = await page.evaluate(() => window.LearningArcadePrototype.wordPack());
    assert.equal(initialPack.total, 3212, 'directly opened index.html should load the full graded vocab script fallback');
    assert.ok(
      initialPack.packs.some(pack => pack.id === 'kindergarten' && pack.count > 100),
      'directly opened index.html should expose the kindergarten vocab pack'
    );

    await page.evaluate(() => window.LearningArcadePrototype.setWordPack('kindergarten'));
    await page.evaluate(() => window.LearningArcadePrototype.openGame('word-shooter'));
    await page.waitForFunction(() => window.LearningArcadePrototype.wordShooter().enemies.length > 0);
    const shooter = await page.evaluate(() => window.LearningArcadePrototype.wordShooter());
    assert.ok(
      shooter.enemies.every(enemy => enemy.sourcePackGroup === 'kindergarten'),
      `direct local file word shooter enemies should come from kindergarten pack: ${JSON.stringify(shooter.enemies)}`
    );
    assert.ok(
      shooter.enemies.some(enemy => !['block', 'world', 'stone'].includes(enemy.word)),
      'direct local file word shooter should not fall back to the three built-in demo words'
    );

    const unexpectedErrors = consoleMessages.filter(message => (
      message.type === 'pageerror'
      || (message.type === 'error' && !/CORS|Fetch API cannot load|URL scheme "file"|origin 'null'/.test(message.text))
    ));
    assert.deepEqual(unexpectedErrors, [], `local file smoke should have no unexpected console errors: ${JSON.stringify(consoleMessages, null, 2)}`);

    console.log('PASS - direct index.html file load uses graded vocab fallback script');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
