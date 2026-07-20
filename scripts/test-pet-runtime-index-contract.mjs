import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = JSON.parse(fs.readFileSync('data/pets.json', 'utf8'));
const runtimeIndex = JSON.parse(fs.readFileSync('data/pets-runtime-index.json', 'utf8'));
const requiredFields = ['id', 'name', 'emoji', 'rarity', 'base_hp', 'base_atk'];

assert.equal(runtimeIndex.version, source.version, 'runtime pet index version must match the source catalog');
assert.equal(runtimeIndex.total, source.total, 'runtime pet index total must match the source catalog');
assert.deepEqual(
    runtimeIndex.flat.map((pet) => pet.id),
    source.flat.map((pet) => pet.id),
    'runtime pet index must preserve the full catalog id order'
);
assert.ok(runtimeIndex.flat.every((pet) => requiredFields.every((field) => pet[field] !== undefined)),
    'runtime pet index must contain battle/display metadata for every pet');
assert.ok(runtimeIndex.flat.every((pet) => !Object.prototype.hasOwnProperty.call(pet, 'imageStages')),
    'runtime pet index must not embed full staged image data');
console.log(`PASS pet runtime index contract: ${runtimeIndex.flat.length} pets`);
