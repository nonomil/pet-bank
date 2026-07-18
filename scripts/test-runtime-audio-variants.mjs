import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'scripts', 'runtime-audio-variants.json');
const converterPath = path.join(repoRoot, 'scripts', 'convert-runtime-audio-variants.py');

test('runtime audio variant manifest is valid and all Opus variants are smaller', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.version, 1);
    assert.ok(config.sets.length >= 1);
    for (const audioSet of config.sets) {
        assert.ok(audioSet.sourceDir && audioSet.runtimePrefix && audioSet.publishRoot);
        assert.ok(audioSet.include.length > 0);
        assert.equal(audioSet.format, 'OGG');
        assert.equal(audioSet.subtype, 'OPUS');
        assert.equal(audioSet.extension, '.ogg');
    }

    const result = spawnSync('python', [converterPath, '--check'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /checked=11800/);
    assert.match(result.stdout, /missing=0/);
    assert.match(result.stdout, /larger=0/);
});

test('local audio sources remain WAV files beside compressed variants', () => {
    const sourceRoot = path.join(repoRoot, 'assets', 'story', 'pixel-worlds-v1', 'audio');
    const wavs = [];
    const oggs = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.wav')) wavs.push(file);
            else if (entry.name.endsWith('.ogg')) oggs.push(file);
        }
    }
    walk(sourceRoot);
    assert.equal(wavs.length, 960);
    assert.equal(oggs.length, 960);
    assert.ok(wavs.every((file) => fs.statSync(file).size > 256));
    assert.ok(oggs.every((file) => fs.statSync(file).size > 256));

    const narrationRoot = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-narration');
    const narrationMp3 = fs.readdirSync(narrationRoot).filter((file) => file.endsWith('.mp3'));
    const narrationOgg = fs.readdirSync(narrationRoot).filter((file) => file.endsWith('.ogg'));
    assert.equal(narrationMp3.length, 10840);
    assert.equal(narrationOgg.length, 10840);
    assert.ok(narrationOgg.every((file) => fs.statSync(path.join(narrationRoot, file)).size > 256));
});
