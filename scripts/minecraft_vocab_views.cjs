const fs = require('fs');
const path = require('path');

const VIEW_CATEGORY_TAGS = new Set([
  'animal',
  'item',
  'block',
  'color',
  'food',
  'tool',
  'plant',
  'environment',
  'object',
  'nature',
  'place',
  'mob',
  'people',
  'verb',
  'greeting'
]);

const MEMORY_EXCLUDED_WORDS = new Set([
  'hello',
  'look',
  'run',
  'friend',
  'bag',
  'play',
  'world',
  'craft'
]);

const MEMORY_EXCLUDED_CATEGORIES = new Set(['verb', 'greeting', 'people']);

const MEMORY_PINNED_WORDS = new Map([
  ['creeper', 0],
  ['diamond', 1],
  ['pickaxe', 2],
  ['sword', 3],
  ['block', 4],
  ['stone', 5],
  ['cat', 6],
  ['apple', 7]
]);

const MEMORY_CATEGORY_PRIORITY = {
  animal: 0,
  item: 1,
  food: 2,
  tool: 3,
  plant: 4,
  color: 5,
  block: 6,
  object: 7,
  environment: 8,
  nature: 9,
  place: 10,
  mob: 11,
  general: 12
};

const MEMORY_CATEGORY_CAPS = {
  animal: 6,
  item: 5,
  food: 2,
  tool: 3,
  plant: 3,
  color: 2,
  block: 4,
  object: 3,
  environment: 3,
  nature: 3,
  place: 2,
  mob: 2,
  general: 2
};

const MEMORY_LIMIT = 24;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hasMinecraftTag(card) {
  return Array.isArray(card.tags) && card.tags.includes('minecraft');
}

function deriveViewCategory(card) {
  if (card && card.viewCategory) return String(card.viewCategory);
  if (card && card.category) return String(card.category);
  const tags = Array.isArray(card && card.tags) ? card.tags : [];
  return tags.find(tag => VIEW_CATEGORY_TAGS.has(tag)) || 'general';
}

function withViewCategory(card) {
  return {
    ...card,
    viewCategory: deriveViewCategory(card)
  };
}

function dedupeCardsByWord(cards) {
  const seen = new Set();
  const deduped = [];
  for (const card of cards) {
    const word = String(card && card.word || '').toLowerCase();
    if (!word || seen.has(word)) continue;
    seen.add(word);
    deduped.push(card);
  }
  return deduped;
}

function createViewDoc(sourceDoc, options) {
  const {
    id,
    title,
    viewId,
    description,
    cards,
    generatedAt
  } = options;

  return {
    id,
    type: 'vocab-view',
    title,
    sourceModuleId: sourceDoc.id || 'minecraft-vocab',
    sourceProvider: sourceDoc.sourceProvider || 'mixed',
    sourceProviders: sourceDoc.sourceProviders || [],
    viewId,
    generatedAt,
    description,
    cards: cards.map(withViewCategory)
  };
}

function buildStarterViewCards(cards) {
  return dedupeCardsByWord(cards.filter(card => card.sourceProvider === 'mayihaoke'));
}

function buildCoreViewCards(cards) {
  return dedupeCardsByWord(cards.filter(card => card.sourceProvider === 'minecraft_words_apk-main'));
}

function buildTypingViewCards(cards) {
  return dedupeCardsByWord(cards.filter(card => /^[a-z]{3,7}$/.test(String(card.word || ''))));
}

function memoryPinnedRank(card) {
  const word = String(card && card.word || '').toLowerCase();
  return MEMORY_PINNED_WORDS.has(word) ? MEMORY_PINNED_WORDS.get(word) : 999;
}

function memoryCategoryRank(card) {
  const category = deriveViewCategory(card);
  return MEMORY_CATEGORY_PRIORITY[category] ?? 999;
}

function selectMemoryViewCards(cards) {
  const eligible = dedupeCardsByWord(cards).filter(card => {
    const word = String(card && card.word || '').toLowerCase();
    if (!/^[a-z]{3,8}$/.test(word)) return false;
    if (!card.translation || !card.image) return false;
    if (MEMORY_EXCLUDED_WORDS.has(word)) return false;
    if (MEMORY_EXCLUDED_CATEGORIES.has(deriveViewCategory(card))) return false;
    return true;
  });

  const sorted = eligible.slice().sort((a, b) => {
    const pinned = memoryPinnedRank(a) - memoryPinnedRank(b);
    if (pinned !== 0) return pinned;

    const sourceRank = (a.sourceProvider === 'mayihaoke' ? 0 : 1) - (b.sourceProvider === 'mayihaoke' ? 0 : 1);
    if (sourceRank !== 0) return sourceRank;

    const minecraftRank = (hasMinecraftTag(a) ? 0 : 1) - (hasMinecraftTag(b) ? 0 : 1);
    if (minecraftRank !== 0) return minecraftRank;

    const categoryRank = memoryCategoryRank(a) - memoryCategoryRank(b);
    if (categoryRank !== 0) return categoryRank;

    const difficultyRank = Number(a.difficulty || 9) - Number(b.difficulty || 9);
    if (difficultyRank !== 0) return difficultyRank;

    return a.word.length - b.word.length || a.word.localeCompare(b.word);
  });

  const counts = new Map();
  const selected = [];
  for (const card of sorted) {
    const category = deriveViewCategory(card);
    const cap = MEMORY_CATEGORY_CAPS[category] || 2;
    if ((counts.get(category) || 0) >= cap) continue;
    counts.set(category, (counts.get(category) || 0) + 1);
    selected.push(card);
    if (selected.length >= MEMORY_LIMIT) break;
  }

  return selected;
}

function buildMinecraftVocabViews(sourceDoc) {
  const cards = Array.isArray(sourceDoc && sourceDoc.cards) ? sourceDoc.cards : [];
  const generatedAt = new Date().toISOString();

  const starterCards = buildStarterViewCards(cards);
  const coreCards = buildCoreViewCards(cards);
  const typingCards = buildTypingViewCards(cards);
  const memoryCards = selectMemoryViewCards(cards);

  return {
    starter: createViewDoc(sourceDoc, {
      id: 'minecraft-vocab-starter',
      title: 'Minecraft 起步词卡视图',
      viewId: 'starter',
      generatedAt,
      description: '保留 mayihaoke 的 24 张起步 seed 词卡，作为英语启蒙与低门槛首轮输入层。',
      cards: starterCards
    }),
    core: createViewDoc(sourceDoc, {
      id: 'minecraft-vocab-core',
      title: 'Minecraft 核心词卡视图',
      viewId: 'core',
      generatedAt,
      description: '把外部精选的 72 张 core 词卡单独导出，方便后续做主题复盘和难度分层。',
      cards: coreCards
    }),
    typing: createViewDoc(sourceDoc, {
      id: 'minecraft-vocab-typing-view',
      title: 'Minecraft 打字视图',
      viewId: 'typing-view',
      generatedAt,
      description: '为键盘打字小游戏准备的短词视图，只保留 3-7 字母、可直接上手的词。',
      cards: typingCards
    }),
    memory: createViewDoc(sourceDoc, {
      id: 'minecraft-vocab-memory-view',
      title: 'Minecraft 词义记忆视图',
      viewId: 'memory-view',
      generatedAt,
      description: '为看图认义、地图找词等低压力记忆玩法准备的精选词集，优先保留具体、可配图、低龄友好的目标词。',
      cards: memoryCards
    })
  };
}

function writeMinecraftVocabViewsFromDoc(sourceDoc, outputDir) {
  const views = buildMinecraftVocabViews(sourceDoc);
  const files = {
    starter: 'minecraft-vocab-starter.json',
    core: 'minecraft-vocab-core.json',
    typing: 'minecraft-vocab-typing-view.json',
    memory: 'minecraft-vocab-memory-view.json'
  };

  fs.mkdirSync(outputDir, { recursive: true });
  Object.entries(files).forEach(([key, fileName]) => {
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, `${JSON.stringify(views[key], null, 2)}\n`, 'utf8');
  });

  return {
    outputDir,
    starterCount: views.starter.cards.length,
    coreCount: views.core.cards.length,
    typingCount: views.typing.cards.length,
    memoryCount: views.memory.cards.length
  };
}

function writeMinecraftVocabViews(masterPath, outputDir = path.dirname(masterPath)) {
  const sourceDoc = readJson(masterPath);
  return writeMinecraftVocabViewsFromDoc(sourceDoc, outputDir);
}

module.exports = {
  buildMinecraftVocabViews,
  deriveViewCategory,
  writeMinecraftVocabViews,
  writeMinecraftVocabViewsFromDoc
};
