import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, 'data', 'pets.json');
const outputPath = path.join(repoRoot, 'data', 'pets-runtime-index.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const fields = [
    'id', 'name', 'emoji', 'series', 'rarity',
    'base_hp', 'base_atk', 'base_def', 'base_spd',
    'imageUrl', 'imageStyle'
];

const flat = (source.flat || []).map((pet) => Object.fromEntries(
    fields.filter((field) => Object.prototype.hasOwnProperty.call(pet, field))
        .map((field) => [field, pet[field]])
));

if (!Array.isArray(source.flat) || flat.length !== source.flat.length || flat.length === 0) {
    throw new Error('pets.json flat catalog is missing or empty');
}

const runtimeIndex = {
    version: source.version,
    total: source.total,
    flat
};
fs.writeFileSync(outputPath, `${JSON.stringify(runtimeIndex)}\n`);
console.log(`generated ${path.relative(repoRoot, outputPath)} (${flat.length} pets)`);
