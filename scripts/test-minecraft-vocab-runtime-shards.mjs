import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const moduleRoot = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules');
const manifestPath = path.join(repoRoot, 'scripts', 'runtime-asset-manifests', 'minecraft-vocab.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const fullPath = path.join(moduleRoot, 'minecraft-vocab.json');
const fullModule = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

function readJson(relativePath) {
    const absolutePath = path.join(repoRoot, relativePath);
    assert.ok(fs.existsSync(absolutePath), `runtime shard source is missing: ${relativePath}`);
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function cardIds(module) {
    return new Set((module.cards || []).map((card) => card.id));
}

function assertManifestSource() {
    assert.equal(manifest.id, 'minecraft-vocab');
    assert.equal(manifest.releaseStage, 'lazy-sharded-runtime');
    assert.ok(Array.isArray(manifest.data) && !manifest.data.includes(
        'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json'
    ));
    assert.ok(manifest.runtimeData?.starter, 'starter runtime data metadata is required');
    assert.equal(manifest.runtimeData.bands?.length, 6, 'six Minecraft bands are required');

    const runtimeDataFiles = [
        manifest.runtimeData.starter.path,
        ...manifest.runtimeData.bands.map((band) => band.path)
    ];
    for (const relativePath of runtimeDataFiles) readJson(relativePath);

    const starter = readJson(manifest.runtimeData.starter.path);
    assert.ok(starter.cards.length >= 100, 'starter must contain the low-level curriculum pool');
    assert.ok(starter.cards.every((card) => card.curriculumLevel !== 'minecraft' || card.expeditionSeed === true),
        'starter may only contain Minecraft-level cards explicitly needed by the expedition');

    const bandCards = manifest.runtimeData.bands.flatMap((bandMeta) => {
        const module = readJson(bandMeta.path);
        assert.equal(module.cards.length, bandMeta.cardCount, `${bandMeta.id} card count`);
        assert.ok(module.cards.every((card) => card.curriculumLevel === 'minecraft'), `${bandMeta.id} level boundary`);
        assert.ok(module.cards.every((card) => card.minecraftBand === bandMeta.id), `${bandMeta.id} band boundary`);
        return module.cards;
    });

    const allRuntimeCards = [...starter.cards, ...bandCards];
    for (const card of allRuntimeCards) {
        for (const value of [card.image, card.backImage, card.audio, ...Object.values(card.narrationAudio || {}), ...Object.values(card.externalNarrationAudio || {})]) {
            assert.doesNotMatch(String(value || ''), /^prj\//, `runtime card must not depend on the independent Anki workbench: ${card.id}`);
        }
    }
    for (const bandMeta of manifest.runtimeData.bands) {
        const band = readJson(bandMeta.path);
        assert.ok(band.cards.every((card) => Object.keys(card.externalNarrationAudio || {}).length === 6),
            `${bandMeta.id} must retain external narration keys for CDN mapping`);
        assert.ok(band.cards.every((card) => Object.values(card.externalNarrationAudio || {}).filter(Boolean)
            .filter((value) => String(value).startsWith('assets/learn/english-vocab/minecraft-narration/')).length === 5),
            `${bandMeta.id} must retain five generated CDN narration keys`);
    }
    const runtimeIds = cardIds({ cards: allRuntimeCards });
    const duplicateIds = [...new Set(allRuntimeCards.map((card) => card.id))]
        .filter((id) => allRuntimeCards.filter((card) => card.id === id).length > 1);
    const expedition = JSON.parse(fs.readFileSync(
        path.join(repoRoot, 'data', 'learn', 'minecraft-expedition', 'camp-regions.json'),
        'utf8'
    ));
    const expeditionCardIds = new Set(
        expedition.regions.flatMap((region) => region.mission?.cardIds || [])
    );
    assert.ok(duplicateIds.every((id) => expeditionCardIds.has(id)),
        'only expedition seed cards may be present in both starter and a band');
    assert.deepEqual(runtimeIds, cardIds(fullModule), 'runtime shards must cover the full source card pool');

    assert.ok([...expeditionCardIds].every((id) => cardIds(starter).has(id)),
        'all expedition cards must be available without loading a band shard');

    const pageSource = fs.readFileSync(path.join(repoRoot, 'js', 'minecraft-vocab-page.js'), 'utf8');
    assert.match(pageSource, /MinecraftVocabLoader/);
    assert.match(pageSource, /loadForSelection/);

    const runtimeLoaderSource = fs.readFileSync(path.join(repoRoot, 'js', 'runtime-loader.js'), 'utf8');
    assert.match(runtimeLoaderSource, /minecraft-vocab-loader\.js/);
    const learnCenterSource = fs.readFileSync(path.join(repoRoot, 'js', 'learn-center.js'), 'utf8');
    assert.match(learnCenterSource, /minecraft-vocab-runtime-starter\.json/);
    assert.match(learnCenterSource, /type: 'vocab'/);
}

function assertArtifact(artifactRoot) {
    const fullArtifactPath = path.join(artifactRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
    assert.equal(fs.existsSync(fullArtifactPath), false, 'full Minecraft vocab source must stay out of Pages artifact');
    for (const relativePath of [
        manifest.runtimeData.starter.path,
        ...manifest.runtimeData.bands.map((band) => band.path)
    ]) {
        const artifactPath = path.join(artifactRoot, relativePath);
        assert.ok(fs.existsSync(artifactPath), `runtime shard missing from artifact: ${relativePath}`);
        const module = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        for (const card of module.cards || []) {
            for (const value of [card.image, card.backImage, card.audio, ...Object.values(card.narrationAudio || {})]) {
                assert.doesNotMatch(String(value || ''), /^prj\//, `published runtime card depends on the independent Anki workbench: ${card.id}`);
            }
        }
    }
}

async function assertRuntimeLoaderBehavior() {
    const source = fs.readFileSync(path.join(repoRoot, 'js', 'minecraft-vocab-loader.js'), 'utf8');
    const calls = [];
    const fixtures = new Map([
        [manifest.runtimeData.starter.path, { cards: [{ id: 'starter-card' }] }],
        ...manifest.runtimeData.bands.map((band) => [band.path, { cards: [{ id: `${band.id}-card` }] }])
    ]);
    const context = {
        window: {
            PetBankAssetLoader: {
                fetchJson: async (relativePath) => {
                    calls.push(relativePath);
                    return fixtures.get(relativePath);
                }
            },
            MinecraftVocabLevels: {
                normalizeLevelId: (value) => ['kindergarten', 'minecraft', 'all'].includes(value) ? value : 'kindergarten',
                normalizeBandId: (value) => manifest.runtimeData.bands.some((band) => band.id === value) ? value : 'minecraft-core'
            }
        },
        console: { warn() {} }
    };
    vm.runInNewContext(source, context);
    const loader = context.window.MinecraftVocabLoader;
    assert.ok(loader, 'MinecraftVocabLoader should be exposed');

    const starter = await loader.loadForSelection('kindergarten', 'minecraft-core');
    assert.equal(JSON.stringify(starter.cards.map((card) => card.id)), JSON.stringify(['starter-card']));
    assert.deepEqual(calls, [manifest.runtimeData.starter.path]);

    calls.length = 0;
    const core = await loader.loadForSelection('minecraft', 'minecraft-core');
    assert.equal(JSON.stringify(core.cards.map((card) => card.id)), JSON.stringify(['starter-card', 'minecraft-core-card']));
    assert.deepEqual(calls, [manifest.runtimeData.bands[0].path]);

    calls.length = 0;
    const all = await loader.loadForSelection('all', 'minecraft-core');
    assert.equal(all.cards.length, 1 + manifest.runtimeData.bands.length);
    assert.deepEqual(calls, manifest.runtimeData.bands.slice(1).map((band) => band.path));
}

assertManifestSource();
await assertRuntimeLoaderBehavior();
if (process.argv[2]) assertArtifact(path.resolve(repoRoot, process.argv[2]));
console.log('PASS Minecraft vocab runtime shard contract');
