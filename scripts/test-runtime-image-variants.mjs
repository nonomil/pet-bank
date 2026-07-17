import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'scripts', 'runtime-image-variants.json');
const converterPath = path.join(repoRoot, 'scripts', 'convert-runtime-image-variants.py');

test('runtime image variant manifest is valid and all WebP variants are smaller', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.version, 1);
    assert.ok(config.sets.length >= 3);

    const result = spawnSync('python', [converterPath, '--check'], {
        cwd: repoRoot,
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /checked=\d+/);
    assert.match(result.stdout, /missing=0/);
    assert.match(result.stdout, /larger=0/);
});

test('manifest keeps local source images and uses adjacent WebP variants', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    for (const imageSet of config.sets) {
        assert.ok(imageSet.sourceDir && imageSet.runtimePrefix && imageSet.publishRoot);
        assert.ok(imageSet.include.length > 0);
        assert.ok(['boolean', 'undefined'].includes(typeof imageSet.lossless));
    }
});
