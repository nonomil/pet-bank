import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'scripts', 'runtime-asset-manifests', 'minecraft-vocab.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const providedArtifact = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : null;
const artifactRoot = providedArtifact || fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-minecraft-vocab-publish-'));

function toPosix(value) {
    return value.split(path.sep).join('/');
}

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

function manifestPathMatches(rel, entry) {
    const normalized = String(entry || '').replace(/\\/g, '/').replace(/\/$/, '');
    return rel === normalized || rel.startsWith(`${normalized}/`);
}

function getAudioFilesFromData(audioSet) {
    const modulePath = path.join(repoRoot, audioSet.includeFromData);
    const module = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
    const sourcePrefix = `${audioSet.sourceDir.replace(/\\/g, '/')}/`;
    const files = new Set();
    for (const card of module.cards || []) {
        for (const value of [card.audio, ...Object.values(card.narrationAudio || {})]) {
            const relative = String(value || '').replace(/\\/g, '/');
            if (relative.startsWith(sourcePrefix)) files.add(relative.slice(sourcePrefix.length));
        }
    }
    return files;
}

function isDeclaredRuntimeAsset(rel) {
    return (manifest.runtimeFiles || []).includes(rel)
        || (manifest.runtimePrefixes || []).some((prefix) => manifestPathMatches(rel, prefix))
        || (manifest.audioSets || []).some((audioSet) => manifestPathMatches(rel, audioSet.runtimePrefix));
}

function assertManifestSource() {
    assert.equal(manifest.id, 'minecraft-vocab');
    assert.equal(manifest.releaseStage, 'lazy-sharded-runtime');
    assert.ok(Array.isArray(manifest.entry) && manifest.entry.includes('js/minecraft-vocab-page.js'));
    assert.ok(manifest.entry.includes('js/minecraft-vocab-exploration-bridge.js'));
    assert.ok(Array.isArray(manifest.data) && !manifest.data.includes('data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json'));
    assert.ok(manifest.runtimeData?.starter?.path);
    assert.equal(manifest.runtimeData?.bands?.length, 6);
    assert.ok(manifest.budgetsMiB?.starter > 0 && manifest.budgetsMiB?.typingView > 0);
    assert.equal(manifest.audioSets[0]?.id, 'starter-narration');
    assert.equal(manifest.audioSets[0]?.includeFromData, 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-starter.json');
    assert.equal(manifest.audioSets[0]?.cardCount, 140);
    assert.equal(manifest.audioSets[0]?.clipsPerCard, 5);
    assert.equal(manifest.externalAudioArtifact?.manifestId, 'minecraft-vocab-audio');
    assert.equal(manifest.externalAudioArtifact?.configKey, 'minecraftAudioBaseUrl');
    assert.equal(manifest.externalAudioArtifact?.clipCount, 10840);
    assert.equal(manifest.externalAudioArtifact?.indexMode, 'selection');
    assert.equal(manifest.externalAudioArtifact?.defaultEnabled, false);
    assert.ok(!manifest.runtimePrefixes.some((prefix) => prefix.endsWith('/minecraft-cards/')));
    assert.ok(manifest.excludedPrefixes.includes('assets/learn/english-vocab/minecraft-reference/'));
    assert.ok(manifest.excludedPrefixes.includes('assets/learn/english-vocab/generated/minecraft-expedition/prompts/'));

    for (const relative of [...manifest.entry, ...manifest.data, ...manifest.runtimeFiles, ...manifest.sourceData]) {
        assert.ok(fs.existsSync(path.join(repoRoot, relative)), `manifest source is missing: ${relative}`);
    }
    for (const prefix of manifest.runtimePrefixes) {
        const directory = path.join(repoRoot, prefix);
        assert.ok(fs.existsSync(directory), `manifest runtime prefix is missing: ${prefix}`);
        assert.ok(walkFiles(directory).length > 0, `manifest runtime prefix is empty: ${prefix}`);
    }
    for (const audioSet of manifest.audioSets || []) {
        const sourceDir = path.join(repoRoot, audioSet.sourceDir);
        const sourceFiles = walkFiles(sourceDir).filter((file) => file.endsWith('.mp3'));
        const selectedFiles = audioSet.includeFromData
            ? getAudioFilesFromData(audioSet)
            : new Set(sourceFiles.map((file) => path.basename(file)));
        assert.equal(selectedFiles.size, audioSet.cardCount * audioSet.clipsPerCard, `${audioSet.id} source clip count`);
        assert.ok([...selectedFiles].every((relative) => fs.existsSync(path.join(sourceDir, relative))), `${audioSet.id} source files exist`);
    }

    for (const relativePath of [manifest.runtimeData.starter.path, ...manifest.runtimeData.bands.map((band) => band.path)]) {
        const module = JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
        for (const card of module.cards || []) {
            for (const value of [card.image, card.backImage, card.audio, ...Object.values(card.narrationAudio || {})]) {
                const relative = String(value || '');
                if (!relative.startsWith('assets/')) continue;
                assert.ok(isDeclaredRuntimeAsset(relative), `card asset is outside manifest: ${relative}`);
            }
        }
    }
}

function assertArtifact(artifactRootPath) {
    const artifactFiles = walkFiles(artifactRootPath).map((file) => toPosix(path.relative(artifactRootPath, file)));
    const artifactSet = new Set(artifactFiles);
    const hasPath = (relative) => artifactSet.has(relative);

    assert.equal(hasPath('data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json'), false,
        'full Minecraft vocab source must stay out of the Pages artifact');
    for (const relative of manifest.data) {
        assert.ok(hasPath(relative), `required runtime data is missing from artifact: ${relative}`);
    }

    for (const relative of manifest.runtimeFiles) {
        assert.ok(hasPath(relative), `required manifest file is missing from artifact: ${relative}`);
    }
    for (const relative of manifest.entry) {
        assert.ok(hasPath(relative), `required runtime entry is missing from artifact: ${relative}`);
    }
    assert.ok(artifactFiles.some((relative) => relative.startsWith('assets/learn/english-vocab/generated/minecraft-expedition/')),
        'Minecraft expedition runtime images must be published');
    assert.ok(hasPath('assets/learn/english-vocab/generated/minecraft-expedition/manifest.json'),
        'Minecraft expedition visual manifest must be published');
    assert.equal(
        artifactFiles.some((relative) => relative.startsWith('assets/learn/english-vocab/generated/minecraft-expedition/prompts/')),
        false,
        'Grok generation prompts must stay out of the Pages artifact'
    );
    assert.equal(artifactFiles.some((relative) => relative === 'docs' || relative.startsWith('docs/')), false,
        'docs must stay out of the Pages artifact');
    assert.equal(artifactFiles.some((relative) => relative === 'tmp' || relative.startsWith('tmp/')), false,
        'tmp must stay out of the Pages artifact');
    assert.equal(artifactFiles.some((relative) => /anki/i.test(relative) && /minecraft/i.test(relative)), false,
        'Minecraft Anki source directory must stay out of the Pages artifact');
    assert.equal(
        artifactFiles.some((relative) => relative.startsWith('assets/learn/english-vocab/minecraft-reference/')),
        false,
        'Minecraft reference images must stay out of the Pages artifact'
    );

    const cardFiles = artifactFiles.filter((relative) => relative.startsWith('assets/learn/english-vocab/minecraft-cards/'));
    assert.ok(cardFiles.length > 0, 'normalized Minecraft card images must be published');
    assert.ok(cardFiles.every((relative) => relative.startsWith('assets/learn/english-vocab/minecraft-cards/normalized/')),
        'raw Minecraft card source files must stay out of the Pages artifact');

    const narrationFiles = artifactFiles.filter((relative) => relative.startsWith('assets/learn/english-vocab/minecraft-narration/'));
    assert.equal(narrationFiles.filter((relative) => relative.endsWith('.mp3')).length, 0,
        'published Minecraft narration must not retain MP3 sources');
    const narrationOggs = narrationFiles.filter((relative) => relative.endsWith('.ogg'));
    assert.equal(narrationOggs.length, manifest.audioSets[0].cardCount * manifest.audioSets[0].clipsPerCard,
        'published Minecraft narration must match the starter runtime pool');

    for (const relativePath of manifest.data.filter((relative) => relative.includes('/modules/'))) {
        const module = JSON.parse(fs.readFileSync(path.join(artifactRootPath, relativePath), 'utf8'));
        for (const card of module.cards || []) {
            for (const value of [card.image, card.backImage, card.audio, ...Object.values(card.narrationAudio || {})]) {
                const relative = String(value || '');
                if (!relative.startsWith('assets/')) continue;
                assert.ok(hasPath(relative), `published card asset is missing: ${relative}`);
            }
            for (const value of Object.values(card.externalNarrationAudio || {})) {
                const relative = String(value || '');
                if (relative.startsWith('assets/learn/english-vocab/minecraft-narration/')) {
                    assert.equal(hasPath(relative), false, `external CDN narration source must not enter Pages: ${relative}`);
                }
            }
        }
    }
}

assertManifestSource();
try {
    if (providedArtifact) assertArtifact(artifactRoot);
    console.log(providedArtifact
        ? `PASS Minecraft vocab publish contract: ${artifactRoot}`
        : 'PASS Minecraft vocab publish manifest contract');
} finally {
    if (!providedArtifact) fs.rmSync(artifactRoot, { recursive: true, force: true });
}
