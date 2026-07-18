const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const REFERENCE_PATH = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'word-cards.json');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const TRANSLATION_OVERRIDES = {
  'tnt': 'TNT 炸药',
  'boss bar': '首领血条',
  'cobblestone wall': '圆石墙',
  'mossy cobblestone': '苔石',
  'polished diorite stairs': '磨制闪长岩楼梯',
  'polished blackstone brick stairs': '磨制黑石砖楼梯',
  'polished andesite stairs': '磨制安山岩楼梯',
  'polished granite stairs': '磨制花岗岩楼梯',
  'polished blackstone slab': '磨制黑石台阶',
  'polished blackstone stairs': '磨制黑石楼梯',
  'mossy cobblestone stairs': '苔石楼梯',
  'polished blackstone wall': '磨制黑石墙',
  'polished blackstone brick wall': '磨制黑石砖墙',
  'polished blackstone brick slab': '磨制黑石砖台阶',
  'polished basalt': '磨制玄武岩',
  'mossy stone brick stairs': '苔石砖楼梯',
  'crimson fungus': '绯红菌',
  'crimson hyphae': '绯红菌柄',
  'crimson roots': '绯红菌根',
  'crimson nylium': '绯红菌岩',
  'chiseled nether bricks': '錾制下界砖',
  'warped nylium': '诡异菌岩',
  'stripped crimson hyphae': '去皮绯红菌柄',
  'warped roots': '诡异菌根',
  'warped fungus': '诡异菌',
  'warped stem': '诡异菌柄',
  'stripped warped stem': '去皮诡异菌柄',
  'stripped warped hyphae': '去皮诡异菌柄',
  'gilded blackstone': '镶金黑石',
  'warped hyphae': '诡异菌柄',
  'the end water': '末地水',
  'purpur stairs': '紫珀楼梯',
  'nether sprouts': '下界芽',
  'lily of the valley': '铃兰',
  'brown glazed terracotta': '棕色带釉陶瓦',
  'cyan glazed terracotta': '青色带釉陶瓦',
  'purple glazed terracotta': '紫色带釉陶瓦',
  'red glazed terracotta': '红色带釉陶瓦',
  'white glazed terracotta': '白色带釉陶瓦',
  'lime glazed terracotta': '黄绿色带釉陶瓦',
  'blue glazed terracotta': '蓝色带釉陶瓦',
  'black glazed terracotta': '黑色带釉陶瓦',
  'magenta glazed terracotta': '品红色带釉陶瓦',
  'gray glazed terracotta': '灰色带釉陶瓦',
  'pink glazed terracotta': '粉红色带釉陶瓦',
  'orange glazed terracotta': '橙色带釉陶瓦',
  'green glazed terracotta': '绿色带釉陶瓦',
  'light blue glazed terracotta': '淡蓝色带釉陶瓦',
  'yellow glazed terracotta': '黄色带釉陶瓦',
  'usb charger': 'USB 充电器',
  'iron trapdoor': '铁活板门',
  'trapped chest': '陷阱箱',
  'light weighted pressure plate': '轻质测重压力板',
  'heavy weighted pressure plate': '重质测重压力板',
  'orange dye': '橙色染料',
  'pink dye': '粉红色染料',
  'purple dye': '紫色染料',
  'white dye': '白色染料',
  'red dye': '红色染料',
  'yellow dye': '黄色染料',
  'arrow of poison': '药箭（中毒）',
  'arrow of weakness': '虚弱之箭',
  'arrow of invisibility': '隐身之箭',
  'arrow of leaping': '跳跃之箭',
  'arrow of healing': '治疗之箭',
  'arrow of water breathing': '水下呼吸之箭',
  'arrow of the turtle master': '神龟之箭',
  'arrow of decay': '衰变之箭',
  'arrow of fire resistance': '抗火之箭',
  'arrow of strength': '力量之箭',
  'arrow of luck': '幸运之箭',
  'arrow of regeneration': '再生之箭',
  'arrow of harming': '伤害之箭',
  'arrow of slowness': '迟缓之箭',
  'arrow of slow falling': '缓降之箭',
  'arrow of swiftness': '迅捷之箭',
  'netherite helmet': '下界合金头盔',
  'netherite leggings': '下界合金护腿',
  'turtle helmet': '海龟壳',
  'leather horse armor': '皮革马铠',
  'netherite boots': '下界合金靴子',
  'netherite chestplate': '下界合金胸甲',
  'music disc mellohi': 'Mellohi 音乐唱片',
  'minecart with tnt': 'TNT 矿车',
  'netherite hoe': '下界合金锄',
  'netherite shovel': '下界合金铲',
  'netherite axe': '下界合金斧',
  'netherite pickaxe': '下界合金镐',
  'warped fungus on a stick': '诡异菌钓竿',
  'tropical fish spawn egg': '热带鱼刷怪蛋',
  'elder guardian spawn egg': '远古守卫者刷怪蛋',
  'magma cube spawn egg': '岩浆怪刷怪蛋',
  'polar bear spawn egg': '北极熊刷怪蛋',
  'skeleton horse spawn egg': '骷髅马刷怪蛋',
  'zombie horse spawn egg': '僵尸马刷怪蛋',
  'wandering trader spawn egg': '流浪商人刷怪蛋',
  'zombie villager spawn egg': '僵尸村民刷怪蛋',
  'wither skeleton spawn egg': '凋灵骷髅刷怪蛋',
  'piglin brute spawn egg': '蛮猪兽刷怪蛋',
  'cave spider spawn egg': '洞穴蜘蛛刷怪蛋',
  'npc spawn egg': 'NPC 刷怪蛋',
  'glowstone dust': '荧石粉',
  'netherite ingot': '下界合金锭',
  'alex': 'Alex（角色）',
  'breath of the nautilus': '鹦鹉螺之息'
};

const WORD_TRANSLATIONS = {
  polished: '磨制', mossy: '苔', cobblestone: '圆石', wall: '墙', stairs: '楼梯', slab: '台阶',
  brick: '砖', blackstone: '黑石', andesite: '安山岩', diorite: '闪长岩', granite: '花岗岩',
  basalt: '玄武岩', crimson: '绯红', warped: '诡异', fungus: '菌', roots: '菌根',
  nylium: '菌岩', hyphae: '菌柄', stripped: '去皮', gilded: '镶金', purpur: '紫珀',
  sprouts: '芽', glazed: '带釉陶瓦', terracotta: '陶瓦', dye: '染料', weighted: '测重',
  pressure: '压力', plate: '板', trapdoor: '活板门', trapped: '陷阱', chest: '箱',
  helmet: '头盔', leggings: '护腿', boots: '靴子', chestplate: '胸甲', hoe: '锄', shovel: '铲',
  axe: '斧', pickaxe: '镐', spawn: '刷怪', egg: '蛋', tropical: '热带', fish: '鱼',
  guardian: '守卫者', magma: '岩浆', cube: '怪', polar: '北极', bear: '熊', skeleton: '骷髅',
  zombie: '僵尸', horse: '马', wandering: '流浪', trader: '商人', villager: '村民', wither: '凋灵',
  piglin: '猪灵', brute: '蛮', cave: '洞穴', spider: '蜘蛛', glowstone: '荧石', dust: '粉', ingot: '锭'
};

function translationFor(word, original) {
  const key = clean(word).toLowerCase();
  if (TRANSLATION_OVERRIDES[key]) return TRANSLATION_OVERRIDES[key];
  if (!/[A-Za-z]{3,}|箭关|组组|原模|Cobble|Polished|MossyCobble/.test(clean(original))) return clean(original);
  const tokens = key.split(/\s+/).filter(Boolean);
  const translated = tokens.map(token => WORD_TRANSLATIONS[token] || '').filter(Boolean);
  return translated.length ? translated.join('') : clean(original).replace(/[A-Za-z]+/g, '').trim() || clean(word);
}

function semanticCategory(word, category) {
  const key = clean(word).toLowerCase();
  if (key === 'hello') return 'greeting';
  if (key === 'friend') return 'people';
  if (key === 'world' || key === 'house' || key === 'cave') return 'place';
  if (/^(run|look|play|craft|build|mine|jump|eat|open|find|use)$/.test(key)) return 'verb';
  if (/cow|pig|sheep|chicken|cat|wolf|horse|villager|zombie|skeleton|creeper|spider|guardian|bee|fox|goat|parrot|rabbit|enderman|blaze|slime|phantom|wither|witch|hoglin|piglin|strider|dolphin|squid|fish|axolotl|frog|turtle/.test(key)) return 'mob';
  if (/apple|bread|cake|carrot|potato|beef|pork|chicken|mutton|cod|salmon|cookie|melon|stew|soup|milk/.test(key) && !/spawn egg/.test(key)) return 'food';
  if (/pickaxe|sword|axe|shovel|hoe|bow|crossbow|shield|trident|fishing rod|flint and steel|shears/.test(key)) return 'tool';
  if (/flower|tree|leaves|sapling|seed|wheat|grass|mushroom|fungus|roots|nylium|hyphae|sprouts|cactus|bamboo|vine|lily|orchid|daisy|tulip|poppy/.test(key)) return 'plant';
  if (/status effect|poison|strength|haste|luck|blindness|slowness|speed|regeneration|resistance|breath of the nautilus/.test(key)) return 'effect';
  if (/biome|forest|desert|ocean|plains|savanna|taiga|swamp|jungle|nether|end dimension/.test(key)) return 'biome';
  if (/village|castle|temple|mansion|monument|fortress|portal|shipwreck|stronghold|outpost|pyramid/.test(key)) return 'structure';
  if (/red|blue|green|white|black|yellow|orange|purple|pink|gray|grey|cyan|magenta|lime|brown|dye/.test(key)) return 'color';
  if (/^arrow of /.test(key) || /spawn egg|charger|disc|helmet|leggings|boots|chestplate|hoe|shovel|pickaxe|\baxe\b|ingot|dust/.test(key)) return 'item';
  if (/status effect|breath of the nautilus/.test(key)) return 'effect';
  if (/spawner with fire/.test(key)) return 'block';
  if (/lily of the valley|fungus|roots|nylium|hyphae|sprouts|flower|tree|grass|wheat|seed/.test(key)) return 'plant';
  if (/mode$|^minecraft$/.test(key)) return 'mode';
  if (/^(run|look|play|craft|build|mine|jump|eat|open|find|use)$/.test(key)) return 'verb';
  return category || 'item';
}

function backImagePrompt(word, translation, category, phrase, sentence, sentenceTranslation) {
  const subject = clean(word).toLowerCase();
  const actionText = `${sentence} ${sentenceTranslation}`.toLowerCase();
  const scene = /lava|熔岩|fire|火|nether|下界/.test(actionText) ? 'a glowing Nether lava lake with a safe basalt ledge' : /village|村庄|villager|村民/.test(actionText) ? 'a welcoming Minecraft village with a path and small houses' : /cave|洞穴|mine|挖矿/.test(actionText) ? 'a bright Minecraft cave with torches and a wooden mine bridge' : /river|lake|water|河|湖|水/.test(actionText) ? 'a Minecraft riverbank or lakeside with a small bridge' : category === 'mob' ? 'a friendly village path' : category === 'plant' ? 'a sunny garden beside a Minecraft village' : category === 'biome' ? 'a wide Minecraft exploration landscape' : category === 'effect' ? 'a glowing potion effect around a brave explorer' : category === 'block' ? 'a small Minecraft building site' : category === 'place' ? 'a recognizable Minecraft landscape or landmark' : 'a warm Minecraft adventure camp';
  return `Create a child-friendly Minecraft-inspired voxel memory scene for the English learning card “${subject}”, meaning “${translation}”. Visualize this phrase: “${clean(phrase)}”. Visualize this sentence and action: “${clean(sentence)}” (${clean(sentenceTranslation)}). Show one clear ${category} subject being used in the action, inside ${scene}; make the action easy for a child to understand, with a brave child adventurer or friendly blocky companion only when helpful. Use bright natural colors, soft pixel-art lighting, simple shapes, and a small ground shadow. This is the BACK illustration of a flashcard, so leave calm empty space around the edges for HTML text. No readable text, no letters, no numbers, no Chinese characters, no logos, no watermark, no UI, no collage, no unrelated objects, square composition.`;
}

function hasBadContent(card, translation) {
  const values = [card.phrase, card.phraseTranslation, card.sentence, card.sentenceTranslation, card.example, card.exampleZh, translation].map(clean).join(' ');
  return /箭关|组组|原模|Cobble|Polished|MossyCobble|携带|^carry\s|一个有用的|效果效果|一只友好的/.test(values)
    || /\b(?:the|a|an)\s+\w+\s+effect\s+effect\b/i.test(values);
}

function readCards(document) {
  if (Array.isArray(document)) return document;
  if (document && Array.isArray(document.cards)) return document.cards;
  return [];
}

function categoryOf(card) {
  const explicit = clean(card.category || card.viewCategory).toLowerCase();
  if (explicit) return explicit;
  const tags = Array.isArray(card.tags) ? card.tags.join(' ') : '';
  const haystack = `${tags} ${card.word || ''}`.toLowerCase();
  if (/greeting/.test(haystack)) return 'greeting';
  if (/people|person|friend/.test(haystack)) return 'people';
  if (/\b(place|location|world|house)\b/.test(haystack)) return 'place';
  if (/\bmode\b|minecraft$/.test(haystack)) return 'mode';
  if (/nature|sun|light|water|fire|tree/.test(haystack)) return 'nature';
  if (/object/.test(haystack)) return 'object';
  if (/block/.test(haystack)) return 'block';
  if (/item/.test(haystack)) return 'item';
  if (/mob|animal|monster|creeper|zombie|skeleton|spider|villager|bee|cat|wolf|pig|cow|chicken|horse/.test(haystack)) return 'mob';
  if (/biome|environment|ocean|forest|desert|cave|nether|end/.test(haystack)) return 'biome';
  if (/structure|village|castle|temple|mansion|portal/.test(haystack)) return 'structure';
  if (/tool|weapon|pickaxe|sword|axe|shovel|hoe|bow|shield/.test(haystack)) return 'tool';
  if (/food|apple|bread|cake|carrot|potato|fish|meat/.test(haystack)) return 'food';
  if (/plant|tree|flower|wheat|seed|bamboo|mushroom/.test(haystack)) return 'plant';
  if (/effect|haste|luck|blindness|poison|strength/.test(haystack)) return 'effect';
  if (/advancement|achievement|challenge/.test(haystack)) return 'advancement';
  if (/color|colour|red|blue|green|white|black|yellow|purple|pink/.test(haystack)) return 'color';
  if (/^verb$|^action$/.test(explicit) || /^(run|look|play|craft|build|mine|jump|eat|open|find|use)$/.test(clean(card.word).toLowerCase())) return 'verb';
  return 'item';
}

function generatedPhrase(word, translation, category) {
  const w = clean(word).toLowerCase();
  const zh = clean(translation);
  if (category === 'greeting') return { phrase: 'say hello', phraseTranslation: '打招呼' };
  if (category === 'people') return { phrase: `my ${w}`, phraseTranslation: `我的${zh}` };
  if (category === 'place') return { phrase: `near the ${w}`, phraseTranslation: `在${zh}附近` };
  if (category === 'mode') {
    if (w === 'minecraft') return { phrase: 'a Minecraft world', phraseTranslation: '一个我的世界' };
    return { phrase: `play in ${w}`, phraseTranslation: `在${zh}中游玩` };
  }
  if (category === 'nature') {
    if (w === 'tree') return { phrase: 'a tall tree', phraseTranslation: '一棵高大的树' };
    if (w === 'sun') return { phrase: 'the morning sun', phraseTranslation: '清晨的太阳' };
    if (w === 'light') return { phrase: 'bright light', phraseTranslation: '明亮的光' };
    if (w === 'water') return { phrase: 'clean water', phraseTranslation: '干净的水' };
    if (w === 'fire') return { phrase: 'a campfire', phraseTranslation: '一堆篝火' };
    return { phrase: `natural ${w}`, phraseTranslation: `自然的${zh}` };
  }
  if (category === 'object') return { phrase: `look at the ${w}`, phraseTranslation: `看看${zh}` };
  if (category === 'block') return { phrase: `place ${w}`, phraseTranslation: `放置${zh}` };
  if (category === 'item') {
    if (/^arrow of /.test(w)) return { phrase: `shoot ${w}`, phraseTranslation: `发射${zh}` };
    if (/spawn egg/.test(w)) return { phrase: `use ${w}`, phraseTranslation: `使用${zh}` };
    return { phrase: `use the ${w}`, phraseTranslation: `使用${zh}` };
  }
  if (category === 'verb') {
    if (w === 'look') return { phrase: 'look at the block', phraseTranslation: '看方块' };
    if (w === 'run') return { phrase: 'run to the village', phraseTranslation: '跑向村庄' };
    if (w === 'play') return { phrase: 'play in the world', phraseTranslation: '在世界里玩' };
    if (w === 'craft') return { phrase: 'craft a tool', phraseTranslation: '合成工具' };
  }
  if (category === 'mob') return { phrase: `spot a ${w}`, phraseTranslation: `发现一只${zh}` };
  if (category === 'biome') return { phrase: `explore the ${w}`, phraseTranslation: `探索${zh}` };
  if (category === 'structure') return { phrase: `find a ${w}`, phraseTranslation: `找到${zh}` };
  if (category === 'tool' || category === 'weapon') return { phrase: `use a ${w}`, phraseTranslation: `使用${zh}` };
  if (category === 'food') return { phrase: `eat ${w}`, phraseTranslation: `吃${zh}` };
  if (category === 'plant') return { phrase: `grow ${w}`, phraseTranslation: `种植${zh}` };
  if (category === 'effect') {
    if (w === 'status effect') return { phrase: 'a status effect', phraseTranslation: '一种状态效果' };
    return { phrase: `get the ${w} effect`, phraseTranslation: `获得${zh}效果` };
  }
  if (category === 'advancement') return { phrase: `complete ${w}`, phraseTranslation: `完成${zh}` };
  if (category === 'color') return { phrase: `${w} wool`, phraseTranslation: `${zh}羊毛` };
  if (category === 'verb') return { phrase: `${w} in the village`, phraseTranslation: `在村庄里${zh}` };
  return { phrase: `use ${w}`, phraseTranslation: `使用${zh}` };
}

function variantIndex(word, category, length) {
  let value = 0;
  for (const character of `${category}:${word}`) value = (value * 31 + character.charCodeAt(0)) >>> 0;
  return value % length;
}

function generatedSentence(word, translation, category) {
  const w = clean(word).toLowerCase();
  const zh = clean(translation);
  if (w === 'arrow of fire resistance') return {
    sentence: 'I shoot the arrow of fire resistance before crossing the lava lake.',
    sentenceTranslation: '我在穿过熔岩湖前发射抗火之箭。'
  };
  if (/^arrow of /.test(w)) return {
    sentence: `I shoot the ${w} during our Minecraft mission.`,
    sentenceTranslation: `我在 Minecraft 任务中发射${zh}。`
  };
  const variants = {
    block: [
      [`I place the ${w} beside the doorway.`, `我把${zh}放在门口旁边。`],
      [`The ${w} makes my base look brighter.`, `${zh}让我的基地看起来更明亮。`],
      [`We use the ${w} to mark the path home.`, `我们用${zh}标记回家的路。`],
      [`I collect the ${w} before sunset.`, `我在日落前收集${zh}。`],
      [`The builder stores the ${w} in a chest.`, `建筑师把${zh}存进箱子里。`]
    ],
    item: [
      [`I use the ${w} during our mission.`, `我在任务中使用${zh}。`],
      [`I place the ${w} in my adventure chest.`, `我把${zh}放进冒险箱。`],
      [`We prepare the ${w} before sunset.`, `我们在日落前准备好${zh}。`],
      [`I show the ${w} to my teammate at camp.`, `我在营地把${zh}展示给队友看。`],
      [`The ${w} is ready for our next adventure.`, `${zh}已经准备好陪我们开始下一次冒险。`]
    ],
    tool: [
      [`I use the ${w} to gather materials.`, `我用${zh}收集材料。`],
      [`The ${w} is ready for our next mission.`, `${zh}已经准备好参加下一次任务。`],
      [`I repair the ${w} at the crafting table.`, `我在工作台修理${zh}。`],
      [`The ${w} helps me work faster.`, `${zh}帮助我更快地工作。`]
    ],
    weapon: [
      [`I hold the ${w} when night falls.`, `夜幕降临时我拿着${zh}。`],
      [`The ${w} protects our team on the trail.`, `${zh}保护我们的小队走过小路。`],
      [`I keep the ${w} ready for a surprise attack.`, `我准备好${zh}应对突然袭击。`]
    ],
    food: [
      [`I share the ${w} with my teammate.`, `我和队友分享${zh}。`],
      [`The ${w} gives us energy for the climb.`, `${zh}给我们爬山的能量。`],
      [`We cook the ${w} at the camp.`, `我们在营地烹饪${zh}。`]
    ],
    plant: [
      [`I plant the ${w} beside the farm.`, `我把${zh}种在农场旁边。`],
      [`The ${w} grows well after the rain.`, `下雨后${zh}长得很好。`],
      [`A bee flies over the ${w}.`, `一只蜜蜂飞过${zh}。`]
    ],
    mob: [
      [`I spot a ${w} near the village.`, `我在村庄附近发现一只${zh}。`],
      [`We watch the ${w} from a safe hill.`, `我们从安全的小山上观察${zh}。`],
      [`The ${w} follows us along the path.`, `${zh}沿着小路跟着我们。`]
    ],
    biome: [
      [`We explore the ${w} after breakfast.`, `我们早餐后探索${zh}。`],
      [`The ${w} is full of new plants to discover.`, `${zh}里有许多等待发现的新植物。`],
      [`Our map shows a trail through the ${w}.`, `我们的地图显示有一条穿过${zh}的小路。`]
    ],
    structure: [
      [`We discover the ${w} beyond the river.`, `我们在河流对岸发现${zh}。`],
      [`A secret treasure may be inside the ${w}.`, `${zh}里面可能藏着秘密宝藏。`],
      [`We place a flag beside the ${w}.`, `我们在${zh}旁边插上一面旗子。`]
    ],
    effect: [
      [`The ${w} helps me cross the cave.`, `${zh}帮助我穿过洞穴。`],
      [`I notice the ${w} during the challenge.`, `我在挑战中注意到了${zh}。`],
      [`The potion gives me ${w}.`, `药水让我获得${zh}。`]
    ],
    advancement: [
      [`We celebrate after completing ${w}.`, `完成${zh}后我们一起庆祝。`],
      [`This challenge unlocks the ${w} badge.`, `这个挑战会解锁“${zh}”徽章。`],
      [`I record ${w} in my adventure book.`, `我把${zh}记录在冒险书里。`]
    ],
    color: [
      [`The banner is ${w} under the sunlight.`, `阳光下的旗帜是${zh}色的。`],
      [`We choose ${w} wool for the cozy room.`, `我们为舒适的房间选择${zh}色羊毛。`],
      [`A ${w} path leads to the garden.`, `一条${zh}色的小路通向花园。`]
    ]
  };
  const categoryVariants = variants[category];
  if (categoryVariants) {
    const [sentence, sentenceTranslation] = categoryVariants[variantIndex(w, category, categoryVariants.length)];
    return { sentence, sentenceTranslation };
  }
  if (category === 'greeting') return { sentence: 'Say hello to your friend.', sentenceTranslation: '向你的朋友打招呼。' };
  if (category === 'people') return { sentence: 'My friend is here.', sentenceTranslation: `我的${zh}在这里。` };
  if (category === 'place') return { sentence: `The ${w} is safe in the new world.`, sentenceTranslation: `新世界里的${zh}很安全。` };
  if (category === 'mode') {
    if (w === 'minecraft') return { sentence: 'I build a home in a Minecraft world.', sentenceTranslation: '我在《我的世界》里建造家园。' };
    return { sentence: `We play in ${w} together.`, sentenceTranslation: `我们一起在${zh}中游玩。` };
  }
  if (category === 'nature') return { sentence: `The ${w} is beautiful today.`, sentenceTranslation: `今天的${zh}很美。` };
  if (category === 'object') return { sentence: `I can see the ${w}.`, sentenceTranslation: `我能看见${zh}。` };
  if (category === 'block') return { sentence: `I place the ${w} near my house.`, sentenceTranslation: `我把${zh}放在房子附近。` };
  if (category === 'item') return { sentence: `I carry the ${w} in my bag.`, sentenceTranslation: `我把${zh}带在包里。` };
  if (category === 'mob') return { sentence: `A ${w} is near the village.`, sentenceTranslation: `一只${zh}在村庄附近。` };
  if (category === 'biome') return { sentence: `We explore the ${w} at sunrise.`, sentenceTranslation: `我们在日出时探索${zh}。` };
  if (category === 'structure') return { sentence: `We find the ${w} in the new world.`, sentenceTranslation: `我们在新世界里找到${zh}。` };
  if (category === 'tool' || category === 'weapon') return { sentence: `I use the ${w} to collect resources.`, sentenceTranslation: `我用${zh}收集资源。` };
  if (category === 'food') return { sentence: `I eat the ${w} after mining.`, sentenceTranslation: `挖矿后我吃${zh}。` };
  if (category === 'plant') return { sentence: `I grow ${w} near the farm.`, sentenceTranslation: `我在农场旁种植${zh}。` };
  if (category === 'effect') return { sentence: `The ${w} effect helps me explore.`, sentenceTranslation: `${zh}效果帮助我探索。` };
  if (category === 'advancement') return { sentence: `We complete the ${w} challenge.`, sentenceTranslation: `我们完成“${zh}”挑战。` };
  if (category === 'color') return { sentence: `The wool is ${w}.`, sentenceTranslation: `羊毛是${zh}色的。` };
  if (category === 'verb') return { sentence: `I ${w} in the village today.`, sentenceTranslation: `我今天在村庄里${zh}。` };
  return { sentence: `I found a ${w} in the cave.`, sentenceTranslation: `我在洞穴里找到了${zh}。` };
}

function enrichCard(card, options = {}) {
  const next = { ...card };
  const word = clean(card.word);
  const translation = translationFor(word, card.translation || card.chinese);
  const category = semanticCategory(word, categoryOf(card));
  const regenerate = Boolean(options.refreshGenerated) || hasBadContent(card, translation);
  const phrase = regenerate ? '' : clean(card.phrase);
  const phraseTranslation = regenerate ? '' : clean(card.phraseTranslation);
  const sentence = regenerate ? '' : clean(card.sentence || card.example);
  const sentenceTranslation = regenerate ? '' : clean(card.sentenceTranslation || card.exampleTranslation || card.exampleZh);
  const generated = generatedPhrase(word, translation, category);
  const generatedSentenceValue = generatedSentence(word, translation, category);

  next.phrase = phrase || generated.phrase;
  next.phraseTranslation = phraseTranslation || generated.phraseTranslation;
  next.sentence = sentence || generatedSentenceValue.sentence;
  next.sentenceTranslation = sentenceTranslation || generatedSentenceValue.sentenceTranslation;
  next.translation = translation;
  next.category = category;
  next.contentQuality = 'curated-v2';
  next.backImagePrompt = backImagePrompt(word, translation, category, next.phrase, next.sentence, next.sentenceTranslation);
  if (regenerate || !clean(next.example)) next.example = next.sentence;
  if (regenerate || !clean(next.exampleZh || next.exampleTranslation)) {
    if ('exampleTranslation' in next) next.exampleTranslation = next.sentenceTranslation;
    else next.exampleZh = next.sentenceTranslation;
  }
  return next;
}

function enrichDocument(document, options = {}) {
  if (Array.isArray(document)) return document.map(card => enrichCard(card, options));
  return { ...document, cards: readCards(document).map(card => enrichCard(card, options)) };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function summarize(before, after) {
  const cardsBefore = readCards(before);
  const cardsAfter = readCards(after);
  return {
    cards: cardsAfter.length,
    phrasesAdded: cardsAfter.filter((card, index) => !clean(cardsBefore[index]?.phrase) && clean(card.phrase)).length,
    sentencesAdded: cardsAfter.filter((card, index) => !clean(cardsBefore[index]?.sentence || cardsBefore[index]?.example) && clean(card.sentence)).length
  };
}

function main() {
  const apply = process.argv.includes('--apply');
  const refreshGenerated = process.argv.includes('--refresh-generated');
  const mainBefore = JSON.parse(fs.readFileSync(MAIN_PATH, 'utf8'));
  const referenceBefore = JSON.parse(fs.readFileSync(REFERENCE_PATH, 'utf8'));
  const options = { refreshGenerated };
  const mainAfter = enrichDocument(mainBefore, options);
  const referenceAfter = enrichDocument(referenceBefore, options);
  if (apply) {
    writeJson(MAIN_PATH, mainAfter);
    writeJson(REFERENCE_PATH, referenceAfter);
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    main: summarize(mainBefore, mainAfter),
    reference: summarize(referenceBefore, referenceAfter)
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  readCards,
  categoryOf,
  generatedPhrase,
  generatedSentence,
  enrichCard,
  enrichDocument
};
