import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packRoot = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story');
const iconRoot = path.join(root, 'assets', 'story', 'pixel-worlds-v1', 'icons');
const tracks = ['sci-fi', 'forest', 'block', 'detective'];
const expectedByTrack = new Map(tracks.map((track) => [track, new Set()]));
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'manifest.json'), 'utf8'));

for (const track of [...(manifest.worlds || []), ...(manifest.bonusTracks || [])]) {
  for (const node of track.nodes || []) expectedByTrack.get(track.id)?.add(node.levelId);
}

for (const track of tracks) {
  const dir = path.join(iconRoot, track);
  assert.ok(fs.existsSync(dir), `${track}: icon directory exists`);
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.webp')).sort();
  assert.equal(files.length, 20, `${track}: exactly 20 route icons`);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    assert.ok(stat.size > 1000, `${track}/${file}: non-empty webp`);
  }
}

for (const track of [...(manifest.worlds || []), ...(manifest.bonusTracks || [])]) {
  for (const node of track.nodes || []) {
    assert.match(node.icon || '', new RegExp(`^assets/story/pixel-worlds-v1/icons/${track.id}/`), `${node.levelId}: route icon path`);
    assert.ok(fs.existsSync(path.join(root, node.icon)), `${node.levelId}: icon exists`);
  }
}

console.log(`PASS pixel story visual assets contract: ${tracks.length} tracks / ${tracks.length * 20} icons`);
