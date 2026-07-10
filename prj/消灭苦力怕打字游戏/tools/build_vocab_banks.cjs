const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PROTOTYPE_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PROTOTYPE_DIR, "..", "..");
const SOURCE_DIR = path.join(REPO_ROOT, "data", "vocab", "单词库_分级");
const GENERATED_DIR = path.join(PROTOTYPE_DIR, "assets", "generated", "minecraft-typing-defense");
const MINECRAFT_TASKS_PATH = path.join(GENERATED_DIR, "tasks.json");
const VOCAB_BANKS_JSON_PATH = path.join(GENERATED_DIR, "vocab-banks.json");
const VOCAB_BANKS_JS_PATH = path.join(GENERATED_DIR, "vocab-banks.js");
const MANIFEST_PATH = path.join(GENERATED_DIR, "manifest.json");

const KINDERGARTEN_SOURCE = path.join(SOURCE_DIR, "01_幼儿园", "幼儿园完整词库.js");
const HANZI_SOURCE = path.join(SOURCE_DIR, "06_汉字", "幼儿园汉字.js");
const PINYIN_SOURCE = path.join(SOURCE_DIR, "07_拼音", "常用拼音.js");
const BRIDGE_SOURCE = path.join(SOURCE_DIR, "08_幼小衔接", "幼小衔接总词库.js");

const MAX_BANK_ITEMS = 80;
const MAX_WORD_BANK_ITEMS = 360;
const MAX_PINYIN_SINGLE_ITEMS = 80;
const MAX_PINYIN_PHRASE_ITEMS = 120;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function repoRelative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}

function projectRelative(filePath) {
  return path.relative(PROTOTYPE_DIR, filePath).replace(/\\/g, "/");
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing vocab source: ${filePath}`);
  }
}

function extractBinding(filePath, bindingName) {
  assertFile(filePath);
  const code = `${fs.readFileSync(filePath, "utf8")}\nglobalThis.__vocabExtract = ${bindingName};`;
  const context = {
    window: {},
    globalThis: null,
    console: {
      log() {},
      warn() {},
      error() {}
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  if (!Array.isArray(context.__vocabExtract)) {
    throw new Error(`expected ${bindingName} to be an array in ${filePath}`);
  }
  return context.__vocabExtract;
}

function extractBundledBinding(filePaths, bindingName) {
  filePaths.forEach(assertFile);
  const bundle = filePaths.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n\n");
  const code = `${bundle}\nglobalThis.__vocabExtract = ${bindingName};`;
  const context = {
    window: {},
    globalThis: null,
    module: { exports: {} },
    exports: {},
    console: {
      log() {},
      warn() {},
      error() {}
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePaths[filePaths.length - 1] });
  if (!Array.isArray(context.__vocabExtract)) {
    throw new Error(`expected ${bindingName} to be an array in bundle: ${filePaths.join(", ")}`);
  }
  return context.__vocabExtract;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeWord(value) {
  return normalizeText(value).toLowerCase();
}

function isShortEnglishWord(word) {
  return /^[a-z]{3,8}$/.test(word);
}

function isShortPinyinTarget(value) {
  return /^[a-z]{1,8}$/.test(value);
}

function normalizePinyinBase(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[ǖǘǚǜü]/g, "v")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, "");
}

function firstImageUrl(entry) {
  if (!Array.isArray(entry.imageURLs)) return "";
  const image = entry.imageURLs.find((item) => normalizeText(item?.url));
  return normalizeText(image?.url);
}

function groupCounts(tasks) {
  return tasks.reduce((counts, task) => {
    const key = String(task.wordLength || task.target.length);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function dedupeByTarget(tasks) {
  const seen = new Set();
  const out = [];
  for (const task of tasks) {
    if (seen.has(task.target)) continue;
    seen.add(task.target);
    out.push(task);
  }
  return out;
}

function dedupeByPromptAndTarget(tasks) {
  const seen = new Set();
  const out = [];
  for (const task of tasks) {
    const key = `${task.prompt || ""}__${task.target || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(task);
  }
  return out;
}

function sortPinyinPhraseTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const promptDelta = (left.promptLength || 99) - (right.promptLength || 99);
    if (promptDelta !== 0) return promptDelta;
    const targetDelta = String(left.target || "").length - String(right.target || "").length;
    if (targetDelta !== 0) return targetDelta;
    return (left.sourceIndex || 0) - (right.sourceIndex || 0);
  });
}

function buildMinecraftBank(source) {
  const words = Array.isArray(source.banks?.words) ? source.banks.words : [];
  return {
    id: "minecraft",
    title: "Minecraft",
    shortTitle: "Minecraft",
    kind: "words",
    source: {
      file: source.source?.file || "data/vocab/english-minecraft/views/typing-view.json",
      note: "Root data/vocab generated typing view"
    },
    words,
    groupCounts: groupCounts(words)
  };
}

function buildKindergartenBank() {
  return buildEnglishStageBank(KINDERGARTEN_SOURCE, "MERGED_KINDERGARTEN_VOCAB", {
    id: "kindergarten",
    title: "幼儿园分级词库",
    shortTitle: "幼儿园",
    note: "Stage-based graded word bank for kindergarten learners"
  });
}

function buildEnglishStageBank(filePath, bindingName, metadata = {}) {
  const source = extractBinding(filePath, bindingName);
  const tasks = dedupeByTarget(source.map((entry, index) => {
    const word = normalizeWord(entry.standardized || entry.word);
    if (!isShortEnglishWord(word)) return null;
    const chinese = normalizeText(entry.chinese);
    return {
      id: `kg-word-${word}`,
      mode: "单词",
      target: word,
      hint: chinese ? `${chinese} ${word}` : word,
      bankKey: "words",
      wordLength: word.length,
      translation: chinese,
      phrase: normalizeText(entry.phrase),
      phraseTranslation: normalizeText(entry.phraseTranslation),
      category: normalizeText(entry.category),
      stage: normalizeText(entry.stage || "kindergarten"),
      difficulty: normalizeText(entry.difficulty || "basic"),
      image: firstImageUrl(entry),
      sourceIndex: index
    };
  }).filter(Boolean)).slice(0, MAX_WORD_BANK_ITEMS);

  return {
    id: metadata.id || bindingName,
    title: metadata.title || metadata.shortTitle || bindingName,
    shortTitle: metadata.shortTitle || metadata.title || bindingName,
    kind: "words",
    source: {
      file: repoRelative(filePath),
      note: metadata.note || "Stage-based graded word bank"
    },
    words: tasks,
    groupCounts: groupCounts(tasks)
  };
}

function buildBridgePinyinBank() {
  const source = extractBundledBinding(
    [KINDERGARTEN_SOURCE, HANZI_SOURCE, PINYIN_SOURCE, BRIDGE_SOURCE],
    "BRIDGE_VOCAB_FULL"
  );
  const primaryTasks = source.map((entry, index) => {
    const mode = normalizeText(entry.mode).toLowerCase();
    const chinese = normalizeText(entry.chinese || entry.character || entry.word);
    const pinyin = normalizeText(entry.pinyin);
    const target = normalizePinyinBase(entry.base || pinyin);
    if (mode !== "chinese") return null;
    if (!chinese || chinese.length > 4) return null;
    if (!isShortPinyinTarget(target)) return null;
    const tier = chinese.length === 1 ? "single" : "phrase";
    return {
      id: `bridge-pinyin-${target}-${index}`,
      mode: "拼音",
      target,
      prompt: chinese,
      hint: pinyin ? `${chinese} ${pinyin}` : chinese,
      bankKey: "pinyin",
      wordLength: target.length,
      pinyinTier: tier,
      promptLength: chinese.length,
      chinese,
      pinyin,
      english: normalizeText(entry.english),
      stage: normalizeText(entry.stage || "bridge"),
      difficulty: normalizeText(entry.difficulty || "basic"),
      module: normalizeText(entry.module),
      sourceIndex: index
    };
  }).filter(Boolean);
  const fallbackTasks = source.map((entry, index) => {
    const chinese = normalizeText(entry.chinese || entry.character);
    const pinyin = normalizeText(entry.pinyin || entry.word);
    const target = normalizePinyinBase(entry.base || pinyin);
    if (!chinese || chinese.length > 4 || !isShortPinyinTarget(target)) return null;
    const tier = chinese.length === 1 ? "single" : "phrase";
    return {
      id: `bridge-pinyin-fallback-${target}-${index}`,
      mode: "拼音",
      target,
      prompt: chinese,
      hint: pinyin ? `${chinese} ${pinyin}` : chinese,
      bankKey: "pinyin",
      wordLength: target.length,
      pinyinTier: tier,
      promptLength: chinese.length,
      chinese,
      pinyin,
      english: normalizeText(entry.english),
      stage: normalizeText(entry.stage || "bridge"),
      difficulty: normalizeText(entry.difficulty || "basic"),
      module: normalizeText(entry.module),
      sourceIndex: index
    };
  }).filter(Boolean);
  const dedupedTasks = dedupeByPromptAndTarget([...primaryTasks, ...fallbackTasks]);
  const singleTasks = dedupedTasks
    .filter((task) => task.pinyinTier === "single")
    .slice(0, MAX_PINYIN_SINGLE_ITEMS);
  const phraseTasks = sortPinyinPhraseTasks(
    dedupedTasks.filter((task) => task.pinyinTier === "phrase")
  )
    .slice(0, MAX_PINYIN_PHRASE_ITEMS);
  const tasks = [...singleTasks, ...phraseTasks];

  return {
    id: "bridge-pinyin",
    title: "幼小衔接拼音",
    shortTitle: "拼音",
    kind: "pinyin",
    source: {
      file: repoRelative(PINYIN_SOURCE),
      hanziFile: repoRelative(HANZI_SOURCE),
      bridgeFile: repoRelative(BRIDGE_SOURCE),
      note: "Shows Chinese characters/words and expects keyboard-friendly pinyin input"
    },
    words: tasks,
    groupCounts: groupCounts(tasks),
    tierCounts: {
      single: singleTasks.length,
      phrase: phraseTasks.length
    }
  };
}

function updateManifest(data) {
  const manifest = fs.existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : {};
  manifest.vocabBanks = {
    file: repoRelative(VOCAB_BANKS_JSON_PATH),
    runtime: repoRelative(VOCAB_BANKS_JS_PATH),
    defaultBankId: data.defaultBankId,
    bankCount: data.banks.length,
    bankIds: data.banks.map((bank) => bank.id)
  };
  writeJson(MANIFEST_PATH, manifest);
}

function build() {
  const minecraftTasks = readJson(MINECRAFT_TASKS_PATH);
  const data = {
    prototypeId: "minecraft-typing-defense",
    adapterVersion: "typing-defense-vocab-banks-v1",
    generatedAt: new Date().toISOString(),
    defaultBankId: "kindergarten",
    sourceRoot: repoRelative(SOURCE_DIR),
    banks: [
      buildKindergartenBank(),
      buildEnglishStageBank(path.join(SOURCE_DIR, "03_小学_高年级", "小学低年级基础.js"), "STAGE_ELEMENTARY_LOWER", {
        id: "elementary-lower",
        title: "小学低年级分级词库",
        shortTitle: "小学低年级",
        note: "Stage-based graded word bank for elementary lower learners"
      }),
      buildEnglishStageBank(path.join(SOURCE_DIR, "03_小学_高年级", "小学高年级基础.js"), "STAGE_ELEMENTARY_UPPER", {
        id: "elementary-upper",
        title: "小学高年级分级词库",
        shortTitle: "小学高年级",
        note: "Stage-based graded word bank for elementary upper learners"
      }),
      buildEnglishStageBank(path.join(SOURCE_DIR, "05_初中", "junior_high_basic.js"), "STAGE_JUNIOR_HIGH_BASIC", {
        id: "junior-high",
        title: "初中分级词库",
        shortTitle: "初中",
        note: "Stage-based graded word bank for junior high learners"
      }),
      buildMinecraftBank(minecraftTasks),
      buildBridgePinyinBank()
    ],
    notes: [
      "The game loads a small runtime instead of parsing the source vocab files in the browser.",
      "Word banks are organized by learner stage and filtered to short keyboard-friendly targets for typing practice.",
      "Pinyin banks are generated from Hanzi and bridge vocab files in the same graded source tree."
    ]
  };
  return data;
}

function main() {
  const data = build();
  writeJson(VOCAB_BANKS_JSON_PATH, data);
  writeText(
    VOCAB_BANKS_JS_PATH,
    `window.__TYPING_DEFENSE_VOCAB_BANKS__ = ${JSON.stringify(data, null, 2)};\n`
  );
  updateManifest(data);
  console.log(`saved ${data.banks.length} vocab banks`);
  for (const bank of data.banks) {
    console.log(`${bank.id}: ${bank.words.length} playable items`);
  }
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
  isShortEnglishWord,
  isShortPinyinTarget
};

