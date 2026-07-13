#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..', '..');
const dataDir = path.join(projectRoot, 'data');
const mediaDir = path.join(projectRoot, 'assets', 'media');
const apply = process.argv.includes('--apply');
const pruneMedia = process.argv.includes('--prune-media');
const fullReport = process.argv.includes('--full-report');
const ORIGINAL_MEDIA_COUNT = 6847;
const ORIGINAL_ENCRYPTED_FIELD_COUNT = 119880;
const TOTAL_PRUNED_IMAGE_COUNT = 1186;

const paths = {
  cards: path.join(dataDir, 'cards.json'),
  manifest: path.join(dataDir, 'manifest.json'),
  ankiMinecraftDir: path.join(repoRoot, 'data', 'vocab', '单词库_分级', '04_我的世界'),
  learnCards: path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json'),
  externalCards: path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'word-cards.json'),
  coreCards: path.join(repoRoot, 'data', 'vocab', 'core-english', 'views', 'core.json')
};

const DECORATIVE_MEDIA_RE = /^(?:哈基米薯仔\.png|我的世界-icon \(\d+\)\.png|show(?:-[0-9a-f]{24,})?\.|abstract-empty-|日落時分|老人與|航空照片|莫塔爾|比利時|結束|斯堪的納維亞|世界地圖|郵票在手|野馬免費|維尼森-)/i;
const RANDOM_AUDIO_RE = /^youdao-[0-9a-f-]+\.(?:mp3|wav|ogg|m4a)$/i;
const RANDOM_IMAGE_RE = /^[0-9a-f]{24,}(?:_processed)?\.(?:png|jpe?g|gif|webp|bmp)$/i;
const HASHED_IMAGE_RE = /[0-9a-f]{24,}|[0-9a-f]{8}(?:-[0-9a-f]{8}){2,}/i;
const BAD_TEXT_RE = /[≯≮#]|<[^>]*>|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

const CANONICAL_ZH = {
  air: '空气', amethyst: '紫水晶', animal: '动物', apple: '苹果', armor: '盔甲', arrow: '箭',
  bamboo: '竹子', basalt: '玄武岩', beacon: '信标', bed: '床', bee: '蜜蜂', bell: '钟',
  birch: '桦木', black: '黑色', blackstone: '黑石', blast: '爆炸', blaze: '烈焰人', block: '方块',
  boat: '船', bone: '骨头', book: '书', bottle: '瓶子', brick: '砖', brown: '棕色', bud: '芽',
  budding: '正在生长的', bucket: '桶', cactus: '仙人掌', cake: '蛋糕', campfire: '篝火',
  carrot: '胡萝卜', cave: '洞穴', chain: '锁链', chest: '箱子', chicken: '鸡', clay: '黏土',
  coal: '煤炭', cobbled: '圆石制的', cobblestone: '圆石', cocoa: '可可', command: '命令',
  copper: '铜', coral: '珊瑚', cow: '牛', creeper: '苦力怕', crimson: '绯红', crystal: '晶体',
  dark: '深色的', deepslate: '深板岩', diamond: '钻石', dirt: '泥土', diorite: '闪长岩',
  dragon: '龙', dripstone: '滴水石', drowned: '溺尸', dye: '染料', elder: '远古的',
  emerald: '绿宝石', enchanting: '附魔', end: '末地', ender: '末影', enderman: '末影人',
  engine: '引擎', experience: '经验', eye: '眼睛', farm: '农场', farmland: '耕地', fence: '栅栏',
  fire: '火', flower: '花', furnace: '熔炉', glass: '玻璃', glow: '发光', gold: '金', grass: '草',
  gravel: '砂砾', guardian: '守卫者', honey: '蜂蜜', hopper: '漏斗', horse: '马', ice: '冰',
  iron: '铁', item: '物品', jungle: '丛林', kelp: '海带', lapis: '青金石', lazuli: '青金石', lava: '岩浆',
  leaves: '树叶', light: '光', lightning: '闪电', llama: '羊驼', log: '原木', magma: '岩浆',
  mangrove: '红树', map: '地图', melon: '西瓜', minecart: '矿车', moss: '苔藓', mushroom: '蘑菇',
  mud: '泥巴', nether: '下界', netherite: '下界合金', oak: '橡木', obsidian: '黑曜石',
  ocean: '海洋', ore: '矿石', oxi: '氧化的', oxidized: '氧化的', paper: '纸', pearl: '珍珠',
  pickaxe: '镐', pig: '猪', pillar: '柱子', planks: '木板', plant: '植物', pointed: '尖的',
  polished: '磨制的', potato: '土豆', powder: '粉末', prismarine: '海晶石', pumpkin: '南瓜',
  quartz: '石英', rabbit: '兔子', rail: '铁轨', red: '红色', redstone: '红石', reinforced: '强化的',
  rotten: '腐烂的', sand: '沙子', sandstone: '砂岩', salmon: '鲑鱼', sculk: '幽匿', sea: '海',
  sheep: '羊', shield: '盾牌', shulker: '潜影盒', silver: '银', skeleton: '骷髅', slab: '台阶',
  slime: '史莱姆', smooth: '平滑的', snow: '雪', soul: '灵魂', spider: '蜘蛛', spruce: '云杉',
  stairs: '楼梯', stone: '石头', sugar: '糖', sunflower: '向日葵', sword: '剑', tuff: '凝灰岩', cluster: '晶簇',
  torch: '火把', trader: '商人', trapdoor: '活板门', turtle: '海龟', villager: '村民',
  wall: '墙', water: '水', wheat: '小麦', witch: '女巫', wither: '凋零', wolf: '狼', wool: '羊毛',
  wood: '木头', zombie: '僵尸'
};

Object.assign(CANONICAL_ZH, {
  amplified: '放大的', ambience: '环境音', altitude: '海拔', absorption: '伤害吸收',
  alex: 'Alex', ammonia: '氨', antidote: '解毒剂', arena: '竞技场', azalea: '杜鹃花',
  bleach: '漂白剂', board: '木板', buttercup: '毛茛', cane: '甘蔗', capri: '卡普里蓝',
  chartreuse: '黄绿色', cloth: '布料', compound: '化合物', conversion: '转化', crawling: '爬行',
  crit: '暴击', custom: '自定义', darkness: '黑暗', debug: '调试', default: '默认',
  elixir: '药剂', emote: '表情动作', entities: '实体', entity: '实体', explosion: '爆炸',
  fertilizer: '肥料', fluids: '流体', fog: '雾', friends: '好友', garbage: '垃圾', geode: '晶洞',
  general: '常规', hardcore: '极限模式', header: '页眉', heart: '生命值', haste: '急迫',
  inventory: '物品栏', language: '语言', levitation: '飘浮', locator: '定位', luck: '幸运',
  materials: '材料', mining: '挖掘', nausea: '反胃', navbar: '导航栏', non: '非', ominous: '不祥',
  parched: '干枯', pitcher: '瓶子草', portfolio: '文件夹', potted: '盆栽的', poster: '海报',
  projectile: '投射物', quiver: '箭袋', renewable: '可再生的', resin: '树脂', riding: '骑乘',
  saturation: '饱和', slate: '板岩', snowfall: '降雪', stars: '星星', sulfur: '硫磺', super: '超级',
  thunderstorm: '雷暴', tonic: '补剂', trial: '试炼', utility: '功能', violet: '紫罗兰色',
  ultramarine: '群青色', usb: 'USB', weaving: '编织', wrapped: '包裹的', photo: '照片',
  pitcherpod: '瓶子草荚', 'soul sand': '灵魂沙', 'soul soil': '灵魂土',
  'flowering azalea': '开花的杜鹃花', 'potted azalea': '盆栽杜鹃花',
  'potted torchflower': '盆栽火把花', 'potted flowering azalea': '盆栽开花杜鹃花',
  'violet cloth': '紫罗兰色布料', 'capri cloth': '卡普里蓝布料',
  'chartreuse cloth': '黄绿色布料', 'ultramarine cloth': '群青色布料',
  'wrapped gift': '包装礼物', 'usb charger': 'USB充电器', 'super fertilizer': '超级肥料',
  'resin clump': '树脂团块', 'invicon elixir': '药剂', 'invicon tonic': '补剂',
  'invicon antidote': '解毒剂', 'marble blue': '蓝色大理石', 'marble gold': '金色大理石',
  marble: '大理石', 'arena eye': '竞技场之眼', 'sulfur cube': '硫磺方块',
  'sulfur caves': '硫磺洞穴', 'jagged peaks': '尖峭山峰',
  'windswept gravelly hills': '风袭砂砾丘陵', 'woodland mansion': '林地府邸',
  'trial chambers': '试炼密室', 'trail ruins': '踪迹废墟', 'return to sender': '以牙还牙',
  'a terrible fortress': '令人发怵的要塞', 'uneasy alliance': '不稳定的联盟',
  'war pigs': '猪战士', 'local brewery': '本地酿造厂', 'withering heights': '凋零山峰',
  'remote getaway': '远方避难所', 'getting an upgrade': '装备升级', 'acquire hardware': '获得硬件',
  diamonds: '钻石', enchanter: '附魔师', husbandry: '畜牧业', 'best friends forever': '永远的朋友',
  'a complete catalogue': '完整目录', 'fishy business': '鱼类生意', 'total beelocation': '蜂蜜定位',
  'a balanced diet': '均衡饮食', 'serious dedication': '认真投入', 'bukkit bukkit': '水桶接水',
  'a throwaway joke': '抛出的笑话', 'take aim': '瞄准', 'sniper duel': '狙击手对决',
  'monsters hunted': '怪物猎人', bullseye: '正中靶心', postmortal: '死里逃生',
  'ol betsy': '老贝琪', 'surge protector': '避雷针', 'caves cliffs': '洞穴与悬崖',
  'adventuring time': '冒险时光', sneak: '潜行', effect: '效果', biomes: '生物群系',
  superflat: '超平坦', vibrant: '鲜艳视觉', 'reference options': '参考选项',
  'header background': '页眉背景', 'locator bar icon default': '定位栏默认图标',
  'hardcore heart': '极限模式生命值', 'eggs compressed': '压缩蛋图标', torchflower: '火把花',
  sprint: '疾跑', chat: '聊天', oozing: '渗浆', blindness: '失明', shore: '海岸',
  spore: '孢子', blossom: '花', field: '田野', stony: '多石的'
  , 'nitwit refusing': '傻子村民拒绝交易', 'lefthandedskeleton': '左手骷髅',
  'woodland mansion ingame': '林地府邸游戏内图', 'trial chambers vv': '试炼密室鲜艳视觉图',
  'trail ruins vibrant visuals': '踪迹废墟鲜艳视觉图', 'geode vv': '晶洞鲜艳视觉图',
  'envsprite amplified': '放大的', 'envsprite language': '语言', 'envsprite custom': '自定义',
  'envsprite default': '默认', 'envsprite explosion': '爆炸', 'envsprite altitude': '海拔',
  'envsprite thunderstorm': '雷暴', 'envsprite riding': '骑乘', 'envsprite sprint': '疾跑',
  'envsprite stars': '星星', 'envsprite snowfall': '降雪', 'envsprite renewable resource': '可再生资源',
  'envsprite non renewable resource': '不可再生资源', 'entitysprite conversion': '转化',
  'entitysprite alex': 'Alex', 'effectsprite weaving': '编织', 'effectsprite darkness': '黑暗',
  'effectsprite trial omen': '试炼之兆', 'effectsprite absorption': '伤害吸收',
  'effectsprite saturation': '饱和', 'effectsprite haste': '急迫', 'effectsprite nausea': '反胃',
  'effectsprite oozing': '渗浆', 'effectsprite luck': '幸运', 'effectsprite blindness': '失明',
  'effectsprite levitation': '飘浮', 'effectsprite mining fatigue': '挖掘疲劳',
  'navbar friends': '导航栏好友', 'reference options': '参考选项', stained: '染色的', pane: '玻璃板',
  spawner: '刷怪笼', wart: '疣', purpur: '紫珀', nylium: '菌岩', podzol: '灰化土',
  lilac: '丁香', shroomlight: '菌光体', third: '第三', person: '人称', medium: '中等',
  small: '小型', large: '大型', base: '底部', middle: '中部', tip: '尖端', frustum: '台座',
  conditional: '条件', mountain: '山地', edge: '边缘', tube: '管', fan: '扇', rusty: '锈蚀的',
  grate: '栅格', old: '古老的', growth: '生长', pine: '松树', taiga: '针叶林', grass: '草',
  box: '盒子', infinite: '无限的', books: '书籍', country: '乡村', lode: '矿脉', quite: '完全',
  nine: '九', lives: '条命', hot: '热的', tourist: '游客', destinations: '目的地', city: '城市',
  game: '游戏', today: '今天', thank: '感谢', squad: '小队', hops: '跳跃', hired: '雇佣的',
  help: '帮助', rotate: '旋转', clockwise: '顺时针', orb: '球', visuals: '视觉效果', resource: '资源',
  fatigue: '疲劳', health: '生命值', boost: '提升', music: '音乐', disc: '唱片', mellohi: 'Mellohi',
  npc: 'NPC', jump: '跳跃', lit: '已点燃的', stained: '染色的', 'magma cube': '岩浆怪',
  azure: '天蓝色', t: 'T', bordure: '边框', indented: '内凹的', banner: '旗帜', pattern: '图案',
  meitnerium: 'Mt元素', platinum: '铂', bohrium: 'Bh元素', bromine: '溴', uranium: '铀',
  radium: '镭', nitrogen: '氮', krypton: '氪', argon: '氩', gallium: '镓', holmium: '钬',
  tennessine: 'Ts元素', dubnium: 'Db元素', nihonium: 'Nh元素', oganesson: 'Og元素',
  radon: '氡', flerovium: 'Fl元素', francium: '钫', copernicium: 'Cn元素', curium: '锔',
  seaborgium: 'Sg元素', yttrium: '钇', fluorine: '氟', livermorium: 'Lv元素', moscovium: 'Mc元素',
  dysprosium: '镝', 'nether reactor core': '下界反应堆核心',
  'finished nether reactor core': '已完成的下界反应堆核心',
  'initialized nether reactor core': '已初始化的下界反应堆核心',
  "jack o'lantern": '南瓜灯',
  "dolphin's grace": '海豚的恩惠'
});

const CANONICAL_PHRASE_ZH = {
  lapislazuli: '青金石', redstone: '红石', amethystcluster: '紫水晶晶簇',
  deepslatelapislazuli: '深板岩青金石', deepslateemerald: '深板岩绿宝石',
  deepslatecoal: '深板岩煤矿石', deepslategold: '深板岩金矿石',
  deepslatecopper: '深板岩铜矿石', deepslateiron: '深板岩铁矿石',
  deepslatediamond: '深板岩钻石矿石', netherquartz: '下界石英', nethergold: '下界金矿石'
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/chisel+ed/g, 'chiseled')
    .replace(/[^a-z0-9]+/g, '');
}

function cleanFilename(value) {
  return String(value || '')
    .replace(/\.[^.]+$/i, '')
    .replace(/^itemsprite[_-]/i, '')
    .replace(/^(?:envsprite|entitysprite|effectsprite)[_-]/i, '')
    .replace(/^AF\d+\s+/i, '')
    .replace(/^InvIcon\s+/i, '')
    .replace(/^\d+px[-_\s]+/i, '')
    .replace(/\s+TextureUpdate Revision.*$/i, '')
    .replace(/\s+Vibrant Visuals.*$/i, '')
    .replace(/\s+processed$/i, '')
    .replace(/\s+compressed$/i, '')
    .replace(/\s+Age\s+\d+/gi, '')
    .replace(/\s+\(layers?\s+\d+\)/gi, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+(?:JE|BE)\d+(?:\s+BE\d+)?/gi, '')
    .replace(/\s+(?:HP|FN|EV|UD|JA|CW|DT|HD)\s+MCD/gi, '')
    .replace(/\s+[A-Z]{1,3}\s+MCD$/i, '')
    .replace(/\s+\d+$/g, '')
    .replace(/_processed$/i, '')
    .replace(/[_-]\d+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\bChiselled\b/gi, 'Chiseled')
    .replace(/^Block\s+(?!of\b)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDecorativeMedia(name) {
  const mediaName = String(name || '');
  return DECORATIVE_MEDIA_RE.test(mediaName) || RANDOM_IMAGE_RE.test(mediaName) || HASHED_IMAGE_RE.test(mediaName);
}

function isRandomAudio(name) {
  return RANDOM_AUDIO_RE.test(String(name || ''));
}

function cleanText(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > maxLength || BAD_TEXT_RE.test(text)) return '';
  return text;
}

function cleanChinese(value, maxLength = 80) {
  const text = cleanText(value, maxLength).replace(/^例句[:：]\s*/u, '').trim();
  return /[\u4e00-\u9fff]/u.test(text) ? text : '';
}

function isUsableChinese(value) {
  return Boolean(value) && !/[（(]英文[）)]/.test(value) && !value.includes('积木') && !value.includes('Minecraft词条');
}

function candidateKeys(value) {
  const clean = cleanFilename(value);
  const variants = [clean];
  if (/^Block of /i.test(clean)) variants.push(clean.replace(/^Block of /i, ''));
  if (/^The /i.test(clean)) variants.push(clean.replace(/^The /i, ''));
  return [...new Set(variants.map(normalizeKey).filter(Boolean))];
}

function sourceArray(filePath) {
  try {
    const loaded = require(filePath);
    if (Array.isArray(loaded)) return loaded;
    return Object.values(loaded || {}).find(value => Array.isArray(value)) || [];
  } catch {
    return [];
  }
}

function loadSourceRecords() {
  const records = [];
  const archiveFiles = fs.readdirSync(paths.ankiMinecraftDir).filter(file => file.endsWith('.js'));
  for (const file of archiveFiles) {
    for (const record of sourceArray(path.join(paths.ankiMinecraftDir, file))) {
      records.push({ record, source: `minecraft-${file}`, priority: 10 });
    }
  }
  const currentDir = path.join(repoRoot, 'data', 'vocab', '单词库_分级', '04_我的世界');
  for (const file of fs.readdirSync(currentDir).filter(file => file.endsWith('.js'))) {
    for (const record of sourceArray(path.join(currentDir, file))) {
      records.push({ record, source: `minecraft-current-${file}`, priority: 12 });
    }
  }
  const genericDirs = ['01_幼儿园', '03_小学_高年级', '05_初中', '08_幼小衔接']
    .map(name => path.join(repoRoot, 'data', 'vocab', '单词库_分级', name));
  for (const genericDir of genericDirs) {
    if (!fs.existsSync(genericDir)) continue;
    const files = [];
    const walk = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const next = path.join(current, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith('.js')) files.push(next);
      }
    };
    walk(genericDir);
    for (const file of files) {
      for (const record of sourceArray(file)) records.push({ record, source: `general-${path.basename(file)}`, priority: 30 });
    }
  }
  const external = readJson(paths.externalCards);
  for (const record of external.cards || []) records.push({ record, source: 'mayihaoke-snapshot', priority: 2 });
  const learn = readJson(paths.learnCards);
  for (const record of learn.cards || []) records.push({ record, source: 'learn-center', priority: 1 });
  const core = readJson(paths.coreCards);
  for (const record of core.cards || []) records.push({ record, source: 'core-english', priority: 20 });
  return records;
}

function buildSourceIndex(records) {
  const index = new Map();
  const tokenZh = new Map(Object.entries(CANONICAL_ZH));
  for (const entry of records) {
    const record = entry.record || {};
    const chinese = cleanChinese(record.chinese || record.translation || record.exampleZh || record.example_zh);
    const normalized = {
      word: cleanText(record.standardized || record.word, 100),
      chinese,
      phonetic: cleanText(record.phonetic, 80),
      phrase: cleanText(record.phrase, 100),
      phraseTranslation: cleanChinese(record.phraseTranslation || record.phrase_translation),
      sentence: cleanText(record.example || record.sentence, 180),
      sentenceTranslation: cleanChinese(record.exampleZh || record.example_zh || record.exampleTranslation),
      category: cleanText(record.category, 60),
      source: entry.source,
      priority: entry.priority
    };
    const aliases = [record.word, record.standardized, ...(record.imageURLs || []).map(item => item?.filename)];
    for (const alias of aliases.flatMap(candidateKeys)) {
      const old = index.get(alias);
      if (!old || normalized.priority < old.priority || (!old.chinese && normalized.chinese)) index.set(alias, normalized);
    }
    const token = normalizeKey(record.word);
    if (token && !String(record.word || '').includes(' ') && isUsableChinese(chinese) && !tokenZh.has(token)) tokenZh.set(token, chinese);
  }
  return { index, tokenZh };
}

function lookup(index, word) {
  for (const key of candidateKeys(word)) {
    const result = index.get(key);
    if (result) return result;
  }
  return null;
}

function translateCompound(word, tokenZh) {
  const phraseKey = normalizeKey(word);
  const exactChinese = CANONICAL_ZH[String(word || '').toLowerCase()];
  if (exactChinese) return exactChinese;
  if (CANONICAL_PHRASE_ZH[phraseKey]) return CANONICAL_PHRASE_ZH[phraseKey];
  const lowerWord = String(word || '').toLowerCase();
  const tokens = lowerWord.split(/\s+|-/).filter(Boolean);
  if (phraseKey.endsWith('stainedglasspane')) {
    const color = tokens.find(token => CANONICAL_ZH[token] && /black|blue|brown|cyan|gray|green|lime|magenta|orange|pink|purple|red|white|yellow/.test(token));
    if (color) return `${CANONICAL_ZH[color]}染色玻璃板`;
  }
  if (phraseKey.endsWith('spawner')) {
    const mob = lowerWord.replace(/\s*spawner$/, '').trim();
    return mob ? `${translateCompound(mob, tokenZh)}刷怪笼` : '刷怪笼';
  }
  if (phraseKey === 'healthboost') return '生命值提升';
  if (phraseKey === 'musicdiscmellohi') return 'Mellohi音乐唱片';
  if (phraseKey.endsWith('ore')) {
    const oreHead = phraseKey.slice(0, -3);
    if (CANONICAL_PHRASE_ZH[oreHead]) {
      const translatedOreHead = CANONICAL_PHRASE_ZH[oreHead];
      return translatedOreHead.endsWith('矿石') ? translatedOreHead : `${translatedOreHead}矿石`;
    }
  }
  const translated = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (normalizeKey(token) === 'lapis' && normalizeKey(tokens[index + 1]) === 'lazuli') {
      translated.push('青金石');
      index += 1;
      continue;
    }
    translated.push((() => {
    const key = normalizeKey(token);
    if (CANONICAL_ZH[key]) return CANONICAL_ZH[key];
    if (tokenZh.has(key)) return tokenZh.get(key);
    if (/^tnt$/i.test(token)) return 'TNT';
    if (/^xp$/i.test(token)) return '经验值';
    if (/ingot$/i.test(token)) return `${translateCompound(token.replace(/ingot$/i, ''), tokenZh)}锭`;
    if (/ore$/i.test(token)) return `${translateCompound(token.replace(/ore$/i, ''), tokenZh)}矿石`;
    if (/block$/i.test(token)) return `${translateCompound(token.replace(/block$/i, ''), tokenZh)}方块`;
    return '';
    })());
  }
  if (translated.every(Boolean)) return translated.join('');
  const known = translated.filter(Boolean).join('');
  return known ? `Minecraft中的${known}` : `Minecraft词条“${word}”`;
}

function categoryFor(card, source) {
  const deck = card.deckPath.join(' ').toLowerCase();
  const sourceCategory = String(source?.category || '').toLowerCase();
  if (/mob|animal|creature|monster|生物|村民/.test(deck) || /animal|mob|monster|creature|boss/.test(sourceCategory)) return 'mob';
  if (/biome|群系/.test(deck) || /biome|environment/.test(sourceCategory)) return 'biome';
  if (/structure|结构/.test(deck)) return 'structure';
  if (/advancement|进度/.test(deck) || /advancement/.test(sourceCategory)) return 'advancement';
  if (/effect|状态/.test(deck) || /effect/.test(sourceCategory)) return 'effect';
  if (/tool|工具/.test(deck) || /tool/.test(sourceCategory)) return 'tool';
  if (/weapon|武器/.test(deck) || /weapon/.test(sourceCategory)) return 'weapon';
  if (/food|食物/.test(deck) || /food/.test(sourceCategory)) return 'food';
  if (/plant|植物|农耕/.test(deck) || /plant/.test(sourceCategory)) return 'plant';
  if (/dye|染料|color|颜色/.test(deck) || /color|dye/.test(sourceCategory)) return 'color';
  if (/icon|图标/.test(deck)) return 'icon';
  if (/block|方块/.test(deck) || /block|material/.test(sourceCategory)) return 'block';
  return 'item';
}

function generatedPhrase(word, chinese, category) {
  const first = word.toLowerCase();
  if (category === 'mob') return { phrase: `a friendly ${first}`, phraseTranslation: `一只友好的${chinese}` };
  if (category === 'biome') return { phrase: `explore the ${first}`, phraseTranslation: `探索${chinese}` };
  if (category === 'structure') return { phrase: `find a ${first}`, phraseTranslation: `找到一座${chinese}` };
  if (category === 'tool' || category === 'weapon') return { phrase: `use a ${first}`, phraseTranslation: `使用${chinese}` };
  if (category === 'food') return { phrase: `eat ${first}`, phraseTranslation: `吃${chinese}` };
  if (category === 'plant') return { phrase: `grow ${first}`, phraseTranslation: `种植${chinese}` };
  if (category === 'effect') return { phrase: `get the ${first} effect`, phraseTranslation: `获得${chinese}效果` };
  if (category === 'advancement') return { phrase: `complete ${first}`, phraseTranslation: `完成${chinese}` };
  if (category === 'color') return { phrase: `${first} wool`, phraseTranslation: `${chinese}羊毛` };
  return { phrase: `use ${first}`, phraseTranslation: `使用${chinese}` };
}

function generatedSentence(word, chinese, category) {
  const first = word.toLowerCase();
  if (category === 'mob') return { sentence: `A ${first} is near the village.`, sentenceTranslation: `一只${chinese}在村庄附近。` };
  if (category === 'biome') return { sentence: `We explore the ${first} at sunrise.`, sentenceTranslation: `我们在日出时探索${chinese}。` };
  if (category === 'structure') return { sentence: `We find the ${first} in the new world.`, sentenceTranslation: `我们在新世界里找到${chinese}。` };
  if (category === 'tool' || category === 'weapon') return { sentence: `I use the ${first} to collect resources.`, sentenceTranslation: `我用${chinese}收集资源。` };
  if (category === 'food') return { sentence: `I eat the ${first} after mining.`, sentenceTranslation: `挖矿后我吃${chinese}。` };
  if (category === 'plant') return { sentence: `I grow ${first} near the farm.`, sentenceTranslation: `我在农场旁种植${chinese}。` };
  if (category === 'effect') return { sentence: `The ${first} effect helps me explore.`, sentenceTranslation: `${chinese}效果帮助我探索。` };
  if (category === 'advancement') return { sentence: `We complete the ${first} challenge.`, sentenceTranslation: `我们完成“${chinese}”挑战。` };
  if (category === 'color') return { sentence: `The wool is ${first}.`, sentenceTranslation: `羊毛是${chinese}色的。` };
  return { sentence: `I use ${first} in my Minecraft build.`, sentenceTranslation: `我在 Minecraft 建筑中使用${chinese}。` };
}

function chooseWord(card) {
  const images = (card.media || []).filter(item => item.kind === 'image' && item.available !== false && !isDecorativeMedia(item.name));
  const directAudio = (card.media || []).filter(item => item.kind === 'audio' && item.available !== false && !isRandomAudio(item.name));
  const mediaNames = (card.media || []).map(item => String(item.name || ''));
  if (directAudio.some(item => /^Jack of the Lantern\.mp3$/i.test(item.name))) {
    return "Jack o'Lantern";
  }
  if (directAudio.some(item => /^grace\.mp3$/i.test(item.name)) && (mediaNames.length === 1 || mediaNames.some(name => /^EffectSprite_dolphin(?:'s-grace)?$/i.test(name)))) {
    return "Dolphin's Grace";
  }
  const candidates = [
    ...images.map(item => cleanFilename(item.name)),
    ...directAudio.map(item => cleanFilename(item.name))
  ].filter(Boolean);
  if (candidates[0]) return candidates[0];
  return 'Minecraft item';
}

function buildContent(card, sourceIndex) {
  const word = chooseWord(card);
  const source = lookup(sourceIndex.index, word);
  const category = categoryFor(card, source);
  const sourceChinese = source?.chinese && isUsableChinese(source.chinese)
    ? source.chinese
    : '';
  const chinese = sourceChinese || translateCompound(word, sourceIndex.tokenZh);
  const generated = generatedPhrase(word, chinese, category);
  const sourcePhrase = source?.phrase && source?.phraseTranslation
    ? { phrase: source.phrase, phraseTranslation: source.phraseTranslation }
    : generated;
  const generatedSentenceValue = generatedSentence(word, chinese, category);
  const sourceSentence = source?.sentence && source?.sentenceTranslation
    && word.toLowerCase().split(/\s+/).some(token => source.sentence.toLowerCase().includes(token))
    ? { sentence: source.sentence, sentenceTranslation: source.sentenceTranslation }
    : generatedSentenceValue;
  return {
    schemaVersion: 1,
    word,
    chinese,
    phonetic: source?.phonetic || '',
    phrase: sourcePhrase.phrase,
    phraseTranslation: sourcePhrase.phraseTranslation,
    sentence: sourceSentence.sentence,
    sentenceTranslation: sourceSentence.sentenceTranslation,
    category,
    source: source?.source || 'generated-minecraft-template'
  };
}

function cleanMedia(card) {
  const images = (card.media || []).filter(item => item.kind === 'image' && item.available !== false && !isDecorativeMedia(item.name));
  const audios = (card.media || []).filter(item => item.kind === 'audio' && item.available !== false);
  const selected = [];
  if (images[0]) selected.push(images[0]);
  if (audios[0]) selected.push(audios[0]);
  return selected.map(item => ({ ...item }));
}

function normalizeCard(card, sourceIndex) {
  const encryptedFieldCount = Object.values(card.fields || {}).filter(field => field.encrypted).length;
  const content = buildContent(card, sourceIndex);
  return {
    id: card.id,
    noteId: card.noteId,
    deckId: card.deckId,
    deckName: card.deckName,
    deckPath: card.deckPath,
    modelName: card.modelName,
    templateName: card.templateName,
    tags: card.tags,
    sortField: card.sortField,
    fields: {
      number: {
        raw: String(card.sortField ?? ''),
        text: String(card.sortField ?? ''),
        encrypted: false,
        media: []
      }
    },
    media: cleanMedia(card),
    content,
    source: {
      fieldNames: Object.keys(card.fields || {}),
      encryptedFieldCount,
      originalModelName: card.modelName,
      originalTemplateName: card.templateName
    }
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function pruneUnusedMedia(cards) {
  const used = new Set(cards.flatMap(card => (card.media || []).map(item => item.name)));
  const removed = [];
  for (const file of fs.readdirSync(mediaDir)) {
    if (used.has(file)) continue;
    const filePath = path.join(mediaDir, file);
    const isImage = /\.(?:png|jpe?g|gif|webp|bmp)$/i.test(file);
    if (isImage && fs.statSync(filePath).isFile()) {
      removed.push(file);
      if (apply && pruneMedia) fs.unlinkSync(filePath);
    }
  }
  return { used, removed };
}

function main() {
  const originalManifest = readJson(paths.manifest);
  const originalCards = readJson(paths.cards);
  const sourceIndex = buildSourceIndex(loadSourceRecords());
  const cards = originalCards.map(card => normalizeCard(card, sourceIndex));
  const media = pruneUnusedMedia(cards);
  const sourceEncryptedFieldCount = originalManifest.schemaVersion >= 2
    ? Math.max(Number(originalManifest.sourceEncryptedFieldCount) || 0, ORIGINAL_ENCRYPTED_FIELD_COUNT)
    : originalCards.reduce((sum, card) => sum + Object.values(card.fields || {}).filter(field => field.encrypted).length, 0);
  const sourceMediaCount = originalManifest.schemaVersion >= 2
    ? Math.max(Number(originalManifest.sourceMediaCount) || 0, ORIGINAL_MEDIA_COUNT)
    : originalManifest.mediaCount;
  const curatedMediaCount = new Set(cards.flatMap(card => (card.media || []).map(item => item.name))).size;
  const removedMediaCount = originalManifest.schemaVersion >= 2
    ? Math.max(Number(originalManifest.removedMediaCount) || 0, media.removed.length, TOTAL_PRUNED_IMAGE_COUNT)
    : media.removed.length;
  const generatedContentCount = cards.filter(card => card.content.source === 'generated-minecraft-template').length;
  const contextTranslationCount = cards.filter(card => card.content.chinese.startsWith('Minecraft中的')).length;
  const placeholderTranslationCount = cards.filter(card => card.content.chinese.startsWith('Minecraft词条')).length;
  const normalizedManifest = {
    ...originalManifest,
    schemaVersion: 2,
    normalizedAt: new Date().toISOString(),
    sourceMediaCount,
    sourceEncryptedFieldCount,
    encryptedFieldCount: 0,
    mediaCount: curatedMediaCount,
    curatedMediaCount,
    removedMediaCount,
    generatedContentCount,
    normalization: {
      schemaVersion: 1,
      removedDecorativeMedia: media.removed.filter(isDecorativeMedia),
      rule: 'hide encrypted APKG fields, keep one meaningful image and one audio, add bilingual phrase and sentence'
    }
  };
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    cards: cards.length,
    uniqueWords: new Set(cards.map(card => normalizeKey(card.content.word))).size,
    sourceContentCount: cards.length - generatedContentCount,
    generatedContentCount,
    contextTranslationCount,
    placeholderTranslationCount,
    placeholderWords: (() => {
      const words = [...new Set(cards.filter(card => card.content.chinese.startsWith('Minecraft词条')).map(card => card.content.word))];
      return fullReport ? words : words.slice(0, 80);
    })(),
    sourceEncryptedFieldCount,
    curatedMediaCount,
    removedMediaCount,
    removedMedia: media.removed.slice(0, 80),
    sample: cards.slice(0, 3).map(card => ({ id: card.id, content: card.content, media: card.media }))
  };
  if (apply) {
    writeJson(paths.cards, cards);
    writeJson(paths.manifest, normalizedManifest);
  }
  console.log(JSON.stringify(report, null, 2));
}

main();
