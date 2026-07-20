import assert from 'node:assert/strict';
import fs from 'node:fs';

const smokePath = 'prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs';
const source = fs.readFileSync(smokePath, 'utf8');
const prototypeHtml = fs.readFileSync('prj/学习机玩法原型/index.html', 'utf8');

assert.match(source, /browserLaunchOpts|PLAYWRIGHT_BROWSER(?:_PATH)?/, 'prototype smoke should honor the shared Playwright browser path override');
for (const scriptPath of [
  '../../data/vocab/单词库_分级/06_汉字/幼儿园汉字.js',
  '../../data/vocab/单词库_分级/07_拼音/常用拼音.js',
  '../../data/vocab/单词库_分级/08_幼小衔接/幼小衔接总词库.js'
]) {
  assert.match(prototypeHtml, new RegExp(scriptPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `prototype should load ${scriptPath} before game.js over HTTP and file URLs`);
}
console.log('prototype browser path contract: PASS');
