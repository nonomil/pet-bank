const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LEARNING_DIR = path.join(ROOT, 'prj', '学习机玩法原型');
const BASE_PATH = path.join(LEARNING_DIR, 'assets', 'generated', 'minecraft-typing-expanded.json');
const OUTPUT_PATH = path.join(LEARNING_DIR, 'assets', 'generated', 'english-typing-unified.json');
const OUTPUT_JS_PATH = path.join(LEARNING_DIR, 'assets', 'generated', 'english-typing-unified.js');
const INDEX_OUTPUT_PATH = path.join(LEARNING_DIR, 'assets', 'generated', 'english-typing-index.json');
const SHARD_DIR = path.join(LEARNING_DIR, 'assets', 'generated');
const PACKS = [
  { id: 'core-english', title: '核心主线', description: '322 个高频核心词。', file: 'core-english/views/core.json' },
  { id: 'extension-english', title: '可靠拓展', description: '512 个已通过字段与内容审计的拓展词。', file: 'extension-english/views/extension.json' }
];
const SHARD_PACK_IDS = [
  'minecraft',
  'kindergarten',
  'elementary',
  'junior_high',
  'core-english',
  'extension-english'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalize(card, group) {
  return {
    id: `curriculum-${group.id}-${card.id}`,
    word: String(card.word || '').toLowerCase(),
    translation: String(card.translation || ''),
    phonetic: String(card.phonetic || ''),
    example: String(card.example || ''),
    exampleZh: String(card.example_zh || ''),
    level: group.id === 'core-english' ? 'basic' : 'intermediate',
    difficulty: group.id === 'core-english' ? 1 : 2,
    sourceProvider: 'pet-bank-curated-vocab',
    sourcePackId: group.id,
    sourcePackTitle: group.title,
    sourcePackGroup: group.id,
    sourcePackGroupTitle: group.title,
    image: String(card.image || ''),
    imagePage: String(card.sourceImage || ''),
    imageFile: '',
    tags: Array.isArray(card.tags) ? card.tags : [],
    audio: '',
    audioVoice: 'web-speech-fallback',
    viewCategory: card.viewCategory || ''
  };
}

function isPlayable(card) {
  const word = String(card.word || '').toLowerCase().replace(/[^a-z]/g, '');
  return /^[a-z]{2,16}$/.test(word);
}

function build() {
  const base = readJson(BASE_PATH);
  const curriculumCards = [];
  const curriculumPacks = [];
  for (const group of PACKS) {
    const view = readJson(path.join(ROOT, 'data', 'vocab', group.file));
    const cards = (view.cards || []).map(card => normalize(card, group));
    curriculumCards.push(...cards);
    curriculumPacks.push({ id: group.id, title: group.title, description: group.description, count: cards.filter(isPlayable).length });
  }
  curriculumPacks.push({ id: 'curriculum-all', title: '完整英语路径', description: '核心主线与可靠拓展的可玩词。', count: curriculumCards.filter(isPlayable).length });
  return {
    ...base,
    id: 'english-typing-unified',
    title: '英语学习路径打字射击词包',
    description: '保留原有主题词库，并增加经过审计的核心与拓展英语路径。',
    generatedAt: new Date().toISOString(),
    packs: [...(base.packs || []), ...curriculumPacks],
    cards: [...(base.cards || []), ...curriculumCards]
  };
}

function buildRuntimeIndex(data) {
  const metadata = new Map((data.packs || []).map(pack => [pack.id, pack]));
  const shardFile = packId => `english-typing-${packId}.json`;
  const shardPacks = SHARD_PACK_IDS.map(packId => ({
    ...metadata.get(packId),
    files: [shardFile(packId)]
  }));
  const aggregatePacks = [
    {
      ...metadata.get('all'),
      files: ['minecraft', 'kindergarten', 'elementary', 'junior_high'].map(shardFile)
    },
    {
      ...metadata.get('curriculum-all'),
      files: ['core-english', 'extension-english'].map(shardFile)
    }
  ];
  return {
    version: 1,
    id: 'english-typing-index',
    type: 'vocab-index',
    title: data.title,
    sourceViewId: data.sourceViewId,
    generatedAt: data.generatedAt,
    packs: [...shardPacks, ...aggregatePacks]
  };
}

function writeRuntimeShards(data) {
  for (const packId of SHARD_PACK_IDS) {
    const cards = data.cards.filter(card => card.sourcePackGroup === packId);
    const outputPath = path.join(SHARD_DIR, `english-typing-${packId}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify({
      version: 1,
      id: `english-typing-${packId}`,
      type: 'vocab-shard',
      packId,
      cards
    }, null, 2)}\n`, 'utf8');
  }
}

const data = build();
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
fs.writeFileSync(OUTPUT_JS_PATH, `window.LearningArcadeTypingUnified = ${JSON.stringify(data, null, 2)};\n`, 'utf8');
writeRuntimeShards(data);
fs.writeFileSync(INDEX_OUTPUT_PATH, `${JSON.stringify(buildRuntimeIndex(data), null, 2)}\n`, 'utf8');
console.log(`saved ${data.cards.length} unified typing cards`);
