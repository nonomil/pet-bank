const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const mainPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');

// Short, concrete language keeps the card useful for a first pass and leaves the
// scene sentence easy to repeat aloud.
const CONTENT = {
  block: ['place a block', '放置方块', 'I place a block by my house.', '我在房子旁边放一块方块。'],
  world: ['a new world', '一个新世界', 'We explore a new world together.', '我们一起探索新世界。'],
  hello: ['say hello', '打招呼', 'I say hello to my friend.', '我向朋友问好。'],
  look: ['look at the block', '看看方块', 'Look at the bright block.', '看看那块明亮的方块。'],
  stone: ['a stone block', '石头方块', 'I build with a stone block.', '我用石头方块建造。'],
  light: ['bright light', '明亮的光', 'The light helps me see.', '光线帮助我看清楚。'],
  run: ['run to the village', '跑向村庄', 'We run to the village.', '我们跑向村庄。'],
  door: ['open the door', '打开门', 'I open the wooden door.', '我打开木门。'],
  friend: ['my best friend', '我最好的朋友', 'My friend builds with me.', '我的朋友和我一起建造。'],
  cat: ['a friendly cat', '一只友好的猫', 'The cat sleeps by the house.', '猫在房子旁边睡觉。'],
  bag: ['a full bag', '装满东西的包', 'My bag is full of blocks.', '我的包里装满了方块。'],
  sun: ['morning sun', '早晨的阳光', 'The morning sun warms the village.', '早晨的阳光温暖村庄。'],
  tree: ['a tall tree', '一棵高树', 'A tall tree grows by the river.', '河边长着一棵高树。'],
  red: ['red wool', '红色羊毛', 'I use red wool for the flag.', '我用红色羊毛做旗帜。'],
  play: ['play together', '一起玩', 'We play together after school.', '放学后我们一起玩。'],
  sword: ['a diamond sword', '一把钻石剑', 'I hold a sword in the cave.', '我在洞穴里拿着剑。'],
  pickaxe: ['use a pickaxe', '使用镐', 'I use a pickaxe to mine stone.', '我用镐挖石头。'],
  diamond: ['find a diamond', '找到一颗钻石', 'I find a diamond deep underground.', '我在地下深处找到一颗钻石。'],
  creeper: ['a quiet creeper', '一只安静的苦力怕', 'A creeper waits near the hill.', '一只苦力怕在山丘附近等着。'],
  craft: ['craft a tool', '合成工具', 'I craft a tool at the table.', '我在工作台旁合成工具。'],
  water: ['clear water', '清澈的水', 'The river has clear water.', '河里有清澈的水。'],
  fire: ['a warm campfire', '温暖的篝火', 'We sit by the warm campfire.', '我们坐在温暖的篝火旁。'],
  house: ['build a house', '建造房子', 'We build a small house.', '我们建造一座小房子。'],
  apple: ['eat an apple', '吃一个苹果', 'I eat an apple after exploring.', '探索后我吃一个苹果。'],
  cow: ['a milk cow', '产奶的牛', 'The cow walks near the farm.', '牛在农场附近散步。'],
  egg: ['a chicken egg', '一个鸡蛋', 'I put the egg in my basket.', '我把鸡蛋放进篮子里。'],
  oak: ['an oak tree', '一棵橡树', 'An oak tree grows beside the path.', '路边长着一棵橡树。'],
  pig: ['a pink pig', '一只粉色的猪', 'The pig plays in the mud.', '猪在泥巴里玩。'],
  blue: ['blue wool', '蓝色羊毛', 'I use blue wool for the roof.', '我用蓝色羊毛做屋顶。'],
  boat: ['a wooden boat', '一条木船', 'We row a boat across the lake.', '我们划船穿过湖面。'],
  book: ['read a book', '读一本书', 'I read a book by the lamp.', '我在灯旁读一本书。'],
  bowl: ['a wooden bowl', '一个木碗', 'I carry soup in a bowl.', '我把汤装在碗里。'],
  dirt: ['a dirt path', '一条泥土小路', 'The dirt path leads to the farm.', '泥土小路通向农场。'],
  milk: ['a glass of milk', '一杯牛奶', 'I drink a glass of milk.', '我喝一杯牛奶。'],
  sand: ['a sand castle', '一座沙堡', 'We build a sand castle.', '我们建造一座沙堡。'],
  wood: ['oak wood planks', '橡木木板', 'I use wood planks to build a bridge.', '我用木板建造一座桥。'],
  wool: ['soft wool', '柔软的羊毛', 'The sheep gives us soft wool.', '绵羊给我们柔软的羊毛。'],
  birch: ['a birch tree', '一棵白桦树', 'A birch tree grows near the lake.', '湖边长着一棵白桦树。'],
  black: ['black wool', '黑色羊毛', 'I use black wool for the banner.', '我用黑色羊毛做旗帜。'],
  bread: ['fresh bread', '新鲜的面包', 'I eat fresh bread before the journey.', '出发前我吃新鲜的面包。'],
  clock: ['check the clock', '查看时钟', 'I check the clock before sunset.', '日落前我查看时钟。'],
  daisy: ['a white daisy', '一朵白色雏菊', 'A daisy grows beside the path.', '小路旁长着一朵雏菊。'],
  flint: ['a piece of flint', '一块燧石', 'I find flint near the gravel.', '我在沙砾附近找到燧石。'],
  grass: ['green grass', '绿色的草', 'The sheep eats the grass.', '绵羊吃草。'],
  green: ['green wool', '绿色羊毛', 'I choose green wool for the flag.', '我为旗帜选择绿色羊毛。'],
  paper: ['a sheet of paper', '一张纸', 'I write a map on paper.', '我在纸上画地图。'],
  poppy: ['a red poppy', '一朵红色虞美人', 'A red poppy grows by the house.', '房子旁边长着一朵红色虞美人。'],
  seeds: ['plant the seeds', '种下种子', 'I plant the seeds on the farm.', '我在农场种下种子。'],
  sheep: ['a white sheep', '一只白色绵羊', 'The sheep walks near the barn.', '绵羊在谷仓附近散步。'],
  stick: ['a wooden stick', '一根木棍', 'I use a stick to craft a torch.', '我用木棍合成火把。'],
  sugar: ['some sugar', '一些糖', 'I add sugar to the cake.', '我在蛋糕里加糖。'],
  tulip: ['a red tulip', '一朵红色郁金香', 'A red tulip grows in the garden.', '花园里长着一朵红色郁金香。'],
  wheat: ['ripe wheat', '成熟的小麦', 'The farmer harvests ripe wheat.', '农夫收割成熟的小麦。'],
  white: ['white wool', '白色羊毛', 'I use white wool for the cloud.', '我用白色羊毛做云朵。'],
  acacia: ['acacia wood', '金合欢木', 'I build with acacia wood.', '我用金合欢木建造。'],
  cactus: ['a desert cactus', '一株沙漠仙人掌', 'The cactus grows in the sand.', '仙人掌生长在沙子里。'],
  flower: ['a bright flower', '一朵鲜艳的花', 'A bright flower grows by the path.', '小路旁长着一朵鲜艳的花。'],
  gravel: ['a gravel path', '一条沙砾小路', 'We walk along the gravel path.', '我们沿着沙砾小路走。'],
  jungle: ['a jungle biome', '丛林生物群系', 'We explore the jungle biome.', '我们探索丛林生物群系。'],
  leaves: ['green leaves', '绿色的树叶', 'The tree has green leaves.', '树上有绿色的树叶。'],
  orchid: ['a blue orchid', '一朵蓝色兰花', 'A blue orchid grows near the water.', '水边长着一朵蓝色兰花。'],
  planks: ['wooden planks', '木板', 'I place wooden planks on the floor.', '我把木板铺在地板上。'],
  sponge: ['a wet sponge', '一块湿海绵', 'The sponge soaks up water.', '海绵吸收水分。'],
  spruce: ['a spruce tree', '一棵云杉树', 'A spruce tree grows in the snow.', '雪地里长着一棵云杉树。'],
  string: ['a piece of string', '一根线', 'I use string to make a bow.', '我用线制作弓。'],
  yellow: ['yellow wool', '黄色羊毛', 'I use yellow wool for the roof.', '我用黄色羊毛做屋顶。'],
  bedrock: ['solid bedrock', '坚硬的基岩', 'Bedrock is deep below the world.', '基岩在世界的深处。'],
  chicken: ['a white chicken', '一只白色的鸡', 'The chicken lays an egg.', '鸡下了一个蛋。'],
  compass: ['a small compass', '一个小指南针', 'The compass points home.', '指南针指向家的方向。'],
  diorite: ['a diorite block', '闪长岩方块', 'I find diorite in the cave.', '我在洞穴里找到闪长岩。'],
  feather: ['a soft feather', '一根柔软的羽毛', 'The chicken drops a feather.', '鸡掉下一根羽毛。'],
  granite: ['a granite block', '花岗岩方块', 'I see granite beside the stone.', '我在石头旁看见花岗岩。'],
  leather: ['a piece of leather', '一块皮革', 'I use leather to make a book.', '我用皮革制作书。'],
  sapling: ['plant a sapling', '种下一棵树苗', 'I plant a sapling by the house.', '我在房子旁种下一棵树苗。'],
  andesite: ['an andesite block', '安山岩方块', 'Andesite is gray and strong.', '安山岩灰色而坚硬。'],
  charcoal: ['a piece of charcoal', '一块木炭', 'I use charcoal to light the furnace.', '我用木炭点燃熔炉。'],
  mushroom: ['a brown mushroom', '一朵棕色蘑菇', 'A mushroom grows in the shade.', '阴凉处长着一朵蘑菇。'],
  snowball: ['throw a snowball', '扔雪球', 'I throw a snowball at the target.', '我把雪球扔向目标。'],
  air: ['fresh air', '新鲜空气', 'I feel fresh air outside.', '我在户外感受到新鲜空气。'],
  ice: ['a sheet of ice', '一片冰', 'The lake has a sheet of ice.', '湖面结了一层冰。'],
  mud: ['wet mud', '湿泥巴', 'My boots step in wet mud.', '我的靴子踩进了湿泥巴。'],
  tnt: ['a TNT block', '一个 TNT 方块', 'We keep the TNT away from the house.', '我们把 TNT 放在远离房子的地方。'],
  bell: ['ring the village bell', '敲响村庄钟', 'The village bell rings at noon.', '村庄的钟在中午响起。'],
  cake: ['a slice of cake', '一块蛋糕', 'I share a slice of cake.', '我分享一块蛋糕。'],
  clay: ['a clay block', '一个黏土块', 'I find clay under the water.', '我在水下找到黏土。'],
  lava: ['a pool of lava', '一池熔岩', 'The pool of lava is hot.', '熔岩池很烫。'],
  loom: ['use the loom', '使用织布机', 'I use the loom to make a banner.', '我用织布机制作旗帜。'],
  rail: ['a minecart rail', '一段矿车铁轨', 'The minecart rolls along the rail.', '矿车沿着铁轨滚动。'],
  tuff: ['a tuff block', '一个凝灰岩方块', 'I find tuff below the hill.', '我在山丘下面找到凝灰岩。'],
  anvil: ['a heavy anvil', '一座沉重的铁砧', 'I repair my tool on the anvil.', '我在铁砧上修理工具。'],
  chain: ['a metal chain', '一条金属锁链', 'The chain hangs from the roof.', '锁链从屋顶垂下来。'],
  axe: ['a wooden axe', '一把木斧', 'I use an axe to chop wood.', '我用斧头砍木头。'],
  ore: ['a vein of ore', '一条矿石矿脉', 'I find a vein of ore in the cave.', '我在洞穴里找到一条矿石矿脉。'],
  cave: ['a dark cave', '一座黑暗的洞穴', 'We carry torches into the cave.', '我们带着火把走进洞穴。'],
  disk: ['a round disk', '一个圆盘', 'The round disk turns in my hand.', '圆盘在我的手中转动。'],
  hill: ['a grassy hill', '一座长满青草的山丘', 'We climb the grassy hill.', '我们爬上长满青草的山丘。']
};

const apply = process.argv.includes('--apply');
const document = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const missing = [];
const cards = (document.cards || []).map(card => {
  const values = CONTENT[String(card.word || '').toLowerCase()];
  if (!values) {
    missing.push(card.word);
    return card;
  }
  const [phrase, phraseTranslation, sentence, sentenceTranslation] = values;
  return {
    ...card,
    phrase,
    phraseTranslation,
    sentence,
    sentenceTranslation,
    example: sentence,
    exampleZh: sentenceTranslation,
    contentQuality: 'curated-v1'
  };
});

if (missing.length) throw new Error(`Missing content overrides: ${missing.join(', ')}`);
const next = { ...document, contentCuration: 'curated-v1', cards };
if (apply) fs.writeFileSync(mainPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', cards: cards.length, contentCuration: next.contentCuration }, null, 2));
