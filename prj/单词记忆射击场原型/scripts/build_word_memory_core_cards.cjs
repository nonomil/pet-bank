const fs = require('node:fs');
const path = require('node:path');

const PROTOTYPE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROTOTYPE_DIR, '..', '..');
const args = new Set(process.argv.slice(2));
const isExtension = args.has('--extension');
const PACK_ID = isExtension ? 'extension-english' : 'core-english';
const VIEW_ID = isExtension ? 'extension' : 'core';
const SOURCE_PATH = path.join(REPO_ROOT, 'data', 'vocab', PACK_ID, 'views', `${VIEW_ID}.json`);
const OUTPUT_PATH = path.join(PROTOTYPE_DIR, 'assets', `word-memory-${VIEW_ID}-cards.json`);
const FALLBACK_PATH = path.join(PROTOTYPE_DIR, 'assets', `word-memory-${VIEW_ID}-cards.js`);
const ASSET_BASE = './assets/generated/topdown-farm-assets';
const FALLBACKS = {
  animals: 'enemy_chicken.png', animal: 'enemy_chicken.png', food: 'crate_wood.png',
  nature: 'flower_patch_mixed.png', plants: 'flower_patch_sun.png', body: 'enemy_chick.png',
  body_parts: 'enemy_chick.png', actions: 'signpost_wood.png', action: 'signpost_wood.png',
  school: 'signpost_wood.png', school_supplies: 'crate_wood.png', toys: 'crate_wood.png'
};
const BOMBS = ['bomb_plain.png', 'bomb_ring.png', 'bomb_star.png', 'bomb_band.png'];
const BURSTS = ['hit_burst_star.png', 'hit_burst_spike.png', 'hit_burst_flash.png', 'hit_burst_badge.png'];
const THEMES = ['sun', 'sky', 'leaf', 'amber', 'aqua', 'mint', 'peach', 'violet'];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function fallbackFor(card, index) {
  const category = String(card.viewCategory || '').toLowerCase();
  return `${ASSET_BASE}/${FALLBACKS[category] || ['enemy_chick.png', 'enemy_mouse.png', 'crate_wood.png'][index % 3]}`;
}

function adapt(card, index) {
  const fallback = fallbackFor(card, index);
  const primary = /^https?:\/\//i.test(String(card.image || '')) ? card.image : fallback;
  return {
    id: card.id || `core-${card.word}`,
    word: String(card.word || '').trim().toLowerCase(),
    translation: String(card.translation || '').trim(),
    phonetic: String(card.phonetic || '').trim(),
    icon: String(card.viewCategory || 'core').slice(0, 1).toUpperCase(),
    theme: THEMES[index % THEMES.length],
    hint: String(card.example || card.phonetic || card.viewCategory || 'core English').trim(),
    example: String(card.example || '').trim(),
    exampleZh: String(card.example_zh || '').trim(),
    enemyImage: primary,
    enemyFallbackImage: fallback,
    bombImage: `${ASSET_BASE}/${BOMBS[index % BOMBS.length]}`,
    burstImage: `${ASSET_BASE}/${BURSTS[index % BURSTS.length]}`,
    viewCategory: card.viewCategory || 'general',
    level: 'core',
    difficulty: 1,
    sourceCardId: card.id || '',
    sourceProvider: `${PACK_ID}-sqlite`,
    sourcePackId: PACK_ID,
    sourceModuleId: PACK_ID,
    sourceFile: `data/vocab/${PACK_ID}/views/${VIEW_ID}.json`,
    sourceIndex: index,
    mergedSource: PACK_ID,
    sourceImage: String(card.image || ''),
    imageStatus: card.imageStatus || 'fallback'
  };
}

function build() {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const cards = (source.cards || []).map(adapt).filter(card => card.word && card.translation);
  const minimumCards = isExtension ? 30 : 100;
  if (cards.length < minimumCards || new Set(cards.map(card => card.word)).size !== cards.length) {
    throw new Error(`invalid ${VIEW_ID} word-memory cards: ${cards.length}`);
  }
  return {
    title: isExtension ? '第二组小学拓展英语词卡' : '核心英语单词记忆词卡',
    prototypeId: 'word-memory-topdown',
    adapterVersion: `${PACK_ID}-memory-v1`,
    source: {
      packId: PACK_ID, moduleId: PACK_ID, moduleType: source.type,
      viewId: source.viewId, generatedAt: source.generatedAt,
      file: `data/vocab/${PACK_ID}/views/${VIEW_ID}.json`,
      database: `data/vocab/${PACK_ID}/${PACK_ID}.db`
    },
    notes: ['Core English is generated from the publishable SQLite view.', 'Remote source images fall back to project-local game art.'],
    cards
  };
}

function main() {
  const data = build();
  writeJson(OUTPUT_PATH, data);
  const globalName = isExtension ? 'WORD_MEMORY_EXTENSION_CARDS_DATA' : 'WORD_MEMORY_CORE_CARDS_DATA';
  fs.writeFileSync(FALLBACK_PATH, `window.${globalName} = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
  console.log(`saved ${data.cards.length} ${VIEW_ID} word-memory cards`);
}

if (require.main === module) main();
module.exports = { build, adapt };
