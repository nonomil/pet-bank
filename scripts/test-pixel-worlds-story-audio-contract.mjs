import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packRoot = path.join(repoRoot, 'data', 'story-packs', '05-pixel-worlds-story');
const levelsRoot = path.join(packRoot, 'levels');
const audioManifestPath = path.join(packRoot, 'audio-manifest.json');
const textDocPath = path.join(repoRoot, 'docs', '探索地图故事', '像素世界漫游', '01-80节点台词清单.md');

const nodes = [];
for (const fileName of fs.readdirSync(levelsRoot).filter((name) => name.endsWith('.json')).sort()) {
    const level = JSON.parse(fs.readFileSync(path.join(levelsRoot, fileName), 'utf8'));
    const spokenLines = [];
    for (const scene of level.scenes || []) {
        for (const [lineIndex, line] of (scene.lines || []).entries()) {
            const text = String(line.text || line.prompt || '').trim();
            if (text) spokenLines.push(text);
        }
    }
    nodes.push({ key: level.levelId, text: spokenLines.join('\n'), lineCount: spokenLines.length });
}

assert.equal(nodes.length, 80, 'formal story pack must expose all 80 nodes');
assert.equal(nodes.reduce((sum, node) => sum + node.lineCount, 0), 880, 'formal story pack must expose all 880 readable lines');
assert.ok(fs.existsSync(textDocPath), 'formal story text document is missing');
const textDoc = fs.readFileSync(textDocPath, 'utf8');
assert.equal((textDoc.match(/^## /gm) || []).length, 80, 'text document must list all 80 nodes');

assert.ok(fs.existsSync(audioManifestPath), 'pixel worlds audio manifest is missing');
const audioManifest = JSON.parse(fs.readFileSync(audioManifestPath, 'utf8'));
assert.equal(audioManifest.storyId, 'pixel-worlds-story');
assert.equal(audioManifest.status, 'complete', 'pixel worlds audio generation is incomplete');
assert.equal(audioManifest.totalNodes, nodes.length);
assert.equal(audioManifest.generatedNodes, nodes.length);
assert.equal(audioManifest.totalReadableLines, 880);
assert.equal(audioManifest.engineActual, 'voxcpm2');
assert.equal(audioManifest.lineAudioStatus, 'complete');
assert.equal(audioManifest.lineAudioFormat, 'wav');

for (const node of nodes) {
    const entry = audioManifest.entries?.[node.key];
    assert.ok(entry, `audio entry missing: ${node.key}`);
    assert.equal(entry.text, node.text, `audio text drift: ${node.key}`);
    assert.equal(entry.lineCount, node.lineCount, `audio line count drift: ${node.key}`);
    assert.equal(entry.engineActual, 'voxcpm2', `audio is not VoxCPM2: ${node.key}`);
    const assetPath = path.join(repoRoot, entry.file.replaceAll('/', path.sep));
    assert.ok(fs.existsSync(assetPath), `audio file missing: ${entry.file}`);
    assert.ok(fs.statSync(assetPath).size >= 256, `audio file too small: ${entry.file}`);
    const lineEntries = (entry.scenes || []).flatMap((scene) => scene.lines || []);
    assert.equal(lineEntries.length, node.lineCount, `line audio count drift: ${node.key}`);
    for (const lineEntry of lineEntries) {
        const linePath = path.join(repoRoot, lineEntry.file.replaceAll('/', path.sep));
        assert.ok(fs.existsSync(linePath), `line audio file missing: ${lineEntry.file}`);
        assert.ok(fs.statSync(linePath).size >= 256, `line audio file too small: ${lineEntry.file}`);
        assert.ok(node.text.includes(lineEntry.text), `line audio text is not in source node: ${node.key}`);
    }
}

const mapSource = fs.readFileSync(path.join(repoRoot, 'js', 'pixel-story-map.js'), 'utf8');
const engineSource = fs.readFileSync(path.join(repoRoot, 'js', 'pixel-story-engine.js'), 'utf8');
assert.match(mapSource, /data-chapter/, 'map node must carry its chapter id');
assert.match(mapSource, /enterChapter\(chapterId\)/, 'map node click must enter its story');
assert.match(engineSource, /getLineAudioUrl\(\)/, 'story engine must resolve current line audio');
assert.match(engineSource, /VoiceSystem\.playStoryAudio\(audioUrl, text, voicePreset/, 'story engine must autoplay local line audio');
assert.doesNotMatch(engineSource, /getChapterAudioUrl\(\)/, 'story engine must not autoplay whole-chapter audio');

console.log(`PASS pixel worlds story audio contract: ${nodes.length} nodes / 880 readable lines / VoxCPM2`);
