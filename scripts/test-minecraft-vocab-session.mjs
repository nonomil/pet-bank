import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/minecraft-vocab-session.js', import.meta.url), 'utf8');

function createStorage(initial = {}, failKeys = []) {
  const values = new Map(Object.entries(initial));
  const failures = new Set(failKeys);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { if (failures.has(key)) throw new Error(`write blocked: ${key}`); values.set(key, String(value)); },
    dump(key) { return values.get(key); }
  };
}

const cards = Array.from({ length: 20 }, (_, index) => ({
  id: `card-${index + 1}`,
  word: `word${index + 1}`,
  translation: `词${index + 1}`,
  category: ['block', 'mob', 'item', 'biome'][index % 4]
}));

function load(storage, profileId = 'profile-a') {
  const window = {
    localStorage: storage,
    ProfileManager: { getActiveId: () => profileId },
    PetBankTime: { localDate: () => '2026-07-14' },
    GameRewardReceipts: { claim(input) { return { accepted: true, input }; } }
  };
  vm.runInNewContext(source, { window, localStorage: storage, JSON, Date, console: { warn() {} } });
  return window.MinecraftVocabSession;
}

{
  const session = load(createStorage());
  const queue = session.createQueue(cards, () => ({ status: 'new' }), '2026-07-14');
  assert.equal(queue.length, 11);
  assert.deepEqual(Array.from(queue, item => item.mode), ['review', 'review', 'new', 'new', 'new', 'new', 'new', 'recall', 'recall', 'recall', 'scene']);
  assert.equal(new Set(queue.map(item => item.cardId)).size, 11);
  const queueCategories = queue.map(item => cards.find(card => card.id === item.cardId).category);
  for (let index = 1; index < queueCategories.length; index += 1) {
    assert.notEqual(queueCategories[index], queueCategories[index - 1], `adjacent cards should not share category at ${index}`);
  }
  assert.notDeepEqual(queue.map(item => item.cardId), session.createQueue(cards, () => ({ status: 'new' }), '2026-07-15').map(item => item.cardId));
  assert.deepEqual(JSON.parse(JSON.stringify(queue)), JSON.parse(JSON.stringify(session.createQueue(cards, () => ({ status: 'new' }), '2026-07-14'))));
}

{
  const session = load(createStorage());
  const started = session.start(cards, () => ({ status: 'new' }), '2026-07-14');
  assert.equal(started.persisted, true);
  assert.equal(started.state.profileId, 'profile-a');
  const action = session.recordAction(started.state, started.state.queue[0].cardId);
  assert.equal(action.persisted, true);
  assert.equal(action.state.completed.length, 1);
  assert.equal(session.isComplete(action.state), false);
  assert.equal(session.getRewardEvent(action.state), null);
}

{
  const session = load(createStorage());
  let state = session.start(cards, () => ({ status: 'new' }), '2026-07-14').state;
  for (const item of state.queue) state = session.recordAction(state, item.cardId).state;
  assert.equal(session.isComplete(state), true);
  assert.deepEqual(JSON.parse(JSON.stringify(session.getRewardEvent(state))), { source: 'minecraft-vocab', eventId: 'session:2026-07-14', points: 10, profileId: 'profile-a', localDate: '2026-07-14' });
  assert.equal(session.claimReward(state).accepted, true);
}

{
  const key = 'petbank_minecraft_vocab_session_v1_profile-a';
  const session = load(createStorage({}, [key]));
  const result = session.start(cards, () => ({ status: 'new' }), '2026-07-14');
  assert.equal(result.persisted, false);
  assert.equal(result.state.completed.length, 0);
}

console.log('minecraft vocab session: PASS');
