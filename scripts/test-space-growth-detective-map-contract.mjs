import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(root, 'data', 'story-packs', '03-space-growth-detective');
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'manifest.json'), 'utf8'));

assert.equal(manifest.id, 'space-growth-detective');
assert.equal(manifest.runtime, 'explore-story-map');
assert.equal(manifest.map?.background, 'assets/story/space-growth-detective/map.webp');
assert.equal(manifest.map?.nodes?.length, 5, 'the second story has five map nodes');
assert.equal(manifest.collectibles?.cards?.length, 5, 'the second story has five story cards');
assert.equal(manifest.collectibles?.badges?.length, 5, 'the second story has five badges');

const nodesById = new Map(manifest.map.nodes.map((node) => [node.caseId, node]));
for (const [index, caseId] of manifest.caseIds.entries()) {
  const file = path.join(packRoot, 'cases', `${caseId}.json`);
  const story = JSON.parse(fs.readFileSync(file, 'utf8'));
  const node = nodesById.get(caseId);
  assert.ok(node, `${caseId}: map node is declared`);
  assert.equal(node.order, index + 1, `${caseId}: map order`);
  assert.equal(story.node?.caseId, caseId, `${caseId}: node identity`);
  assert.ok(/^assets\/story\/space-growth-detective\/nodes\/.+\.webp$/.test(story.node.image), `${caseId}: node image`);
  assert.ok(story.battle?.sceneId, `${caseId}: battle scene id`);
  assert.ok(story.battle?.monster?.id, `${caseId}: battle monster id`);
  assert.ok(Number(story.battle?.monster?.hp) > 0, `${caseId}: battle monster hp`);
  assert.ok(Number(story.battle?.monster?.atk) > 0, `${caseId}: battle monster attack`);
  assert.ok(Number(story.rewards?.growthPoints) > 0, `${caseId}: growth point reward`);
  assert.ok(Number(story.rewards?.petExp) > 0, `${caseId}: pet exp reward`);
  assert.ok(story.rewards?.cardId && story.rewards?.badgeId, `${caseId}: collectible reward ids`);
}

console.log(`PASS space growth detective map contract: ${manifest.map.nodes.length} nodes`);
