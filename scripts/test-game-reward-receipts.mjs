import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loader = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const math = fs.readFileSync(path.join(root, 'js', 'math-pk.js'), 'utf8');

assert.match(loader, /GAME_REWARD_RECEIPT_KEY/, 'runtime loader should define persistent reward receipts');
assert.match(loader, /window\.GameRewardReceipts/, 'runtime loader should expose the receipt service before app.js');
assert.match(loader, /profileId.*source.*eventId/s, 'receipt identity should include profile, source, and event id');
assert.match(loader, /amount <= 0|points <= 0/, 'receipt service should reject non-positive grants');
assert.match(app, /GameRewardReceipts\.claim/, 'host bridge should claim receipts before game points are granted');
assert.match(math, /GameRewardReceipts\.claim/, 'math PK should claim a persistent receipt before awarding points');

console.log('PASS game reward receipt contract');
