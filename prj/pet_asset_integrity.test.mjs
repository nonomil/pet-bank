import fs from 'fs';

const db = JSON.parse(fs.readFileSync('data/pets.json', 'utf8'));
const referenced = new Map();

function add(src, owner) {
  if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src)) return;
  if (!referenced.has(src)) referenced.set(src, []);
  referenced.get(src).push(owner);
}

for (const pet of db.flat || []) {
  add(pet.imageUrl, `${pet.name} main`);
  for (const [stage, src] of Object.entries(pet.imageStages || {})) {
    add(src, `${pet.name} imageStages.${stage}`);
  }
  for (const [index, stage] of (pet.stages || []).entries()) {
    add(stage.imageUrl, `${pet.name} stages.${index}`);
  }
}

const missing = [];
for (const [src, owners] of referenced.entries()) {
  if (!fs.existsSync(src)) {
    missing.push(`${src} <= ${owners.slice(0, 3).join(', ')}`);
  }
}

if (missing.length) {
  console.error(`FAIL - ${missing.length} runtime pet image assets are missing`);
  for (const item of missing) console.error(item);
  process.exit(1);
}

console.log(`PASS - ${referenced.size} runtime pet image assets exist`);
