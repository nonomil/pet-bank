const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const mainPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const manifestPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'manifest.json');
const referencePath = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'word-cards.json');
const referenceMediaPath = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'media-manifest.json');
const ankiPath = path.join(repoRoot, 'prj', 'anki-minecraft-vocab', 'data', 'cards.json');
const promptPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'minecraft-card-back-prompts.json');
const narrationPath = path.join(repoRoot, 'data', 'vocab', 'english-minecraft', 'narration-manifest.json');

const PROMPT_WORD_RE = /(compressed|shot of|woman|man |freedom|success in|full frame|doing calming|at home|portrait|happy black|adventure travel|achievement|construction site|closeup|close-up|render|stock photo|photo of)/i;
const BAD_CONTENT_RE = /^(?:Minecraft中的|Minecraft词条)/;
const CATEGORY_RE = [
  ['mob', /mob|animal|creature|monster|生物|村民/i],
  ['biome', /biome|群系/i],
  ['structure', /structure|结构/i],
  ['advancement', /advancement|进度/i],
  ['effect', /effect|状态/i],
  ['tool', /tool|工具/i],
  ['weapon', /weapon|武器/i],
  ['food', /food|食物/i],
  ['plant', /plant|植物|农耕/i],
  ['color', /dye|染料|color|颜色/i],
  ['block', /block|方块/i]
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const referenceMedia = fs.existsSync(referenceMediaPath) ? readJson(referenceMediaPath) : { cards: [] };
const referenceMediaByIndex = new Map((referenceMedia.cards || []).map(item => [String(item.index), item.path]));
const narrationByWord = new Map((fs.existsSync(narrationPath) ? readJson(narrationPath).entries || [] : []).map(item => [key(item.word), item.cardId]));

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function clean(value, max = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function key(value) {
  return clean(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
}

function saneWord(value) {
  const word = clean(value, 120);
  return /^[a-z][a-z0-9' -]{1,119}$/i.test(word) && !PROMPT_WORD_RE.test(word);
}

function saneChinese(value) {
  const text = clean(value, 100);
  return Boolean(text) && !BAD_CONTENT_RE.test(text) && !/[≯≮#]/.test(text);
}

function categoryFor(value) {
  const haystack = [value.category, value.viewCategory, ...(value.tags || []), ...(value.deckPath || [])].join(' ');
  return CATEGORY_RE.find(([, pattern]) => pattern.test(haystack))?.[0] || 'item';
}

function mediaPath(card, kind) {
  const item = (card.media || []).find(media => media.kind === kind && media.available !== false && media.path);
  if (!item) return '';
  return `prj/anki-minecraft-vocab/${item.path.replace(/^\/+/, '')}`;
}

function fromAnki(card, index) {
  const content = card.content || {};
  const word = clean(content.word, 120);
  const translation = clean(content.chinese, 100);
  const image = mediaPath(card, 'image');
  const audio = mediaPath(card, 'audio');
  return {
    id: `anki-mc-${String(index + 1).padStart(4, '0')}-${key(word)}`,
    word,
    translation,
    phonetic: clean(content.phonetic, 80),
    level: 'anki-official',
    difficulty: 2,
    category: categoryFor(card),
    tags: ['minecraft', 'anki', categoryFor(card)],
    example: clean(content.sentence, 220),
    exampleZh: clean(content.sentenceTranslation, 220),
    phrase: clean(content.phrase, 120),
    phraseTranslation: clean(content.phraseTranslation, 120),
    sentence: clean(content.sentence, 220),
    sentenceTranslation: clean(content.sentenceTranslation, 220),
    image,
    audio,
    imageSource: image ? 'anki-extracted' : '',
    audioSource: audio ? 'anki-extracted' : '',
    sourceProvider: 'anki-apkg',
    sourceCardId: card.id,
    sourceDeckPath: Array.isArray(card.deckPath) ? card.deckPath.slice(1) : [],
    sourceDeck: card.deckName
  };
}

function fromReference(card) {
  const word = clean(card.word, 120);
  const sentence = clean(card.sentence || card.example, 220);
  const sentenceTranslation = clean(card.sentenceTranslation || card.exampleTranslation, 220);
  const image = referenceMediaByIndex.get(String(card.index || '').padStart(3, '0')) || '';
  return {
    ...card,
    word,
    translation: clean(card.chinese || card.translation, 100),
    phonetic: clean(card.phonetic, 80),
    category: categoryFor(card),
    example: sentence,
    exampleZh: sentenceTranslation,
    sentence,
    sentenceTranslation,
    phrase: clean(card.phrase, 120),
    phraseTranslation: clean(card.phraseTranslation, 120),
    image,
    imageSource: image ? 'mayihaoke-extracted' : '',
    sourceProvider: 'mayihaoke',
    sourceCardId: card.index || '',
    tags: [...new Set(['minecraft', 'mayihaoke', categoryFor(card), ...(card.tags || [])])]
  };
}

function usable(card) {
  return saneWord(card.word) && saneChinese(card.translation)
    && clean(card.phrase) && clean(card.phraseTranslation)
    && clean(card.sentence || card.example) && clean(card.sentenceTranslation || card.exampleZh || card.exampleTranslation);
}

function prefer(candidate, current) {
  if (!current) return candidate;
  if (current.sourceProvider === 'mayihaoke' && candidate.sourceProvider === 'anki-apkg') {
    return {
      ...current,
      image: current.image || candidate.image || '',
      audio: current.audio || candidate.audio || '',
      imageSource: current.imageSource || candidate.imageSource || '',
      audioSource: current.audioSource || candidate.audioSource || '',
      ankiSourceCardId: current.ankiSourceCardId || candidate.sourceCardId || ''
    };
  }
  const score = item => (item.sourceProvider === 'mayihaoke' ? 40 : 0)
    + (item.image && fs.existsSync(path.join(repoRoot, item.image)) ? 10 : 0)
    + (item.audio ? 5 : 0)
    + (item.phonetic ? 2 : 0);
  return score(candidate) > score(current) ? candidate : current;
}

function addUnique(map, card) {
  const normalized = {
    ...card,
    id: narrationByWord.get(key(card.word)) || card.id || `mc-word-${key(card.word || card.translation || card.chinese)}`,
    word: clean(card.word, 120),
    translation: clean(card.translation || card.chinese, 100),
    category: card.category || categoryFor(card),
    sourceProvider: card.sourceProvider || 'minecraft-curated',
    sourceDeckPath: Array.isArray(card.sourceDeckPath)
      ? card.sourceDeckPath.filter(part => !/薯仔|外语小站/.test(String(part)))
      : []
  };
  if (!usable(normalized)) return false;
  const cardKey = key(normalized.word);
  if (!cardKey) return false;
  map.set(cardKey, prefer(normalized, map.get(cardKey)));
  return true;
}

function addDistractors(cards) {
  const byCategory = new Map();
  cards.forEach(card => {
    const list = byCategory.get(card.category) || [];
    list.push(card.word);
    byCategory.set(card.category, list);
  });
  return cards.map(card => {
    const same = (byCategory.get(card.category) || []).filter(word => key(word) !== key(card.word));
    const fallback = cards.map(item => item.word).filter(word => key(word) !== key(card.word));
    return {
      ...card,
      distractors: [...new Set([...same, ...fallback])].slice(0, 3)
    };
  });
}

function main() {
  const existing = readJson(mainPath);
  const reference = readJson(referencePath);
  const anki = readJson(ankiPath);
  const map = new Map();
  const ankiAcceptedKeys = new Set();
  let existingCount = 0;
  let referenceCount = 0;
  let ankiCount = 0;

  for (const card of existing.cards || []) if (addUnique(map, card)) existingCount += 1;
  for (const card of reference.cards || []) if (addUnique(map, fromReference(card))) referenceCount += 1;
  for (const [index, card] of (Array.isArray(anki) ? anki : anki.cards || []).entries()) {
    if (addUnique(map, fromAnki(card, index))) {
      ankiCount += 1;
      ankiAcceptedKeys.add(key(card.content?.word));
    }
  }

  const cards = addDistractors([...map.values()]).map((card, index) => ({
    ...card,
    id: card.id || `card-${String(index + 1).padStart(4, '0')}`
  }));
  const next = {
    ...existing,
    id: 'minecraft-vocab',
    title: 'Minecraft 单词卡学习全量池',
    sourceProvider: 'anki-apkg-plus-mayihaoke',
    sourceProviders: ['mayihaoke', 'anki-apkg'],
    sourceSnapshot: 'prj/anki-minecraft-vocab/data/cards.json + data/learn/external/mayihaoke/word-cards.json',
    description: '完整学习池：保留参考站词卡，并合并 Anki 可读官方词条；原始 Anki 逐卡目录仍保留在独立图鉴中。',
    contentCuration: 'full-anki-reference-v1',
    imagePromptPolicy: {
      version: 'minecraft-card-back-v1',
      provider: 'agnes-image-2.1-flash',
      purpose: 'sentence-scene-memory',
      promptField: 'backImagePrompt',
      assetField: 'backImage',
      assetRoot: 'assets/learn/english-vocab/minecraft-card-backs/',
      status: cards.some(card => card.backImage) ? 'partially-generated' : 'prompt-ready-not-generated',
      generatedCount: cards.filter(card => card.backImage).length
    },
    generatedAt: new Date().toISOString(),
    sourceStats: {
      ankiCards: Array.isArray(anki) ? anki.length : (anki.cards || []).length,
      ankiUniqueUsable: ankiAcceptedKeys.size,
      referenceCards: (reference.cards || []).length,
      existingCuratedCards: existing.cards?.length || 0,
      finalUniqueWords: cards.length
    },
    mediaPolicy: {
      referenceApi: 'text-only-500-cards',
      ankiImageMatches: cards.filter(card => card.sourceProvider === 'mayihaoke' && card.image).length,
      ankiAudioMatches: cards.filter(card => card.sourceProvider === 'mayihaoke' && card.audio).length,
      browserSpeechFallback: true,
      imageFallback: 'themed-text-card',
      audioFallback: 'speech-synthesis-en-US'
    },
    cards
  };
  writeJson(mainPath, next);
  writeJson(promptPath, {
    schemaVersion: 1,
    promptPolicy: next.imagePromptPolicy,
    source: path.relative(repoRoot, mainPath).replace(/\\/g, '/'),
    cards: cards.map(card => ({
      cardId: card.id,
      word: card.word,
      translation: card.translation,
      category: card.category,
      phrase: card.phrase,
      sentence: card.sentence,
      sentenceTranslation: card.sentenceTranslation,
      prompt: card.backImagePrompt,
      image: card.backImage || ''
    }))
  });

  const manifest = readJson(manifestPath);
  const moduleMeta = (manifest.modules || []).find(item => item.id === 'minecraft-vocab');
  if (moduleMeta) {
    moduleMeta.duration = `${cards.length.toLocaleString('zh-CN')} 词全量池`;
    moduleMeta.summary = '把 Anki 官方词条与参考网站词卡合并到同一个可搜索、可播放、可计分的 Minecraft 英语学习池。';
  }
  writeJson(manifestPath, manifest);
  console.log(JSON.stringify({
    output: path.relative(repoRoot, mainPath).replace(/\\/g, '/'),
    existingCount,
    referenceCount,
    ankiCount,
    finalUniqueWords: cards.length,
    images: cards.filter(card => card.image).length,
    audio: cards.filter(card => card.audio).length,
    categories: cards.reduce((result, card) => { result[card.category] = (result[card.category] || 0) + 1; return result; }, {})
  }, null, 2));
}

main();
