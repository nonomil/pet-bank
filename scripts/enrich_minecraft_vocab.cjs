const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const REFERENCE_PATH = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'word-cards.json');

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  if (category === 'item') return { phrase: `carry ${w}`, phraseTranslation: `携带${zh}` };
  if (category === 'verb') {
    if (w === 'look') return { phrase: 'look at the block', phraseTranslation: '看方块' };
    if (w === 'run') return { phrase: 'run to the village', phraseTranslation: '跑向村庄' };
    if (w === 'play') return { phrase: 'play in the world', phraseTranslation: '在世界里玩' };
    if (w === 'craft') return { phrase: 'craft a tool', phraseTranslation: '合成工具' };
  }
  if (category === 'mob') return { phrase: `a friendly ${w}`, phraseTranslation: `一只友好的${zh}` };
  if (category === 'biome') return { phrase: `explore the ${w}`, phraseTranslation: `探索${zh}` };
  if (category === 'structure') return { phrase: `find a ${w}`, phraseTranslation: `找到${zh}` };
  if (category === 'tool' || category === 'weapon') return { phrase: `use a ${w}`, phraseTranslation: `使用${zh}` };
  if (category === 'food') return { phrase: `eat ${w}`, phraseTranslation: `吃${zh}` };
  if (category === 'plant') return { phrase: `grow ${w}`, phraseTranslation: `种植${zh}` };
  if (category === 'effect') return { phrase: `get the ${w} effect`, phraseTranslation: `获得${zh}效果` };
  if (category === 'advancement') return { phrase: `complete ${w}`, phraseTranslation: `完成${zh}` };
  if (category === 'color') return { phrase: `${w} wool`, phraseTranslation: `${zh}羊毛` };
  if (category === 'verb') return { phrase: `${w} in the village`, phraseTranslation: `在村庄里${zh}` };
  return { phrase: `use ${w}`, phraseTranslation: `使用${zh}` };
}

function generatedSentence(word, translation, category) {
  const w = clean(word).toLowerCase();
  const zh = clean(translation);
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
  const translation = clean(card.translation || card.chinese);
  const category = categoryOf(card);
  const regenerate = options.refreshGenerated && (card.sourceProvider === 'mayihaoke' || !card.sourceProvider);
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
  if (!clean(next.example)) next.example = next.sentence;
  if (!clean(next.exampleZh || next.exampleTranslation)) {
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
