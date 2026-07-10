const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const OFFICIAL_ALL_PATH = path.join(REPO_ROOT, 'data', 'vocab', 'english-minecraft', 'views', 'all.json');
const EXTERNAL_ROOT = path.join(
  REPO_ROOT,
  'data',
  'vocab',
  'external',
  'mario-minecraft-words-0315',
  'vocabs'
);
const EXTERNAL_MANIFEST_PATH = path.join(EXTERNAL_ROOT, 'manifest.js');
const OUTPUT_DIR = path.join(REPO_ROOT, 'data', 'vocab', 'word-memory-combined');
const OUTPUT_VIEW_PATH = path.join(OUTPUT_DIR, 'views', 'all.json');
const OUTPUT_MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const OUTPUT_REPORT_PATH = path.join(OUTPUT_DIR, 'reports', 'import-summary.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function repoRelative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function runBrowserCompatibleScript(filePath, pickExpression = 'module.exports') {
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {
    window: {},
    module: { exports: {} },
    exports: {},
    console
  };
  context.window.vocabManifest = { version: '', packs: [] };
  vm.createContext(context);
  vm.runInContext(`${code}\n;module.exports = ${pickExpression};`, context, { filename: filePath });
  return context.module.exports;
}

function loadExternalManifest() {
  return runBrowserCompatibleScript(EXTERNAL_MANIFEST_PATH, 'window.vocabManifest.packs');
}

function loadExternalPack(pack) {
  const relativeFile = String(pack.file || '').replace(/^words\/vocabs\//, '');
  const filePath = path.join(EXTERNAL_ROOT, relativeFile);
  const globals = Array.isArray(pack.globals) ? pack.globals : [];
  const pickers = globals.map(name => (
    `(typeof ${name} !== 'undefined' && Array.isArray(${name}) ? ${name} : null)`
  ));
  const pickExpression = `[${pickers.join(',')}].find(Boolean) || (Array.isArray(module.exports) ? module.exports : [])`;
  return {
    filePath,
    relativeFile,
    cards: runBrowserCompatibleScript(filePath, pickExpression)
  };
}

function normalizeWord(text) {
  return String(text || '').trim().toLowerCase();
}

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function slugFor(text) {
  return normalizeWord(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'word';
}

function difficultyNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'intermediate') return 2;
  if (normalized === 'advanced' || normalized === 'full') return 3;
  return 1;
}

function categoryForExternal(item, pack) {
  return normalizeText(item.category || item.viewCategory || pack.stage || pack.type || 'external') || 'external';
}

function imageCandidatesFor(item) {
  if (!Array.isArray(item.imageURLs)) {
    return [];
  }
  return item.imageURLs
    .filter(entry => entry && entry.url)
    .map(entry => ({
      url: String(entry.url),
      filename: String(entry.filename || ''),
      type: String(entry.type || '')
    }));
}

function adaptOfficialCard(card) {
  const word = normalizeWord(card.word);
  const translation = normalizeText(card.translation);
  if (!word || !translation) return null;
  return {
    ...card,
    id: card.id || `official-${slugFor(word)}`,
    word,
    translation,
    sourceProvider: card.sourceProvider || 'english-mc-hybrid-2026',
    sourcePackId: 'english-minecraft/all',
    sourceModuleId: card.sourceModuleId || 'minecraft-vocab',
    sourceImage: card.image || '',
    viewCategory: card.viewCategory || card.category || 'minecraft',
    difficulty: difficultyNumber(card.difficulty),
    mergedSource: 'official'
  };
}

function adaptExternalCard(item, pack, packFile, index) {
  const word = normalizeWord(item.word || item.standardized);
  const translation = normalizeText(item.chinese || item.translation || item.meaning);
  if (!word || !translation) return null;
  const category = categoryForExternal(item, pack);
  return {
    id: `external-${slugFor(pack.id)}-${slugFor(word)}`,
    word,
    translation,
    level: normalizeText(item.stage || pack.stage || pack.level || ''),
    difficulty: difficultyNumber(item.difficulty || pack.difficulty),
    sourceProvider: 'mario-minecraft-words-0315',
    sourcePackId: pack.id || 'external',
    sourceModuleId: 'mario-minecraft-vocabs',
    sourceFile: repoRelative(packFile),
    sourceIndex: index,
    sourceImage: '',
    externalImageCandidates: imageCandidatesFor(item),
    phrase: normalizeText(item.phrase),
    phraseTranslation: normalizeText(item.phraseTranslation),
    phonetic: normalizeText(item.phonetic),
    viewCategory: category,
    category,
    tags: [
      'external',
      normalizeText(pack.stage || ''),
      normalizeText(pack.difficulty || ''),
      category
    ].filter(Boolean),
    image: '',
    mergedSource: 'external'
  };
}

function build() {
  if (!fs.existsSync(OFFICIAL_ALL_PATH)) {
    throw new Error(`missing official all view: ${repoRelative(OFFICIAL_ALL_PATH)}`);
  }
  if (!fs.existsSync(EXTERNAL_MANIFEST_PATH)) {
    throw new Error(`missing external manifest: ${repoRelative(EXTERNAL_MANIFEST_PATH)}`);
  }

  const cardsByWord = new Map();
  const sourceStats = [];
  const official = readJson(OFFICIAL_ALL_PATH);
  for (const card of official.cards || []) {
    const adapted = adaptOfficialCard(card);
    if (adapted && !cardsByWord.has(adapted.word)) {
      cardsByWord.set(adapted.word, adapted);
    }
  }

  const packs = loadExternalManifest().filter(pack => pack && pack.mode === 'english');
  for (const pack of packs) {
    const loaded = loadExternalPack(pack);
    let added = 0;
    let duplicate = 0;
    loaded.cards.forEach((item, index) => {
      const adapted = adaptExternalCard(item, pack, loaded.filePath, index);
      if (!adapted) return;
      if (cardsByWord.has(adapted.word)) {
        duplicate += 1;
        return;
      }
      cardsByWord.set(adapted.word, adapted);
      added += 1;
    });
    sourceStats.push({
      id: pack.id,
      title: pack.title,
      mode: pack.mode,
      stage: pack.stage,
      difficulty: pack.difficulty,
      file: repoRelative(loaded.filePath),
      rawCount: loaded.cards.length,
      added,
      duplicate
    });
  }

  const cards = [...cardsByWord.values()].sort((a, b) => {
    const byDifficulty = difficultyNumber(a.difficulty) - difficultyNumber(b.difficulty);
    if (byDifficulty) return byDifficulty;
    return a.word.localeCompare(b.word);
  });

  const view = {
    id: 'word-memory-combined-all',
    type: 'vocab-view',
    sourceModuleId: 'word-memory-combined',
    viewId: 'all',
    generatedAt: new Date().toISOString(),
    description: 'Combined English vocab view for the word-memory shooting prototype. Official Minecraft cards are kept first; copied external English packs fill the rest.',
    sourceViews: [
      repoRelative(OFFICIAL_ALL_PATH),
      repoRelative(EXTERNAL_MANIFEST_PATH)
    ],
    cards
  };

  const manifest = {
    id: 'word-memory-combined',
    title: '单词记忆射击场合并词库',
    type: 'game-vocab-pack',
    version: '2026-07-08',
    description: '当前单词记忆射击场使用的合并英文词库。原始外部文件保存在 data/vocab/external/mario-minecraft-words-0315/vocabs。',
    updatedAt: view.generatedAt,
    views: [
      {
        id: 'all',
        purpose: '合并当前 Minecraft 词库和外部 English packs 的全量抽题池',
        file: repoRelative(OUTPUT_VIEW_PATH),
        cardCount: cards.length,
        generatedAt: view.generatedAt
      }
    ],
    sources: sourceStats
  };

  return {
    view,
    manifest,
    report: {
      generatedAt: view.generatedAt,
      officialCount: Array.isArray(official.cards) ? official.cards.length : 0,
      externalPackCount: packs.length,
      sourceStats,
      finalCount: cards.length
    }
  };
}

function main() {
  const result = build();
  writeJson(OUTPUT_VIEW_PATH, result.view);
  writeJson(OUTPUT_MANIFEST_PATH, result.manifest);
  writeJson(OUTPUT_REPORT_PATH, result.report);
  console.log(`saved ${result.view.cards.length} combined word-memory cards`);
  console.log(repoRelative(OUTPUT_VIEW_PATH));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = {
  build,
  loadExternalManifest,
  loadExternalPack
};
