const path = require('path');

const DEFAULT_ALLOWED_CATEGORIES = new Set([
  'block',
  'item',
  'color',
  'food',
  'tool',
  'animal',
  'plant',
  'environment',
  'common',
  'general'
]);

const DISTRACTOR_FALLBACK_WORDS = ['stone', 'dirt', 'wood', 'sand', 'pig', 'cow', 'boat', 'apple'];

function normalizeMinecraftWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function sourceWeight(file) {
  const text = String(file || '');
  if (text.includes('minecraft_basic')) return 0;
  if (text.includes('common')) return 1;
  if (text.includes('blocks')) return 2;
  if (text.includes('items')) return 3;
  if (text.includes('entities')) return 4;
  if (text.includes('environment')) return 5;
  return 6;
}

function toDifficultyRank(value) {
  const text = String(value || 'basic').trim().toLowerCase();
  if (text === 'advanced') return 3;
  if (text === 'intermediate') return 2;
  return 1;
}

function imageFromItem(item) {
  const first = Array.isArray(item.imageURLs) ? item.imageURLs.find(entry => entry && entry.url) : null;
  if (!first) return null;
  const filename = String(first.filename || '').trim();
  const imagePage = String(first.url || '').trim();
  const image = filename
    ? `https://minecraft.wiki/w/Special:Redirect/file/${encodeURIComponent(filename)}`
    : imagePage;
  return {
    image,
    imagePage,
    imageFile: filename,
    imageType: first.type || 'Default'
  };
}

function makeExample(word) {
  const article = /^[aeiou]/.test(word) ? 'an' : 'a';
  return `I see ${article} ${word}.`;
}

function loadExternalMinecraftRows(sourceRoot, files) {
  const sourceVocabDir = path.join(sourceRoot, 'js', 'vocabularies');
  const rows = [];
  for (const rel of files) {
    const filePath = path.join(sourceVocabDir, rel);
    const list = require(filePath);
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      rows.push({ ...item, sourceFile: item.sourceFile || rel });
    }
  }
  return rows;
}

function buildDistractors(entries) {
  const byCategory = new Map();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) || [];
    list.push(entry.word);
    byCategory.set(entry.category, list);
  }
  const allWords = entries.map(entry => entry.word);
  const distractorMap = new Map();
  for (const entry of entries) {
    const sameCategory = (byCategory.get(entry.category) || []).filter(word => word !== entry.word);
    const fallback = allWords.filter(word => word !== entry.word);
    const backup = DISTRACTOR_FALLBACK_WORDS.filter(word => word !== entry.word);
    distractorMap.set(entry.word, [...new Set([...sameCategory, ...fallback, ...backup])].slice(0, 3));
  }
  return distractorMap;
}

function normalizeRows(rows) {
  return rows.map(item => {
    const word = normalizeMinecraftWord(item.word || item.standardized);
    const image = imageFromItem(item);
    return {
      raw: item,
      word,
      translation: String(item.chinese || '').trim(),
      category: String(item.category || 'minecraft').trim().toLowerCase(),
      difficulty: String(item.difficulty || 'basic').trim().toLowerCase(),
      phrase: String(item.phrase || '').trim(),
      phraseTranslation: String(item.phraseTranslation || item.phrase_translation || '').trim(),
      image,
      sourceFile: String(item.sourceFile || '').trim()
    };
  });
}

function withinCategoryCap(usedByCategory, category, categoryCaps) {
  if (!categoryCaps || !categoryCaps[category]) return true;
  return (usedByCategory.get(category) || 0) < categoryCaps[category];
}

function selectCuratedMinecraftCards(rows, options = {}) {
  const {
    allowCategories = DEFAULT_ALLOWED_CATEGORIES,
    minWordLength = 3,
    maxWordLength = 7,
    limit = 96,
    requireImage = true,
    level = 'minecraft-expanded',
    sourceProvider = 'minecraft_words_apk-main',
    idPrefix = 'mc-expanded',
    tagsSuffix = [],
    categoryCaps = null,
    excludeWords = []
  } = options;

  const allowed = allowCategories instanceof Set ? allowCategories : new Set(allowCategories);
  const excluded = new Set(excludeWords.map(normalizeMinecraftWord));
  const normalized = normalizeRows(rows)
    .filter(item => {
      if (!item.translation) return false;
      if (requireImage && !item.image) return false;
      if (!allowed.has(item.category)) return false;
      if (excluded.has(item.word)) return false;
      return new RegExp(`^[a-z]{${minWordLength},${maxWordLength}}$`).test(item.word);
    })
    .sort((a, b) => {
      const weight = sourceWeight(a.sourceFile) - sourceWeight(b.sourceFile);
      if (weight !== 0) return weight;
      return a.word.length - b.word.length || a.word.localeCompare(b.word);
    });

  const seenWords = new Set();
  const deduped = [];
  const usedByCategory = new Map();
  for (const item of normalized) {
    if (seenWords.has(item.word)) continue;
    if (!withinCategoryCap(usedByCategory, item.category, categoryCaps)) continue;
    seenWords.add(item.word);
    usedByCategory.set(item.category, (usedByCategory.get(item.category) || 0) + 1);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  const distractorMap = buildDistractors(deduped);

  return deduped.map((item, index) => ({
    id: `${idPrefix}-${String(index + 1).padStart(3, '0')}-${item.word}`,
    word: item.word,
    translation: item.translation,
    level,
    difficulty: toDifficultyRank(item.difficulty),
    category: item.category,
    tags: ['minecraft', item.category, ...tagsSuffix],
    example: makeExample(item.word),
    exampleZh: `我看见${item.translation}。`,
    phrase: item.phrase,
    phraseTranslation: item.phraseTranslation,
    image: item.image ? item.image.image : '',
    imagePage: item.image ? item.image.imagePage : '',
    imageFile: item.image ? item.image.imageFile : '',
    imageType: item.image ? item.image.imageType : '',
    imageSource: sourceProvider,
    sourceProvider,
    sourceFile: item.sourceFile,
    audio: '',
    audioVoice: 'web-speech-fallback',
    distractors: distractorMap.get(item.word) || []
  }));
}

module.exports = {
  DEFAULT_ALLOWED_CATEGORIES,
  buildDistractors,
  loadExternalMinecraftRows,
  normalizeMinecraftWord,
  selectCuratedMinecraftCards
};
