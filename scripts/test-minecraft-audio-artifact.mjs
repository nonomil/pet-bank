import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts', 'assemble-minecraft-audio-artifact.mjs');
const sourceModule = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json'), 'utf8'));
const expectedSources = new Set((sourceModule.cards || [])
    .flatMap((card) => Object.values(card.narrationAudio || {}))
    .filter((value) => String(value || '').startsWith('assets/learn/english-vocab/minecraft-narration/')));
const providedArtifact = Boolean(process.argv[2]);
const artifactRoot = providedArtifact ? path.resolve(repoRoot, process.argv[2]) : path.join(repoRoot, 'tmp', 'minecraft-audio-artifact-contract');

function assertArtifact(root) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    assert.equal(manifest.id, 'minecraft-vocab-audio');
    assert.equal(manifest.format, 'OGG');
    assert.equal(manifest.subtype, 'OPUS');
    assert.equal(manifest.indexMode, 'selection');
    assert.equal(manifest.cardCount, sourceModule.cards.length);
    assert.equal(manifest.clipCount, expectedSources.size);
    assert.deepEqual(Object.keys(manifest.indexes).sort(), ['minecraft-advanced', 'minecraft-basic', 'minecraft-building', 'minecraft-core', 'minecraft-mobs', 'minecraft-world', 'starter']);
    const indexedSources = new Set();
    for (const metadata of Object.values(manifest.indexes)) {
        const index = JSON.parse(fs.readFileSync(path.join(root, metadata.path), 'utf8'));
        for (const entry of index.files) {
            indexedSources.add(entry.source);
            const filePath = path.join(root, entry.path);
            assert.ok(fs.existsSync(filePath), `missing audio artifact file: ${entry.path}`);
            assert.ok(fs.statSync(filePath).size > 256, `audio artifact file is too small: ${entry.path}`);
        }
    }
    assert.deepEqual(indexedSources, expectedSources);
    const files = fs.readdirSync(path.join(root, 'audio'));
    assert.equal(files.filter((file) => file.endsWith('.mp3')).length, 0);
}

async function assertBrowserMapping() {
    const source = fs.readFileSync(path.join(repoRoot, 'js', 'minecraft-vocab-audio.js'), 'utf8');
    const calls = [];
    const fetchManifest = async (url) => {
        calls.push(url);
        return {
            ok: true,
            json: async () => String(url).endsWith('/manifest.json')
                ? { id: 'minecraft-vocab-audio', indexMode: 'selection', indexes: { starter: { path: 'indexes/starter.json' } } }
                : { id: 'minecraft-vocab-audio-starter', files: [{ source: 'assets/learn/english-vocab/minecraft-narration/card-0001-block-phrase.mp3', path: 'audio/card-0001-block-phrase.ogg' }] }
        };
    };
    const context = {
        window: {
            PetBankConfig: { minecraftAudioBaseUrl: 'https://static.example.test/minecraft/v1/' },
            location: { href: 'https://example.test/' }
        },
        URL,
        fetch: fetchManifest,
        console: { warn() {} }
    };
    vm.runInNewContext(source, context);
    const result = await context.window.MinecraftVocabAudio.prepareForSelection('kindergarten', 'minecraft-core');
    assert.equal(result.enabled, true);
    assert.equal(calls.length, 2);
    assert.match(context.window.MinecraftVocabAudio.getUrl('assets/learn/english-vocab/minecraft-narration/card-0001-block-phrase.mp3'), /card-0001-block-phrase\.ogg$/);
}

assert.equal(expectedSources.size, 10840);
if (!providedArtifact) execFileSync(process.execPath, [scriptPath, artifactRoot, 'test-v1'], { cwd: repoRoot, stdio: 'inherit' });
assertArtifact(artifactRoot);
await assertBrowserMapping();
if (!providedArtifact) fs.rmSync(artifactRoot, { recursive: true, force: true });
console.log(`PASS Minecraft audio artifact contract: clips=${expectedSources.size}`);
