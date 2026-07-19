const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const sourceSpecs = [
  ['kindergarten', path.join(root, 'data', 'vocab', '单词库_分级', '01_幼儿园', '幼儿园完整词库.js'), 'MERGED_KINDERGARTEN_VOCAB'],
  ['lower-grade', path.join(root, 'data', 'vocab', '单词库_分级', '03_小学_高年级', '小学低年级基础.js'), 'STAGE_ELEMENTARY_LOWER'],
  ['bridge', path.join(root, 'data', 'vocab', '单词库_分级', '04_我的世界', 'minecraft_basic.js'), 'VOCAB_1_MINECRAFT____BASIC']
];
const KINDERGARTEN_MINECRAFT_EXCLUSIONS = new Set(['inventory', 'respawn', 'spawn', 'coordinates', 'leggings', 'boots', 'damage', 'health', 'hunger', 'pyramid']);

const MINECRAFT_BANDS = [
  { id: 'minecraft-core', label: '常用核心', labelEn: 'Core Words', description: '先学最常见的方块、动作、动物和生存词。', rank: 1 },
  { id: 'minecraft-basic', label: '常见基础', labelEn: 'Everyday Basics', description: '加入日常物品、资源和简单游戏操作。', rank: 2 },
  { id: 'minecraft-building', label: '建造与工具', labelEn: 'Building & Tools', description: '学习搭建房屋、采集和制作工具的词。', rank: 3 },
  { id: 'minecraft-mobs', label: '生物与战斗', labelEn: 'Mobs & Combat', description: '认识动物、生物、装备和战斗场景。', rank: 4 },
  { id: 'minecraft-world', label: '世界与环境', labelEn: 'World & Nature', description: '探索群系、结构、植物和不同地形。', rank: 5 },
  { id: 'minecraft-advanced', label: '机制与进阶', labelEn: 'Advanced Mechanics', description: '最后挑战效果、进度和复杂变体词。', rank: 6 }
];
const MINECRAFT_BAND_BY_ID = new Map(MINECRAFT_BANDS.map(band => [band.id, band]));

// This is a small, reviewable high-frequency whitelist. Category rules place the long tail into themed bands.
const MINECRAFT_CORE_WORDS = new Set([
  'air', 'block', 'world', 'stone', 'dirt', 'grass', 'grass block', 'sand', 'water', 'lava', 'wood', 'log', 'plank', 'tree',
  'leaf', 'leaves', 'flower', 'seed', 'wheat', 'apple', 'bread', 'carrot', 'potato', 'egg', 'milk', 'cow', 'pig', 'sheep',
  'chicken', 'cat', 'dog', 'wolf', 'horse', 'fish', 'bee', 'rabbit', 'villager', 'zombie', 'skeleton', 'creeper', 'spider',
  'enderman', 'slime', 'chest', 'door', 'bed', 'torch', 'campfire', 'furnace', 'crafting table', 'pickaxe', 'axe', 'shovel',
  'sword', 'bow', 'shield', 'bucket', 'boat', 'minecart', 'map', 'diamond', 'iron', 'gold', 'coal', 'emerald', 'redstone',
  'ore', 'glass', 'brick', 'wool', 'fence', 'ladder', 'stairs', 'cave', 'village', 'house', 'farm', 'mine', 'craft', 'crafting',
  'build', 'break', 'place', 'dig', 'jump', 'run', 'swim', 'eat', 'drink', 'fight', 'explore', 'find', 'collect', 'use', 'open',
  'close', 'attack', 'protect', 'survival mode', 'creative mode', 'minecraft',
  'ice', 'clay', 'bell', 'loom', 'rail', 'tuff', 'anvil', 'inventory', 'crafting', 'smelting', 'enchanting', 'brewing',
  'respawn', 'spawn', 'mob', 'hostile', 'passive', 'neutral', 'health', 'hunger', 'damage', 'chunk', 'drops', 'loot',
  'trade', 'tame', 'breed', 'potion', 'recipe', 'obsidian', 'slab', 'stair', 'trapdoor', 'ender chest', 'piston',
  'dispenser', 'dropper', 'hopper', 'beacon', 'cauldron', 'enchanting table', 'brewing stand', 'glowstone', 'sea lantern',
  'netherrack', 'soul sand', 'end stone', 'terracotta', 'concrete', 'bamboo', 'lily pad', 'hay bale', 'copper',
  'lapis lazuli', 'quartz', 'amethyst', 'ingot', 'nugget', 'dust', 'slimeball', 'blaze rod', 'blaze powder', 'nether star',
  'dragon egg', 'totem of undying', 'ender pearl', 'eye of ender', 'shulker shell', 'prismarine shard', 'nautilus shell',
  'heart of the sea', 'scute', 'arrow', 'crossbow', 'trident', 'hoe', 'flint and steel', 'shears', 'name tag', 'lead',
  'saddle', 'spyglass', 'lantern', 'spawn egg', 'helmet', 'chestplate', 'leggings', 'boots', 'melon', 'cookie'
]);
const MINECRAFT_ADVANCED_WORDS = new Set([
  'coordinates', 'status effect', 'redstone circuit', 'advancement', 'spectator mode', 'hardcore mode', 'adventure mode',
  'debug stick', 'lodestone compass', 'command block', 'nether reactor core', 'the void'
]);
const MINECRAFT_VARIANT_MARKERS = /\b(?:deepslate|polished|chiseled|cracked|damaged|rusty|snowy|potted|stripped|oxidized|cut|glazed|powder|slab|stairs|wall|fence gate|spawner|spawn egg|vibrant visuals|with kelp|with blackstone|with basalt|with gold snout|music disc|banner pattern|horse armor|boat with|minecart with|arrow of|fire resistance|night vision|jump boost|instant damage|slow falling)\b/i;

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
}

function readVocabulary(filePath, variableName) {
  const context = {};
  const source = fs.readFileSync(filePath, 'utf8');
  vm.runInNewContext(`${source}\n;globalThis.__vocabResult = ${variableName};`, context, { filename: filePath });
  return Array.isArray(context.__vocabResult) ? context.__vocabResult : [];
}

function buildSets() {
  return Object.fromEntries(sourceSpecs.map(([level, filePath, variableName]) => [
    level,
    new Set(readVocabulary(filePath, variableName).map(item => normalizeWord(item.word || item.standardized)).filter(Boolean))
  ]));
}

function inferLevel(card, sets) {
  const word = normalizeWord(card.word);
  const rawLevel = String(card.level || '').toLowerCase();
  const tags = Array.isArray(card.tags) ? card.tags.map(tag => String(tag).toLowerCase()) : [];
  if (!KINDERGARTEN_MINECRAFT_EXCLUSIONS.has(word) && (sets.kindergarten.has(word) || rawLevel === 'starter' || tags.includes('starter'))) return 'kindergarten';
  if (sets.bridge.has(word) || rawLevel === 'core' || tags.includes('core')) return 'bridge';
  if (sets['lower-grade'].has(word) || rawLevel === 'ket-1' || tags.includes('lower-grade')) return 'lower-grade';
  if (rawLevel === 'advanced' || Number(card.difficulty) >= 3) return 'all';
  return 'minecraft';
}

function normalizeBandWord(value) {
  return String(value || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
}

function inferMinecraftBand(card) {
  const word = normalizeBandWord(card.word);
  const category = String(card.category || card.viewCategory || '').toLowerCase();
  if (MINECRAFT_CORE_WORDS.has(word)) return 'minecraft-core';
  if (MINECRAFT_ADVANCED_WORDS.has(word) || category === 'effect' || category === 'advancement' || MINECRAFT_VARIANT_MARKERS.test(word)) return 'minecraft-advanced';
  if (category === 'mob' || category === 'animal' || /\b(?:mob|hostile|passive|neutral)\b/i.test(word)) return 'minecraft-mobs';
  if (category === 'biome' || category === 'structure' || category === 'plant' || category === 'place' || category === 'environment' || /\b(?:nether|ocean|forest|desert|swamp|taiga|plains|jungle|savanna|portal|stronghold|monument|village|cave)\b/i.test(word)) return 'minecraft-world';
  if (category === 'block' || category === 'tool' || category === 'weapon' || category === 'color' || /\b(?:block|wood|stone|ore|brick|glass|torch|furnace|table|pickaxe|shovel|axe|sword|bow|shield|bucket|boat|minecart|door|bed|chest|fence|ladder)\b/i.test(word)) return 'minecraft-building';
  if (card.sourceProvider === 'mayihaoke' || /^[a-z]+(?: [a-z]+)?$/i.test(word)) return 'minecraft-basic';
  return 'minecraft-advanced';
}

function annotateCards(cards) {
  const sets = buildSets();
  const counts = { kindergarten: 0, bridge: 0, 'lower-grade': 0, minecraft: 0, all: 0 };
  const bandCounts = Object.fromEntries(MINECRAFT_BANDS.map(band => [band.id, 0]));
  const annotated = (cards || []).map(card => {
    const curriculumLevel = inferLevel(card, sets);
    counts[curriculumLevel] += 1;
    const minecraftBand = curriculumLevel === 'minecraft' ? inferMinecraftBand(card) : '';
    if (minecraftBand) bandCounts[minecraftBand] += 1;
    return { ...card, curriculumLevel, minecraftBand };
  });
  return {
    cards: annotated,
    metadata: {
      version: 1,
      defaultLevel: 'kindergarten',
      sourcePacks: sourceSpecs.map(([level, filePath]) => ({ level, file: path.relative(root, filePath).replace(/\\/g, '/') })),
      counts,
      minecraftBandCounts: bandCounts
    }
  };
}

function main() {
  const doc = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
  const annotated = annotateCards(doc.cards);
  doc.cards = annotated.cards;
  doc.curriculumLeveling = annotated.metadata;
  fs.writeFileSync(modulePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.relative(root, modulePath).replace(/\\/g, '/'), counts: annotated.metadata.counts }, null, 2));
}

if (require.main === module) main();

module.exports = { annotateCards, inferLevel, inferMinecraftBand, normalizeWord, normalizeBandWord, MINECRAFT_BANDS };
