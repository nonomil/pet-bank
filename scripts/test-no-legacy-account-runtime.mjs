import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const runtimeLoader = read('js/runtime-loader.js');
const artifactBuilder = read('scripts/assemble-pages-artifact.mjs');
const app = read('js/app.js');
const home = read('js/home.js');
const mathPk = read('js/math-pk.js');
const hanzi = read('js/hanzi-game.js');

for (const name of [
    'supabase-js.js',
    'cloud-client.js',
    'cloud-sync.js',
    'auth.js',
    'household.js',
    'social.js',
    'pk-service.js',
    'family-social-scope.js',
    'activity-feed.js'
]) {
    assert.doesNotMatch(runtimeLoader, new RegExp(name.replace('.', '\\.'), 'i'), `runtime loader still references ${name}`);
}

assert.doesNotMatch(artifactBuilder, /supabase|cloud-config/i, 'static artifact builder still emits Supabase configuration');
assert.doesNotMatch(app, /SocialSystem|HouseholdSystem|AuthSystem|PKService|CloudSync|CloudDiagnostics|FamilySocialScope/, 'app still calls removed account or social services');
assert.doesNotMatch(home, /SocialSystem|CloudSync/, 'home page still calls removed account or social services');
assert.doesNotMatch(mathPk, /PKService|asyncMatch|asyncQuestions|isAsyncMode/, 'math PK still exposes removed asynchronous service mode');
assert.doesNotMatch(hanzi, /PKService|asyncMatch|asyncQuestions|isAsyncMode/, 'hanzi game still exposes removed asynchronous service mode');

console.log('PASS no legacy account runtime references');
