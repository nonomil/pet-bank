const fs = require("node:fs");
const path = require("node:path");

const PROTOTYPE_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PROTOTYPE_DIR, "..", "..");
const WEB_DIR = path.join(PROTOTYPE_DIR, "web");
const ROOT_VOCAB_TYPING_VIEW_PATH = path.join(
  REPO_ROOT,
  "data",
  "vocab",
  "english-minecraft",
  "views",
  "typing-view.json"
);
const ROOT_VOCAB_MANIFEST_PATH = path.join(REPO_ROOT, "data", "vocab", "english-minecraft", "manifest.json");
const GENERATED_DIR = path.join(PROTOTYPE_DIR, "assets", "generated", "minecraft-typing-defense");
const TASKS_JSON_PATH = path.join(GENERATED_DIR, "tasks.json");
const TASKS_JS_PATH = path.join(GENERATED_DIR, "tasks.js");
const MANIFEST_PATH = path.join(GENERATED_DIR, "manifest.json");

const MIN_WORDS_BY_LENGTH = {
  3: 4,
  4: 4,
  5: 6
};

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

function webRelative(rootRelativePath) {
  const absolutePath = path.join(REPO_ROOT, rootRelativePath);
  return path.relative(WEB_DIR, absolutePath).replace(/\\/g, "/");
}

function normalizeWord(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isLocalRepoAsset(value) {
  const assetPath = normalizeText(value);
  if (!assetPath || !assetPath.startsWith("assets/")) return false;
  return fs.existsSync(path.join(REPO_ROOT, assetPath));
}

function hasPlayableMedia(card) {
  return isLocalRepoAsset(card.image) && isLocalRepoAsset(card.audio);
}

function isKidTypingWord(word) {
  return /^[a-z]{3,5}$/.test(word);
}

function hintFor(card, word) {
  const translation = normalizeText(card.translation);
  if (translation) return `${translation} ${word}`;
  return word;
}

function adaptCard(card, sourceIndex) {
  const word = normalizeWord(card.word);
  const wordLength = word.length;
  return {
    id: card.id || `mc-typing-${word}`,
    mode: "单词",
    target: word,
    hint: hintFor(card, word),
    bankKey: "words",
    wordLength,
    translation: normalizeText(card.translation),
    image: webRelative(card.image),
    audio: webRelative(card.audio),
    imageSource: card.imageSource || "",
    audioVoice: card.audioVoice || "",
    viewCategory: card.viewCategory || card.category || "minecraft",
    level: card.level || "",
    difficulty: Number(card.difficulty || 1),
    sourceCardId: card.id || "",
    sourceProvider: card.sourceProvider || "",
    sourceIndex
  };
}

function groupCounts(tasks) {
  return tasks.reduce((counts, task) => {
    const key = String(task.wordLength);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function build() {
  if (!fs.existsSync(ROOT_VOCAB_TYPING_VIEW_PATH)) {
    throw new Error(`root vocab source is missing: ${ROOT_VOCAB_TYPING_VIEW_PATH}`);
  }

  const source = readJson(ROOT_VOCAB_TYPING_VIEW_PATH);
  const seenWords = new Set();
  const words = [];

  if (Array.isArray(source.cards)) {
    source.cards.forEach((card, sourceIndex) => {
      const word = normalizeWord(card.word);
      if (!isKidTypingWord(word)) return;
      if (seenWords.has(word)) return;
      if (!hasPlayableMedia(card)) return;
      seenWords.add(word);
      words.push(adaptCard(card, sourceIndex));
    });
  }

  const counts = groupCounts(words);
  for (const [length, minimum] of Object.entries(MIN_WORDS_BY_LENGTH)) {
    const actual = counts[length] || 0;
    if (actual < minimum) {
      throw new Error(`expected at least ${minimum} local ${length}-letter words, got ${actual}`);
    }
  }

  return {
    title: "Minecraft 消灭苦力怕打字词库",
    prototypeId: "minecraft-typing-defense",
    adapterVersion: "minecraft-typing-defense-v1",
    generatedAt: new Date().toISOString(),
    source: {
      packId: "english-minecraft",
      moduleId: source.id || "minecraft-vocab-typing-view",
      moduleType: source.type || "vocab-view",
      viewId: source.viewId || "typing-view",
      generatedAt: source.generatedAt || "",
      file: repoRelative(ROOT_VOCAB_TYPING_VIEW_PATH),
      registryManifest: repoRelative(ROOT_VOCAB_MANIFEST_PATH)
    },
    filters: {
      wordPattern: "^[a-z]{3,5}$",
      requireLocalImage: true,
      requireLocalAudio: true,
      purpose: "蓝牙键盘短词打字练习"
    },
    banks: {
      words
    },
    groupCounts: counts,
    notes: [
      "Runtime data is generated from data/vocab/ instead of being hand-edited in game.js.",
      "Only local images and local audio are included so the child-facing page remains stable offline.",
      "Pinyin, letter and number warm-up banks remain local to this prototype until root vocab adds those subjects."
    ]
  };
}

function main() {
  const data = build();
  writeJson(TASKS_JSON_PATH, data);
  writeText(
    TASKS_JS_PATH,
    `window.__MINECRAFT_TYPING_DEFENSE_TASKS__ = ${JSON.stringify(data, null, 2)};\n`
  );
  writeJson(MANIFEST_PATH, {
    prototypeId: data.prototypeId,
    adapterVersion: data.adapterVersion,
    source: data.source,
    filters: data.filters,
    outputs: [
      repoRelative(TASKS_JSON_PATH),
      repoRelative(TASKS_JS_PATH)
    ],
    wordCount: data.banks.words.length,
    groupCounts: data.groupCounts,
    words: data.banks.words.map((task) => task.target)
  });
  console.log(`saved ${data.banks.words.length} typing tasks from root vocab`);
  console.log(repoRelative(TASKS_JSON_PATH));
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
  isKidTypingWord,
  isLocalRepoAsset
};
