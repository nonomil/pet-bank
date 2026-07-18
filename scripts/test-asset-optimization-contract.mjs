import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const artifactRoot = path.resolve(repoRoot, process.argv[2] || 'tmp/asset-optimize-20260718');
const indexPath = path.join(repoRoot, 'index.html');
const loaderPath = path.join(repoRoot, 'js', 'runtime-loader.js');
const imageConfigPath = path.join(repoRoot, 'scripts', 'runtime-image-variants.json');

const indexSource = fs.readFileSync(indexPath, 'utf8');
const loaderSource = fs.readFileSync(loaderPath, 'utf8');
const imageConfig = JSON.parse(fs.readFileSync(imageConfigPath, 'utf8'));

for (const href of ['css/travel-memory.css', 'css/playground.css', 'css/pixel-story.css']) {
    assert.doesNotMatch(indexSource, new RegExp(`<link\\s+rel=["']stylesheet["']\\s+href=["']${href.replace('.', '\\.')}`));
}

assert.match(loaderSource, /home:\s*\[[^\]]*css\/travel-memory\.css/s);
assert.match(loaderSource, /card:\s*\[[^\]]*css\/travel-memory\.css/s);
assert.match(loaderSource, /explore:\s*\[[^\]]*css\/travel-memory\.css[^\]]*css\/pixel-story\.css/s);
assert.match(loaderSource, /playground:\s*\[[^\]]*css\/playground\.css/s);

assert.ok(
    imageConfig.sets.some((item) => item.sourceDir === 'assets/learn/english-vocab/minecraft-cards/normalized'),
    'Minecraft vocabulary cards must have a publish image variant set'
);

assert.ok(fs.statSync(path.join(artifactRoot, 'index.html')).size > 0, 'assembled index.html must not be empty');
for (const href of ['css/travel-memory.css', 'css/playground.css', 'css/pixel-story.css']) {
    assert.doesNotMatch(fs.readFileSync(path.join(artifactRoot, 'index.html'), 'utf8'), new RegExp(`<link\\s+rel=["']stylesheet["']\\s+href=["']${href.replace('.', '\\.')}`));
}

const cardDir = path.join(artifactRoot, 'assets', 'learn', 'english-vocab', 'minecraft-cards', 'normalized');
const cardFiles = fs.readdirSync(cardDir);
assert.ok(cardFiles.some((file) => file.endsWith('.webp')), 'assembled artifact must contain Minecraft card WebP files');
assert.equal(cardFiles.filter((file) => file.endsWith('.png')).length, 0, 'assembled artifact must not contain Minecraft card PNG files');

console.log('[asset-optimization-contract] passed');
