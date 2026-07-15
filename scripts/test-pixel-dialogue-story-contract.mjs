import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('data/story-packs/04-pixel-dialogue-story');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const chapterIds = ['ch01-moon-station', 'ch02-cloud-relay', 'ch03-star-dust-dock', 'ch04-twin-star-bridge'];

assert.equal(manifest.id, 'pixel-dialogue-story');
assert.equal(manifest.active, true);
assert.deepEqual(manifest.chapters, chapterIds);
assert.equal(manifest.map.nodes.length, chapterIds.length);
assert.deepEqual(manifest.map.nodes.map((node) => node.chapterId), chapterIds);

for (const chapterId of chapterIds) {
  const file = path.join(root, 'chapters', `${chapterId}.json`);
  assert.ok(fs.existsSync(file), `missing chapter file: ${chapterId}`);
  const chapter = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(chapter.chapterId, chapterId);
  assert.ok(chapter.title);
  assert.ok(Array.isArray(chapter.scenes) && chapter.scenes.length >= 1);

  const lines = chapter.scenes.flatMap((scene) => scene.lines || []);
  assert.ok(lines.some((line) => line.type === 'narration'), `${chapterId}: narration missing`);
  assert.ok(lines.some((line) => line.type === 'dialogue'), `${chapterId}: dialogue missing`);
  const choices = lines.filter((line) => line.type === 'choice');
  assert.ok(choices.length >= 1, `${chapterId}: choice missing`);
  for (const choice of choices) {
    assert.ok(choice.learningType, `${chapterId}: learningType missing`);
    assert.ok(Array.isArray(choice.options) && choice.options.length >= 2);
    assert.ok(choice.options.some((option) => option.isCorrect), `${chapterId}: correct option missing`);
  }
}

const appSource = fs.readFileSync('js/app.js', 'utf8');
assert.match(appSource, /pixel-story-map-slot/);
assert.match(appSource, /function switchExploreToAdventure/);

console.log(`PASS: ${chapterIds.length} pixel dialogue chapters and dual-mode shell contract`);
