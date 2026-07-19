import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'scripts', 'runtime-asset-manifests', 'typing-defense.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const providedArtifact = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : null;

function walkFiles(root) {
    const files = [];
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) pending.push(fullPath);
            else if (entry.isFile()) files.push(fullPath);
        }
    }
    return files.sort();
}

function matches(rel, entry) {
    const normalized = String(entry || '').replace(/\\/g, '/').replace(/\/$/, '');
    return rel === normalized || rel.startsWith(`${normalized}/`);
}

assert.equal(manifest.id, 'typing-defense');
assert.equal(manifest.releaseStage, 'runtime-shell');
for (const relative of [...manifest.entry, ...manifest.runtimeFiles]) {
    assert.ok(fs.existsSync(path.join(repoRoot, manifest.packageRoot, relative)), `manifest source is missing: ${relative}`);
}

if (providedArtifact) {
    const artifactRoot = path.join(providedArtifact, manifest.publishRoot);
    assert.ok(fs.existsSync(artifactRoot), 'typing defense runtime root must be published');
    const files = walkFiles(artifactRoot).map((file) => file.slice(`${artifactRoot}${path.sep}`.length).split(path.sep).join('/'));
    assert.ok(files.length > 0, 'typing defense runtime must not be empty');
    for (const relative of files) {
        assert.ok(
            manifest.runtimeFiles.some((file) => matches(relative, file))
                || manifest.runtimePrefixes.some((prefix) => matches(relative, prefix)),
            `typing defense artifact file is outside manifest: ${relative}`
        );
    }
    assert.ok(files.includes('web/index.html'));
    assert.ok(files.includes('web/game.js'));
    assert.equal(files.some((file) => file.startsWith('reference/')), false, 'reference assets must stay out of Pages');
    assert.equal(files.some((file) => file.startsWith('browser-screenshots/')), false, 'browser screenshots must stay out of Pages');
    console.log(`PASS typing defense publish contract: ${providedArtifact}`);
} else {
    console.log('PASS typing defense publish manifest contract');
}
