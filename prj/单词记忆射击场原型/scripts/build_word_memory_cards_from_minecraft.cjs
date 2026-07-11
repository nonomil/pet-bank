const fs = require('node:fs');
const path = require('node:path');

const PROTOTYPE_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PROTOTYPE_DIR, '..', '..');
const ROOT_VOCAB_ALL_VIEW_PATH = path.join(
  REPO_ROOT,
  'data',
  'vocab',
  'word-memory-combined',
  'views',
  'all.json'
);
const ROOT_VOCAB_MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'vocab', 'word-memory-combined', 'manifest.json');
const UPSTREAM_SOURCE_PATH = path.join(
  REPO_ROOT,
  'data',
  'vocab',
  'external',
  'mario-minecraft-words-0315',
  'vocabs',
  'manifest.js'
);
const OUTPUT_PATH = path.join(PROTOTYPE_DIR, 'assets', 'word-memory-cards.json');
const FILE_FALLBACK_PATH = path.join(PROTOTYPE_DIR, 'assets', 'word-memory-cards.js');
const GENERATED_DIR = path.join(PROTOTYPE_DIR, 'assets', 'generated', 'minecraft-memory-adapter');
const CACHED_IMAGE_DIR = path.join(GENERATED_DIR, 'images');
const SNAPSHOT_PATH = path.join(GENERATED_DIR, 'minecraft-word-memory-cards.json');
const MANIFEST_PATH = path.join(GENERATED_DIR, 'manifest.json');
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.WORD_MEMORY_IMAGE_TIMEOUT_MS || 2500);
const IMAGE_FETCH_CONCURRENCY = Number(process.env.WORD_MEMORY_IMAGE_CONCURRENCY || 24);

const ASSET_BASE = './assets/generated/topdown-farm-assets';
const MC_PET_POSE_BASE = './assets/MineCraft宠物图片/poses';

const MC_PET_IMAGES = {
  allay: `${MC_PET_POSE_BASE}/mc_allay_idle.webp`,
  axolotl: `${MC_PET_POSE_BASE}/mc_axolotl_idle.webp`,
  blaze: `${MC_PET_POSE_BASE}/mc_blaze_idle.webp`,
  cat: `${MC_PET_POSE_BASE}/mc_cat_idle.webp`,
  creeper: `${MC_PET_POSE_BASE}/mc_creeper_idle.webp`,
  dragon: `${MC_PET_POSE_BASE}/mc_ender_dragon_idle.webp`,
  enderman: `${MC_PET_POSE_BASE}/mc_enderman_idle.webp`,
  ghast: `${MC_PET_POSE_BASE}/mc_ghast_idle.webp`,
  ironGolem: `${MC_PET_POSE_BASE}/mc_iron_golem_idle.webp`,
  parrot: `${MC_PET_POSE_BASE}/mc_parrot_idle.webp`,
  phantom: `${MC_PET_POSE_BASE}/mc_phantom_idle.webp`,
  rabbit: `${MC_PET_POSE_BASE}/mc_rabbit_idle.webp`,
  skeleton: `${MC_PET_POSE_BASE}/mc_skeleton_idle.webp`,
  spider: `${MC_PET_POSE_BASE}/mc_spider_idle.webp`,
  turtle: `${MC_PET_POSE_BASE}/mc_turtle_idle.webp`,
  warden: `${MC_PET_POSE_BASE}/mc_warden_idle.webp`,
  wither: `${MC_PET_POSE_BASE}/mc_wither_idle.webp`,
  wolf: `${MC_PET_POSE_BASE}/mc_wolf_idle.webp`,
  zombie: `${MC_PET_POSE_BASE}/mc_zombie_idle.webp`
};

const MC_ANIMAL_FALLBACK_IMAGES = [
  MC_PET_IMAGES.allay,
  MC_PET_IMAGES.axolotl,
  MC_PET_IMAGES.cat,
  MC_PET_IMAGES.parrot,
  MC_PET_IMAGES.rabbit,
  MC_PET_IMAGES.turtle,
  MC_PET_IMAGES.wolf
];

const MC_MOB_FALLBACK_IMAGES = [
  MC_PET_IMAGES.creeper,
  MC_PET_IMAGES.zombie,
  MC_PET_IMAGES.skeleton,
  MC_PET_IMAGES.spider,
  MC_PET_IMAGES.enderman,
  MC_PET_IMAGES.blaze,
  MC_PET_IMAGES.ghast,
  MC_PET_IMAGES.phantom,
  MC_PET_IMAGES.warden,
  MC_PET_IMAGES.wither,
  MC_PET_IMAGES.dragon
].filter(Boolean);

const WORD_IMAGE_OVERRIDES = {
  creeper: '../消灭苦力怕打字游戏/assets/generated/typing-defense-assets/creeper_idle.png',
  diamond: 'https://minecraft.wiki/w/Special:Redirect/file/Diamond.png',
  pickaxe: 'https://minecraft.wiki/w/Special:Redirect/file/Diamond_Pickaxe.png',
  sword: 'https://minecraft.wiki/w/Special:Redirect/file/Diamond_Sword.png',
  block: 'https://minecraft.wiki/w/Special:Redirect/file/Grass_Block.png',
  stone: 'https://minecraft.wiki/w/Special:Redirect/file/Stone.png',
  allay: MC_PET_IMAGES.allay,
  axolotl: MC_PET_IMAGES.axolotl,
  blaze: MC_PET_IMAGES.blaze,
  cat: MC_PET_IMAGES.cat,
  creeper: MC_PET_IMAGES.creeper,
  dragon: MC_PET_IMAGES.dragon,
  enderman: MC_PET_IMAGES.enderman,
  ghast: MC_PET_IMAGES.ghast,
  'iron golem': MC_PET_IMAGES.ironGolem,
  parrot: MC_PET_IMAGES.parrot,
  phantom: MC_PET_IMAGES.phantom,
  rabbit: MC_PET_IMAGES.rabbit,
  skeleton: MC_PET_IMAGES.skeleton,
  spider: MC_PET_IMAGES.spider,
  turtle: MC_PET_IMAGES.turtle,
  warden: MC_PET_IMAGES.warden,
  wither: MC_PET_IMAGES.wither,
  wolf: MC_PET_IMAGES.wolf,
  zombie: MC_PET_IMAGES.zombie,
  apple: 'https://minecraft.wiki/w/Special:Redirect/file/Apple.png',
  red: 'https://minecraft.wiki/w/Special:Redirect/file/Red_Wool.png',
  sun: 'https://minecraft.wiki/w/Special:Redirect/file/Sunflower.png',
  fire: 'https://minecraft.wiki/w/Special:Redirect/file/Fire.png',
  tree: 'https://minecraft.wiki/w/Special:Redirect/file/Oak_Sapling.png',
  house: 'https://minecraft.wiki/w/Special:Redirect/file/Oak_Door.png'
};

const FARM_TARGET_IMAGES = {
  chicken: `${ASSET_BASE}/enemy_chicken.png`,
  pig: `${ASSET_BASE}/enemy_pig.png`,
  sheep: `${ASSET_BASE}/enemy_sheep.png`
};

const FALLBACK_TARGET_IMAGES = {
  animal: [
    ...MC_ANIMAL_FALLBACK_IMAGES,
    `${ASSET_BASE}/enemy_chicken.png`,
    `${ASSET_BASE}/enemy_pig.png`,
    `${ASSET_BASE}/enemy_sheep.png`,
    `${ASSET_BASE}/enemy_boar.png`,
    `${ASSET_BASE}/enemy_chick.png`,
    `${ASSET_BASE}/enemy_mouse.png`
  ],
  animals: [
    ...MC_ANIMAL_FALLBACK_IMAGES,
    `${ASSET_BASE}/enemy_chicken.png`,
    `${ASSET_BASE}/enemy_pig.png`,
    `${ASSET_BASE}/enemy_sheep.png`
  ],
  block: [
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/bush_green.png`,
    `${ASSET_BASE}/signpost_wood.png`
  ],
  color: [
    `${ASSET_BASE}/flower_patch_mixed.png`,
    `${ASSET_BASE}/flower_patch_sun.png`
  ],
  environment: [
    `${ASSET_BASE}/bush_green.png`,
    `${ASSET_BASE}/flower_patch_mixed.png`
  ],
  food: [
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/flower_patch_sun.png`
  ],
  greeting: [
    `${ASSET_BASE}/signpost_wood.png`
  ],
  item: [
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/signpost_wood.png`
  ],
  mob: [
    ...MC_MOB_FALLBACK_IMAGES,
    `${ASSET_BASE}/enemy_boar.png`,
    `${ASSET_BASE}/enemy_mouse.png`
  ],
  minecraft: [
    ...MC_MOB_FALLBACK_IMAGES,
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/signpost_wood.png`
  ],
  object: [
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/signpost_wood.png`
  ],
  place: [
    `${ASSET_BASE}/signpost_wood.png`,
    `${ASSET_BASE}/bush_green.png`
  ],
  plant: [
    `${ASSET_BASE}/flower_patch_mixed.png`,
    `${ASSET_BASE}/flower_patch_sun.png`,
    `${ASSET_BASE}/bush_green.png`
  ],
  tool: [
    `${ASSET_BASE}/crate_wood.png`
  ],
  external: [
    `${ASSET_BASE}/enemy_chick.png`,
    `${ASSET_BASE}/enemy_mouse.png`,
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/signpost_wood.png`
  ]
};

const BOMB_IMAGES = [
  `${ASSET_BASE}/bomb_plain.png`,
  `${ASSET_BASE}/bomb_ring.png`,
  `${ASSET_BASE}/bomb_star.png`,
  `${ASSET_BASE}/bomb_band.png`,
  `${ASSET_BASE}/bomb_rope.png`,
  `${ASSET_BASE}/bomb_skull.png`
];

const BURST_IMAGES = [
  `${ASSET_BASE}/hit_burst_star.png`,
  `${ASSET_BASE}/hit_burst_spike.png`,
  `${ASSET_BASE}/hit_burst_flash.png`,
  `${ASSET_BASE}/hit_burst_badge.png`
];

const THEMES = [
  'sun',
  'sky',
  'leaf',
  'amber',
  'aqua',
  'mint',
  'peach',
  'violet',
  'coral'
];

const CATEGORY_ICONS = {
  animal: 'A',
  animals: 'A',
  color: 'C',
  food: 'F',
  item: 'I',
  mob: 'M',
  nature: 'N',
  object: 'O',
  place: 'P',
  plant: 'L',
  tool: 'T'
};

const MINECRAFT_IMAGE_CATEGORIES = new Set([
  'animal',
  'animals',
  'block',
  'color',
  'environment',
  'food',
  'item',
  'minecraft',
  'mob',
  'plant',
  'tool'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeBrowserData(filePath, globalName, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `window.${globalName} = ${JSON.stringify(data, null, 2)};\n`,
    'utf8'
  );
}

function repoRelative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function syncRootVocabFromUpstream() {
  const registry = require(path.join(REPO_ROOT, 'scripts', 'sync_vocab_registry.cjs'));
  if (!registry || typeof registry.sync !== 'function') {
    throw new Error('sync_vocab_registry.cjs should export sync()');
  }
  registry.sync();
  const combined = require(path.join(REPO_ROOT, 'scripts', 'build_word_memory_combined_vocab.cjs'));
  if (!combined || typeof combined.build !== 'function') {
    throw new Error('build_word_memory_combined_vocab.cjs should export build()');
  }
  const result = combined.build();
  writeJson(path.join(REPO_ROOT, 'data', 'vocab', 'word-memory-combined', 'views', 'all.json'), result.view);
  writeJson(path.join(REPO_ROOT, 'data', 'vocab', 'word-memory-combined', 'manifest.json'), result.manifest);
  writeJson(path.join(REPO_ROOT, 'data', 'vocab', 'word-memory-combined', 'reports', 'import-summary.json'), result.report);
}

function normalizeWord(text) {
  return String(text || '').trim().toLowerCase();
}

function normalizeTranslation(text) {
  return String(text || '').trim();
}

function normalizeImagePath(imagePath) {
  const value = String(imagePath || '').trim();
  if (!value) {
    return '';
  }
  if (/^https?:\/\//i.test(value) || value.startsWith('./') || value.startsWith('../')) {
    return value;
  }
  if (value.startsWith('assets/')) {
    return `../../${value}`;
  }
  return value;
}

function targetImageFor(card) {
  const word = normalizeWord(card.word);
  if (WORD_IMAGE_OVERRIDES[word]) {
    return WORD_IMAGE_OVERRIDES[word];
  }
  if (FARM_TARGET_IMAGES[word]) {
    return FARM_TARGET_IMAGES[word];
  }
  return normalizeImagePath(card.image) || externalCandidateImageFor(card);
}

function externalCandidateImageFor(card) {
  const candidates = Array.isArray(card.externalImageCandidates)
    ? card.externalImageCandidates
    : [];
  const first = candidates.find(candidate => candidate && candidate.url && shouldUseExternalCandidate(card, candidate));
  return first ? normalizeImagePath(first.url) : '';
}

function shouldUseExternalCandidate(card, candidate) {
  try {
    const host = new URL(candidate.url).hostname.toLowerCase();
    if (host === 'minecraft.wiki') {
      const category = String(card.viewCategory || card.category || '').trim();
      return MINECRAFT_IMAGE_CATEGORIES.has(category);
    }
  } catch (error) {
    return false;
  }
  return true;
}

function fallbackTargetImageFor(card, index = 0) {
  const category = String(card.viewCategory || card.category || '').trim();
  const options = FALLBACK_TARGET_IMAGES[category] || [
    `${ASSET_BASE}/enemy_chick.png`,
    `${ASSET_BASE}/enemy_mouse.png`,
    `${ASSET_BASE}/crate_wood.png`,
    `${ASSET_BASE}/signpost_wood.png`,
    `${ASSET_BASE}/enemy_chick.png`
  ];
  return options[index % options.length];
}

function directRemoteImageUrl(imageUrl) {
  try {
    const url = new URL(imageUrl);
    const fileMatch = url.pathname.match(/\/w\/File:(.+)$/);
    if (/minecraft\.wiki$/i.test(url.hostname) && fileMatch) {
      return `${url.origin}/w/Special:Redirect/file/${fileMatch[1]}`;
    }
    const twemojiMatch = url.pathname.match(/\/v\/latest\/svg\/([^/]+\.svg)$/);
    if (url.hostname === 'twemoji.maxcdn.com' && twemojiMatch) {
      return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${twemojiMatch[1]}`;
    }
  } catch (error) {
    return imageUrl;
  }
  return imageUrl;
}

function extensionForRemoteImage(imageUrl) {
  try {
    const url = new URL(imageUrl);
    if (/images\.unsplash\.com$/i.test(url.hostname)) {
      return '.jpg';
    }
    const name = path.basename(url.pathname);
    const extension = path.extname(name).toLowerCase();
    return extension && extension.length <= 6 ? extension : '.png';
  } catch (error) {
    return '.png';
  }
}

function cachedImageLooksValid(filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size <= 100) {
    return false;
  }
  const head = fs.readFileSync(filePath).subarray(0, 80).toString('utf8').trimStart().toLowerCase();
  return !head.startsWith('<!doctype') && !head.startsWith('<html');
}

async function cacheRemoteImage(card, imageUrl) {
  const word = normalizeWord(card.word);
  const resolvedImageUrl = directRemoteImageUrl(imageUrl);
  const extension = extensionForRemoteImage(resolvedImageUrl);
  const fileName = `${word}${extension}`;
  const outPath = path.join(CACHED_IMAGE_DIR, fileName);
  const browserPath = `./assets/generated/minecraft-memory-adapter/images/${fileName}`;

  if (cachedImageLooksValid(outPath)) {
    return browserPath;
  }

  fs.mkdirSync(CACHED_IMAGE_DIR, { recursive: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(resolvedImageUrl, {
      redirect: 'follow',
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`failed to cache ${word} image: ${response.status} ${resolvedImageUrl}`);
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.startsWith('image/')) {
    throw new Error(`remote ${word} image is not an image: ${contentType} ${resolvedImageUrl}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length <= 100) {
    throw new Error(`cached ${word} image is too small: ${resolvedImageUrl}`);
  }
  fs.writeFileSync(outPath, bytes);
  return browserPath;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function resolvedTargetImageFor(card, index = 0, fallbackImage = '') {
  const image = targetImageFor(card);
  if (!image) {
    return fallbackImage || fallbackTargetImageFor(card, index);
  }
  if (/^https?:\/\//i.test(image)) {
    return directRemoteImageUrl(image);
  }
  return image;
}

function iconFor(card) {
  const category = String(card.viewCategory || card.category || '').trim();
  return CATEGORY_ICONS[category] || 'M';
}

function hintFor(card) {
  return String(card.phrase || card.example || card.viewCategory || card.category || 'minecraft word').trim();
}

async function adaptCard(card, index) {
  const word = normalizeWord(card.word);
  const translation = normalizeTranslation(card.translation);
  if (!word || !translation) {
    throw new Error(`invalid memory card at index ${index}`);
  }

  const enemyFallbackImage = fallbackTargetImageFor(card, index);

  return {
    id: card.id || `mc-memory-${word}`,
    word,
    translation,
    icon: iconFor(card),
    theme: THEMES[index % THEMES.length],
    hint: hintFor(card),
    enemyImage: await resolvedTargetImageFor(card, index, enemyFallbackImage),
    enemyFallbackImage,
    bombImage: BOMB_IMAGES[index % BOMB_IMAGES.length],
    burstImage: BURST_IMAGES[index % BURST_IMAGES.length],
    viewCategory: card.viewCategory || card.category || 'minecraft',
    level: card.level || '',
    difficulty: Number(card.difficulty || 1),
    sourceCardId: card.id || '',
    sourceProvider: card.sourceProvider || '',
    sourcePackId: card.sourcePackId || '',
    sourceModuleId: card.sourceModuleId || '',
    sourceFile: card.sourceFile || '',
    sourceIndex: Number.isFinite(card.sourceIndex) ? card.sourceIndex : '',
    mergedSource: card.mergedSource || '',
    sourceImage: card.image || ''
  };
}

async function build(options = {}) {
  if (options.syncSource) {
    syncRootVocabFromUpstream();
  }
  if (!fs.existsSync(ROOT_VOCAB_ALL_VIEW_PATH)) {
    throw new Error(
      `root vocab source is missing: ${ROOT_VOCAB_ALL_VIEW_PATH}\n`
      + 'Run scripts/sync_vocab_registry.cjs first, or run this script with --sync-source.'
    );
  }

  const source = readJson(ROOT_VOCAB_ALL_VIEW_PATH);
  const cards = [];
  if (Array.isArray(source.cards)) {
    cards.push(...await mapLimit(source.cards, IMAGE_FETCH_CONCURRENCY, adaptCard));
  }

  const words = new Set(cards.map(card => card.word));
  if (words.size !== cards.length) {
    throw new Error('minecraft memory adapter requires unique words');
  }
  if (cards.length < 18) {
    throw new Error(`minecraft memory adapter expected at least 18 cards, got ${cards.length}`);
  }

  return {
    title: 'Minecraft 单词记忆射击场词卡',
    prototypeId: 'word-memory-topdown',
    adapterVersion: 'minecraft-memory-v1',
    source: {
      packId: 'word-memory-combined',
      moduleId: source.sourceModuleId || source.id || 'word-memory-combined',
      moduleType: source.type || 'vocab-view',
      viewId: source.viewId || 'all',
      generatedAt: source.generatedAt || '',
      file: repoRelative(ROOT_VOCAB_ALL_VIEW_PATH),
      registryManifest: repoRelative(ROOT_VOCAB_MANIFEST_PATH),
      upstreamFile: repoRelative(UPSTREAM_SOURCE_PATH)
    },
    notes: [
      'Active data is generated from the root game vocab package.',
      'Target images prefer source card images and external image candidates loaded online; project-local Minecraft poses and farm sprites are browser fallbacks.'
    ],
    cards
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const data = await build({
    syncSource: args.has('--sync-source')
  });
  writeJson(OUTPUT_PATH, data);
  writeBrowserData(FILE_FALLBACK_PATH, 'WORD_MEMORY_CARDS_DATA', data);
  writeJson(SNAPSHOT_PATH, data);
  writeJson(MANIFEST_PATH, {
    prototypeId: data.prototypeId,
    adapterVersion: data.adapterVersion,
    source: data.source,
    outputs: [
      repoRelative(OUTPUT_PATH),
      repoRelative(FILE_FALLBACK_PATH),
      repoRelative(SNAPSHOT_PATH)
    ],
    cardCount: data.cards.length,
    cachedImageCount: data.cards.filter(card => /minecraft-memory-adapter\/images\//.test(card.enemyImage)).length,
    categories: [...new Set(data.cards.map(card => card.viewCategory))].sort(),
    words: data.cards.map(card => card.word)
  });
  console.log(`saved ${data.cards.length} Minecraft memory cards`);
  console.log(repoRelative(OUTPUT_PATH));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  build,
  syncRootVocabFromUpstream,
  targetImageFor,
  normalizeImagePath
};
