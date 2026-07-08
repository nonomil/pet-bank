const fs = require('fs');
const path = require('path');

const {
  loadExternalMinecraftRows,
  selectCuratedMinecraftCards
} = require('./minecraft_vocab_selector.cjs');
const { writeMinecraftVocabViews } = require('./minecraft_vocab_views.cjs');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = 'G:/UserCode/minecraft_words/minecraft_words_apk-main';
const vocabPath = path.join(
  repoRoot,
  'data',
  'learn',
  'packs',
  'english-mc-hybrid-2026',
  'modules',
  'minecraft-vocab.json'
);

const sourceFiles = [
  'minecraft/minecraft_basic.js',
  'minecraft/minecraft_blocks.js',
  'minecraft/minecraft_items.js',
  'minecraft/minecraft_items_2.js',
  'minecraft/minecraft_entities.js',
  'minecraft/minecraft_environment.js'
];

const categoryCaps = {
  block: 35,
  item: 19,
  color: 6,
  food: 2,
  tool: 2,
  animal: 4,
  plant: 4,
  environment: 6
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countByCategory(cards) {
  const counts = {};
  for (const card of cards) {
    const key = card.category || 'uncategorized';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function main() {
  const existing = readJson(vocabPath);
  const existingCards = Array.isArray(existing.cards) ? existing.cards : [];
  const starterCards = existingCards.filter(card => card.sourceProvider === 'mayihaoke');
  const starterWords = starterCards.map(card => card.word);
  const rows = loadExternalMinecraftRows(sourceRoot, sourceFiles);
  const coreCards = selectCuratedMinecraftCards(rows, {
    minWordLength: 3,
    maxWordLength: 8,
    limit: 72,
    level: 'core',
    idPrefix: 'mc-core',
    tagsSuffix: ['core'],
    excludeWords: starterWords,
    categoryCaps
  });

  const next = {
    ...existing,
    sourceProvider: 'mixed',
    sourceProviders: ['mayihaoke', 'minecraft_words_apk-main'],
    description: '保留 mayihaoke 起步词卡，并从 minecraft_words_apk-main 追加一批适合幼小衔接的 Minecraft 核心词卡，用于学习中心和原型玩法共用。',
    generatedAt: new Date().toISOString(),
    cards: [...starterCards, ...coreCards]
  };

  fs.writeFileSync(vocabPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  const viewsSummary = writeMinecraftVocabViews(vocabPath);

  console.log(JSON.stringify({
    output: vocabPath,
    starterCount: starterCards.length,
    coreCount: coreCards.length,
    totalCount: next.cards.length,
    coreCategories: countByCategory(coreCards),
    views: viewsSummary
  }, null, 2));
}

main();
