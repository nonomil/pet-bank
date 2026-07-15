import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'tmp', 'pixel-story-published-artifact');
fs.rmSync(outDir, { recursive: true, force: true });
const result = spawnSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', outDir], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe'
});
assert.equal(result.status, 0, result.stderr || result.stdout);

const assetRoot = path.join(outDir, 'assets', 'story', 'pixel-dialogue');
const v2AssetRoot = path.join(outDir, 'assets', 'story', 'pixel-dialogue-v2');
const worldsAssetRoot = path.join(outDir, 'assets', 'story', 'pixel-worlds-v1');
const pngs = [];
const v2Pngs = [];
const worldsPngs = [];
const worldsWebps = [];
const mp3s = [];
function walk(dir, pngList = pngs) {
  assert.ok(fs.existsSync(dir), `artifact asset directory exists: ${dir}`);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, pngList);
    else if (entry.name.endsWith('.png')) pngList.push(file);
    else if (entry.name.endsWith('.webp')) worldsWebps.push(file);
    else if (entry.name.endsWith('.mp3')) mp3s.push(file);
  }
}
walk(assetRoot);
walk(v2AssetRoot, v2Pngs);
walk(worldsAssetRoot, worldsPngs);
assert.equal(pngs.length, 0, `rejected story PNGs must stay out of the Pages artifact, got ${pngs.length}`);
assert.equal(v2Pngs.length, 14, `expected 14 accepted v2 story PNGs in Pages artifact, got ${v2Pngs.length}`);
assert.equal(worldsPngs.length, 4, `expected 4 accepted pixel worlds map PNGs in Pages artifact, got ${worldsPngs.length}`);
assert.equal(worldsWebps.length, 272, `expected 80 scenes + 80 props + 32 character frames + 80 route icons, got ${worldsWebps.length}`);
assert.equal(mp3s.length, 37, `expected 37 story MP3s in Pages artifact, got ${mp3s.length}`);
assert.ok(fs.existsSync(path.join(outDir, 'data', 'story-packs', '04-pixel-dialogue-story', 'audio-manifest.json')));
assert.ok(fs.existsSync(path.join(outDir, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json')));
assert.ok(fs.existsSync(path.join(outDir, 'js', 'pixel-story-map.js')));
assert.ok(fs.existsSync(path.join(outDir, 'js', 'pixel-story-engine.js')));
assert.ok(fs.existsSync(path.join(outDir, 'css', 'pixel-story.css')));
const levelDir = path.join(outDir, 'data', 'story-packs', '05-pixel-worlds-story', 'levels');
assert.equal(fs.readdirSync(levelDir).filter((file) => file.endsWith('.json')).length, 80, 'all 80 paged story levels are published');
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`PASS pixel story published artifact: ${v2Pngs.length} v2 PNG, ${mp3s.length} MP3`);
