const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const defaultSourceRoot = path.join(
  repoRoot,
  'data',
  'vocab',
  '单词库_分级'
);
const sourceRoot = path.resolve(process.argv[2] || defaultSourceRoot);
const outputPath = path.join(repoRoot, 'prj', '学习机玩法原型', 'assets', 'generated', 'minecraft-typing-expanded.json');
const scriptOutputPath = outputPath.replace(/\.json$/i, '.js');

const sourcePacks = [
  {
    file: path.join(sourceRoot, '01_幼儿园', '幼儿园完整词库.js'),
    id: 'vocab.kindergarten.full',
    title: '幼儿园',
    group: 'kindergarten',
    groupTitle: '幼儿园',
    difficulty: 1,
    level: 'basic',
    sourceGlobal: 'MERGED_KINDERGARTEN_VOCAB'
  },
  {
    file: path.join(sourceRoot, '03_小学_高年级', '小学低年级基础.js'),
    id: 'vocab.elementary.basic',
    title: '小学-初级',
    group: 'elementary',
    groupTitle: '小学',
    difficulty: 1,
    level: 'basic',
    sourceGlobal: 'STAGE_ELEMENTARY_LOWER'
  },
  {
    file: path.join(sourceRoot, '03_小学_高年级', '小学高年级基础.js'),
    id: 'vocab.elementary.intermediate',
    title: '小学-中级',
    group: 'elementary',
    groupTitle: '小学',
    difficulty: 2,
    level: 'intermediate',
    sourceGlobal: 'STAGE_ELEMENTARY_UPPER'
  },
  {
    file: path.join(sourceRoot, '03_小学_高年级', '小学全阶段合并词库.js'),
    id: 'vocab.elementary.full',
    title: '小学-完整',
    group: 'elementary',
    groupTitle: '小学',
    difficulty: 3,
    level: 'full',
    sourceGlobal: 'MERGED_VOCABULARY'
  },
  {
    file: path.join(sourceRoot, '05_初中', 'junior_high_basic.js'),
    id: 'vocab.junior_high.basic',
    title: '初中-初级',
    group: 'junior_high',
    groupTitle: '初中',
    difficulty: 1,
    level: 'basic',
    sourceGlobal: 'STAGE_JUNIOR_HIGH_BASIC'
  },
  {
    file: path.join(sourceRoot, '05_初中', 'junior_high_intermediate.js'),
    id: 'vocab.junior_high.intermediate',
    title: '初中-中级',
    group: 'junior_high',
    groupTitle: '初中',
    difficulty: 2,
    level: 'intermediate',
    sourceGlobal: 'STAGE_JUNIOR_HIGH_INTERMEDIATE'
  },
  {
    file: path.join(sourceRoot, '05_初中', 'junior_high_full.js'),
    id: 'vocab.junior_high.full',
    title: '初中-完整',
    group: 'junior_high',
    groupTitle: '初中',
    difficulty: 3,
    level: 'full',
    sourceGlobal: 'STAGE_JUNIOR_HIGH'
  },
  {
    file: path.join(sourceRoot, '04_我的世界', 'minecraft_basic.js'),
    id: 'vocab.minecraft.basic',
    title: 'Minecraft-初级',
    group: 'minecraft',
    groupTitle: 'Minecraft',
    difficulty: 1,
    level: 'basic',
    sourceGlobal: 'VOCAB_1_MINECRAFT____BASIC'
  },
  {
    file: path.join(sourceRoot, '04_我的世界', 'minecraft_intermediate.js'),
    id: 'vocab.minecraft.intermediate',
    title: 'Minecraft-中级',
    group: 'minecraft',
    groupTitle: 'Minecraft',
    difficulty: 2,
    level: 'intermediate',
    sourceGlobal: 'VOCAB_2_MINECRAFT____INTERMEDIATE'
  },
  {
    file: path.join(sourceRoot, '04_我的世界', 'minecraft_words_full.js'),
    id: 'vocab.minecraft.full',
    title: 'Minecraft-完整',
    group: 'minecraft',
    groupTitle: 'Minecraft',
    difficulty: 3,
    level: 'full',
    sourceGlobal: 'MINECRAFT_WORDS_FULL'
  }
];

function readSourceArray(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const equalsIndex = raw.indexOf('=');
  const arrayStart = raw.indexOf('[', equalsIndex);
  const arrayEnd = raw.lastIndexOf('];');
  if (equalsIndex === -1 || arrayStart === -1 || arrayEnd === -1) {
    throw new Error(`Could not parse array literal from ${filePath}`);
  }
  return Function(`"use strict"; return (${raw.slice(arrayStart, arrayEnd + 1)});`)();
}

function normalizeWord(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function pickImage(item) {
  const images = Array.isArray(item?.imageURLs) ? item.imageURLs : [];
  return images.find(image => image?.type === 'Default')
    || images.find(image => image?.type === 'Inventory Icon')
    || images[0]
    || null;
}

function articleFor(word) {
  return /^[aeiou]/.test(word) ? 'an' : 'a';
}

function buildExample(word, phrase) {
  const cleanPhrase = String(phrase || '').trim();
  if (cleanPhrase) {
    return `I use ${cleanPhrase}.`;
  }
  return `I see ${articleFor(word)} ${word}.`;
}

function uniqueDistractors(words, index) {
  const pool = [];
  for (let offset = 1; offset < words.length && pool.length < 3; offset += 1) {
    const next = words[(index + offset) % words.length];
    if (next && next !== words[index] && !pool.includes(next)) {
      pool.push(next);
    }
  }
  return pool;
}

function main() {
  const seenByPack = new Map();
  const cards = [];

  sourcePacks.forEach(pack => {
    const entries = readSourceArray(pack.file);
    entries.forEach((item, index) => {
      const word = normalizeWord(item.word);
      if (!/^[a-z]{3,7}$/.test(word)) {
        return;
      }
      const packSeen = seenByPack.get(pack.group) || new Set();
      if (packSeen.has(word)) return;
      packSeen.add(word);
      seenByPack.set(pack.group, packSeen);
      const image = pickImage(item);
      cards.push({
        id: `mc-ext-${String(cards.length + 1).padStart(3, '0')}-${word}`,
        word,
        translation: item.chinese || '',
        level: pack.level,
        difficulty: pack.difficulty,
        sourceProvider: 'graded-vocab',
        sourceModuleId: 'minecraft-vocab-external',
        sourceRoot,
        sourcePackId: pack.id,
        sourcePackTitle: pack.title,
        sourcePackGroup: pack.group,
        sourcePackGroupTitle: pack.groupTitle,
        sourceGlobal: pack.sourceGlobal,
        sourceIndex: index,
        example: buildExample(word, item.phrase),
        exampleZh: item.phraseTranslation || `我看见${item.chinese || word}。`,
        image: image?.url || '',
        imagePage: image?.url || '',
        imageFile: image?.filename || '',
        tags: ['minecraft', item.category || 'general', pack.level],
        distractors: [],
        audio: '',
        audioVoice: 'web-speech-fallback',
        viewCategory: item.category || 'general'
      });
    });
  });

  const words = cards.map(card => card.word);
  cards.forEach((card, index) => {
    card.distractors = uniqueDistractors(words, index);
  });

  const packOrder = [
    { id: 'minecraft', title: 'Minecraft', description: '我的世界主题词库，默认给飞机大战使用。' },
    { id: 'kindergarten', title: '幼儿园', description: '外部幼儿园英文词库，词更多但主题更泛。' },
    { id: 'elementary', title: '小学', description: '外部小学英文词库。' },
    { id: 'junior_high', title: '初中', description: '外部初中英文词库，难度偏高。' },
    { id: 'all', title: '全部英文', description: '合并所有外部英文词库。' }
  ];
  const packs = packOrder.map(pack => ({
    ...pack,
    count: pack.id === 'all'
      ? cards.length
      : cards.filter(card => card.sourcePackGroup === pack.id).length
  }));

  const output = {
    id: 'minecraft-typing-expanded',
    type: 'vocab',
    title: '分级英文打字射击扩展词包',
    sourceModuleId: 'minecraft-vocab-external',
    sourceViewId: 'typing-view',
    sourceProvider: 'graded-vocab',
    sourceProviders: ['graded-vocab'],
    sourceRoot,
    generatedAt: new Date().toISOString(),
    description: '从 data/vocab/单词库_分级 同步的英文打字扩展词包，供学习机原型或离线调试复用，不覆盖根游戏词库。',
    packs,
    cards
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    scriptOutputPath,
    `window.LearningArcadeTypingExpanded = ${JSON.stringify(output)};\n`,
    'utf8'
  );

  console.log(`Synced ${cards.length} cards from ${sourceRoot} to ${outputPath}`);
  console.log(`Wrote browser fallback data script to ${scriptOutputPath}`);
}

main();
