import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(root, 'data', 'story-packs', '04-pixel-dialogue-story');
const manifestPath = path.join(packRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const audioManifestPath = path.join(packRoot, 'audio-manifest.json');
assert.ok(fs.existsSync(audioManifestPath), 'audio manifest exists');
const audioManifest = JSON.parse(fs.readFileSync(audioManifestPath, 'utf8'));
const engine = fs.readFileSync(path.join(root, 'js', 'pixel-story-engine.js'), 'utf8');
const map = fs.readFileSync(path.join(root, 'js', 'pixel-story-map.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const storyPage = fs.readFileSync(path.join(root, 'js', 'pixel-story-page.js'), 'utf8');
const keys = fs.readFileSync(path.join(root, 'docs_project', 'data-contracts', 'localstorage-keys.md'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'pixel-story.css'), 'utf8');

assert.equal(manifest.id, 'pixel-dialogue-story');
assert.equal(manifest.version, '20260713-v2');
assert.equal(manifest.runtime, 'pixel-dialogue-story');
assert.equal(manifest.active, true);
assert.equal(manifest.title, '像素星际漫游：宠物汉字大冒险');
assert.equal(manifest.audience, '幼小衔接');
assert.equal(manifest.ageRange, '5-6');
assert.deepEqual(manifest.chapters, [
  'ch01-moon-station',
  'ch02-cloud-relay',
  'ch03-star-dust-dock',
  'ch04-twin-star-bridge',
]);
assert.equal(manifest.map.nodes.length, 4);
assert.ok(Object.keys(manifest.characters).length >= 6, 'manifest declares narrator, child, pet, and NPC voices');
assert.ok(manifest.map.background && fs.existsSync(path.join(root, manifest.map.background)), 'v2 map background exists');
for (const node of manifest.map.nodes) assert.ok(node.icon && fs.existsSync(path.join(root, node.icon)), `${node.chapterId}: v2 map icon exists`);
for (const character of Object.values(manifest.characters)) {
  if (character.sprite) assert.ok(fs.existsSync(path.join(root, character.sprite)), `${character.id}: generated sprite exists`);
}
assert.equal(audioManifest.storyId, manifest.id);
assert.equal(audioManifest.status, 'complete', 'all fixed story lines have generated audio');
assert.equal(audioManifest.generatedLines, audioManifest.totalLines);
assert.equal((audioManifest.failures || []).length, 0);
for (const entry of Object.values(audioManifest.entries || {})) {
  assert.ok(entry.file && fs.existsSync(path.join(root, entry.file)), `audio file exists: ${entry.file}`);
}

const learningTypes = new Set(['hanzi', 'word', 'math', 'comprehensive']);
for (const chapterId of manifest.chapters) {
  const chapterPath = path.join(packRoot, 'chapters', `${chapterId}.json`);
  assert.ok(fs.existsSync(chapterPath), `${chapterId}: chapter JSON exists`);
  const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
  assert.equal(chapter.chapterId, chapterId);
    assert.ok(Array.isArray(chapter.scenes) && chapter.scenes.length > 0, `${chapterId}: scenes`);

  for (const scene of chapter.scenes) {
    assert.ok(scene.sceneId && Array.isArray(scene.lines), `${chapterId}: valid scene`);
    assert.ok(scene.background && fs.existsSync(path.join(root, scene.background)), `${chapterId}/${scene.sceneId}: v2 background exists`);
    for (const line of scene.lines) {
      assert.ok(['narration', 'dialogue', 'choice'].includes(line.type), `${chapterId}: known line type`);
      const lineText = line.type === 'choice' ? line.prompt : line.text;
      assert.ok(typeof lineText === 'string' && lineText.length > 0, `${chapterId}: line text`);
      if (line.type === 'choice') {
        assert.ok(learningTypes.has(line.learningType), `${chapterId}: learning type`);
        assert.ok(Array.isArray(line.options) && line.options.length >= 2, `${chapterId}: choice options`);
        assert.equal(line.options.filter((option) => option.isCorrect === true).length, 1, `${chapterId}: one correct option`);
        assert.ok(line.options.every((option) => option.feedback), `${chapterId}: choice feedback`);
      }
    }
  }
}

assert.match(runtime, /pixel-story-map\.js/);
assert.match(runtime, /pixel-story-engine\.js/);
assert.match(runtime, /css\/pixel-story\.css/);
assert.match(engine, /resolvePetBankAssetUrl/);
assert.match(map, /resolvePetBankAssetUrl/);
assert.match(engine, /audio-manifest\.json/);
assert.match(engine, /playStoryAudio/);
assert.match(fs.readFileSync(path.join(root, 'js', 'voice.js'), 'utf8'), /playStoryAudio/);
assert.match(keys, /`petbank_pixel_story_progress_v1`/);

// Progress writes must merge the existing chapter map instead of dropping other chapters.
assert.doesNotMatch(engine, /var p = \{\};[\s\S]{0,80}p\.chapters\[currentChapter\.chapterId\]/, 'chapter completion must preserve existing chapters');
assert.match(engine, /readProgress\(\)[\s\S]{0,220}chapters\[currentChapter\.chapterId\]/, 'chapter completion merges the existing progress');

// Choice feedback must use the clicked button rather than an undefined option property.
assert.doesNotMatch(engine, /chosen\.el\.className/, 'choice handling must not use an undefined option element');
assert.match(engine, /selectedButton\.className/);
assert.match(engine, /ProfileManager[\s\S]{0,100}getActiveId/);
assert.doesNotMatch(engine, /getCurrentProfileId|getCurrentProfile/, 'profile reward scope uses the real ProfileManager API');
assert.match(css, /pixel-story-choice-btn\.correct-answer/);
assert.match(storyPage, /shell\.dataset\.mode = 'adventure'/);
assert.match(storyPage, /SpaceGrowthDetective\.render\('adventureContainer'\)/);

console.log(`PASS pixel story contract: ${manifest.chapters.length} chapters`);
