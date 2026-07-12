import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const leaf = fs.readFileSync(path.join(root, 'app', 'playground', 'typing-defense', 'index.html'), 'utf8');

assert.match(app, /function resolveTypingDefenseEmbedSrc\(\)/, 'typing defense should resolve a runtime source');
assert.match(app, /function isLocalDevelopmentHost\(\)/, 'typing defense should distinguish local development from published Pages');
assert.match(app, /if \(isLocalDevelopmentHost\(\)\) return Promise\.resolve\(sourceSrc\);/, 'typing defense should use the source game directly in local development');
assert.doesNotMatch(app, /fetch\(runtimeSrc, \{ method: 'HEAD' \}\)/, 'typing defense must not create a local 404 probe before loading the source game');
assert.match(app, /typingDefenseEmbedSrcPromise = Promise\.resolve\(runtimeSrc\);/, 'typing defense should use the assembled runtime in published Pages');
assert.match(app, /frame\.dataset\.loading/, 'typing defense should prevent duplicate iframe loading');
assert.match(loader, /function closeCardArenaEntry\(\)/, 'card arena should have a dedicated close flow');
assert.match(loader, /card-arena-shell-active/, 'card arena should activate an immersive shell');
assert.match(html, /id="playgroundArenaShellBar"/, 'page should expose the card arena shell bar');
assert.match(css, /body\.card-arena-shell-active/, 'styles should hide unrelated app chrome during card arena play');
assert.match(leaf, /route=%2Fapp%2Fplayground%2Ftyping-defense/, 'typing defense leaf should restore the app route');

console.log('PASS playground entry shell contract');
