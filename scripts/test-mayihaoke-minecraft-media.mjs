import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'media-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.provider, 'mayihaoke');
assert.equal(manifest.route, '/minewords');
assert.equal(manifest.count, 500);
assert.equal(manifest.cards.length, 500);

const paths = new Set();
for (const [index, card] of manifest.cards.entries()) {
  const expected = String(index + 1).padStart(3, '0');
  assert.equal(card.index, expected, `media index mismatch at ${index}`);
  assert.match(card.sourceUrl, new RegExp(`/minewords/${expected}\\.webp$`));
  assert.match(card.path, new RegExp(`^assets/learn/english-vocab/minecraft-reference/card-${expected}\\.webp$`));
  assert.ok(!paths.has(card.path), `duplicate media path: ${card.path}`);
  paths.add(card.path);
  assert.ok(fs.existsSync(path.join(repoRoot, card.path)), `missing local media: ${card.path}`);
  assert.equal(card.width, 512);
  assert.equal(card.height, 384);
}

console.log('mayihaoke Minecraft media: PASS (500 local WebP cards)');
