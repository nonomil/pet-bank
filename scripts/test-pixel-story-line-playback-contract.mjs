import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const engine = fs.readFileSync(path.join(root, 'js', 'pixel-story-engine.js'), 'utf8');
const map = fs.readFileSync(path.join(root, 'js', 'pixel-story-map.js'), 'utf8');
const audioManifest = JSON.parse(fs.readFileSync(
  path.join(root, 'data', 'story-packs', '05-pixel-worlds-story', 'audio-manifest.json'),
  'utf8',
));

assert.match(engine, /getLineAudioUrl\(\)/, 'story engine must resolve the current line audio');
assert.doesNotMatch(engine, /getChapterAudioUrl\(\)/, 'story engine must not resolve a whole-chapter audio file');
assert.match(engine, /Array\.isArray\(entry\.scenes\)/, 'story engine must use optional line-level audio entries');
assert.match(engine, /currentSceneIdx.*currentLineIdx/, 'line audio must be selected by scene and line index');
assert.doesNotMatch(map, /audio\/'.*chapterId.*\.wav/, 'map click must not start a whole-chapter WAV');

for (const [chapterId, entry] of Object.entries(audioManifest.entries || {}).slice(0, 3)) {
  if (entry.scenes) {
    const lines = entry.scenes.flatMap((scene) => scene.lines || []);
    assert.equal(lines.length, entry.lineCount, `${chapterId}: line audio count must match readable lines`);
    assert.ok(lines.every((line) => line.file && line.text), `${chapterId}: each line needs file and text`);
    assert.ok(lines.every((line) => line.file.includes('/lines/')), `${chapterId}: line audio must use line-level paths`);
  }
}

console.log('PASS pixel story line playback contract: click advances one text and one audio');
