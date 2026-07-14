import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const py = process.platform === 'win32' ? 'python' : 'python3';
const removeKey = path.join(process.env.USERPROFILE || '', '.codex', 'skills', '.system', 'imagegen', 'scripts', 'remove_chroma_key.py');
const splitter = path.join(root, 'scripts', 'split-pixel-worlds-sheet.py');
const jobs = [
    { name: 'characters-hero-pet', kind: 'characters', cols: 4, rows: 4, prefix: 'hero-pet' },
    { name: 'characters-guides', kind: 'characters', cols: 4, rows: 4, prefix: 'guides' },
    { name: 'props-sci-fi-4x4', kind: 'props', cols: 4, rows: 4, prefix: 'sf-prop' },
    { name: 'props-forest-4x4', kind: 'props', cols: 4, rows: 4, prefix: 'forest-prop' },
    { name: 'props-block-4x4', kind: 'props', cols: 4, rows: 4, prefix: 'block-prop' },
    { name: 'props-detective-4x4', kind: 'props', cols: 4, rows: 4, prefix: 'detective-prop' },
];

function run(args) {
    const result = spawnSync(py, ['-X', 'utf8', ...args], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`command failed: ${args.join(' ')}`);
}

for (const job of jobs) {
    const input = path.join(root, 'tmp', 'pixel-worlds-sheets', `${job.name}.png`);
    const clean = path.join(root, 'tmp', 'pixel-worlds-sheets', 'clean', `${job.name}.webp`);
    const out = path.join(root, 'assets', 'story', 'pixel-worlds-v1', job.kind, job.name);
    if (!fs.existsSync(input)) throw new Error(`missing sheet: ${input}`);
    const expected = job.cols * job.rows;
    if (fs.existsSync(out) && fs.readdirSync(out).filter((file) => file.endsWith('.webp')).length === expected) continue;
    fs.mkdirSync(path.dirname(clean), { recursive: true });
    if (!fs.existsSync(clean)) {
        run([removeKey, '--input', input, '--out', clean, '--auto-key', 'border', '--soft-matte', '--transparent-threshold', '12', '--opaque-threshold', '220', '--despill']);
    }
    run([splitter, '--input', clean, '--out', out, '--cols', String(job.cols), '--rows', String(job.rows), '--prefix', job.prefix]);
}

const manifestPath = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const frameMap = {
    hero: 'assets/story/pixel-worlds-v1/characters/characters-hero-pet/hero-pet-01.webp',
    pet: 'assets/story/pixel-worlds-v1/characters/characters-hero-pet/hero-pet-09.webp',
    forest_guide: 'assets/story/pixel-worlds-v1/characters/characters-guides/guides-01.webp',
    block_builder: 'assets/story/pixel-worlds-v1/characters/characters-guides/guides-05.webp',
    cave_keeper: 'assets/story/pixel-worlds-v1/characters/characters-guides/guides-09.webp',
    detective_helper: 'assets/story/pixel-worlds-v1/characters/characters-guides/guides-13.webp',
};
for (const [id, sprite] of Object.entries(frameMap)) {
    if (manifest.characters?.[id]) manifest.characters[id].sprite = sprite;
}
const tracks = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])];
for (const track of tracks) {
    const sourceDir = path.join(root, 'assets', 'story', 'pixel-worlds-v1', 'props', `props-${track.id}-4x4`);
    const targetDir = path.join(root, 'assets', 'story', 'pixel-worlds-v1', 'props', track.id);
    fs.mkdirSync(targetDir, { recursive: true });
    const sourceFiles = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.webp')).sort();
    if (sourceFiles.length < 16) throw new Error(`expected 16 props for ${track.id}, got ${sourceFiles.length}`);
    for (const [index, node] of track.nodes.entries()) {
        const source = path.join(sourceDir, sourceFiles[index % sourceFiles.length]);
        const target = path.join(targetDir, `${node.levelId}.webp`);
        fs.copyFileSync(source, target);
    }
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log('FINALIZED pixel worlds sheets');
