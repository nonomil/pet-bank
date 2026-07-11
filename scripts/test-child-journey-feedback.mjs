import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const feedback = fs.readFileSync(path.join(root, 'js', 'child-journey-feedback.js'), 'utf8');

assert.match(html, /id="childJourneyFeedback"/, 'page should expose the child journey feedback card');
assert.match(html, /js\/child-journey-feedback\.js/, 'page should load the child journey feedback behavior');
assert.match(html, /switchPage\('pet'\)/, 'feedback card should let children visit their pet');
assert.match(html, /switchPage\('map'\)/, 'feedback card should let children return home');
assert.match(css, /\.child-journey-feedback/, 'styles should include the feedback card');
assert.match(feedback, /window\.toggleTask/, 'feedback should wrap the existing task action');
assert.match(feedback, /wasCompleted/, 'feedback should distinguish new completion from task cancellation');
assert.match(feedback, /childJourneyFeedback/, 'feedback should target the feedback card');
assert.match(feedback, /addEventListener\('message'/, 'feedback should listen for iframe game results');
assert.match(feedback, /petbank-typing-defense/, 'feedback should recognize typing-defense results');
assert.match(feedback, /petbank-word-memory-map/, 'feedback should recognize word-memory results');
assert.match(feedback, /data\.kind !== 'result'/, 'feedback should ignore non-result game events');

console.log('PASS child journey feedback contract');
