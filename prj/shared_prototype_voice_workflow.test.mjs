import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.join(dir, 'prototype-voice-workflow');
const configPath = path.join(workflowDir, 'sources.json');
const runnerPath = path.join(workflowDir, 'generate_prototype_voice_assets.py');

assert.ok(fs.existsSync(configPath), 'shared prototype voice source config should exist');
assert.ok(fs.existsSync(runnerPath), 'shared prototype voice generator should exist');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
assert.ok(Array.isArray(config.sources), 'shared voice config should contain sources');

const wordMemory = config.sources.find(source => source.id === 'word-memory-topdown');
const pinyinStarScout = config.sources.find(source => source.id === 'pinyin-star-scout');

assert.ok(wordMemory, 'shared voice config should include the word memory prototype');
assert.ok(pinyinStarScout, 'shared voice config should include the pinyin star scout prototype');

assert.equal(wordMemory.kind, 'word-memory-cards', 'word memory source should use word-memory-cards kind');
assert.equal(pinyinStarScout.kind, 'hanzi-questions', 'pinyin star scout source should use hanzi-questions kind');
assert.ok(Array.isArray(wordMemory.fields) && wordMemory.fields.includes('word') && wordMemory.fields.includes('translation'), 'word memory source should list word and translation fields');
assert.ok(Array.isArray(pinyinStarScout.fields) && pinyinStarScout.fields.includes('char') && pinyinStarScout.fields.includes('pinyin') && pinyinStarScout.fields.includes('example'), 'pinyin source should list char, pinyin, and example fields');
assert.ok(typeof pinyinStarScout.limit === 'number' && pinyinStarScout.limit > 0, 'pinyin source should declare a practical generation limit');

const runnerSource = fs.readFileSync(runnerPath, 'utf8');
assert.match(runnerSource, /--source/, 'shared voice generator should accept a source selector');
assert.match(runnerSource, /sources\.json/, 'shared voice generator should read the shared config');
assert.match(runnerSource, /manifest\.json/, 'shared voice generator should write per-prototype manifests');

console.log('PASS - shared prototype voice workflow contract');
