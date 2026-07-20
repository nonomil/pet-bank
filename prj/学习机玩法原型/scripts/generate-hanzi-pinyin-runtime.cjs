const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const outputPath = path.join(__dirname, '..', 'assets', 'generated', 'hanzi-pinyin-runtime.json');
const context = { console };
context.window = context;
vm.createContext(context);

for (const relativePath of [
    'data/vocab/单词库_分级/01_幼儿园/幼儿园完整词库.js',
    'data/vocab/单词库_分级/06_汉字/幼儿园汉字.js',
    'data/vocab/单词库_分级/07_拼音/常用拼音.js',
    'data/vocab/单词库_分级/08_幼小衔接/幼小衔接总词库.js'
]) {
    const sourcePath = path.join(repoRoot, relativePath);
    vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: relativePath });
}

vm.runInContext(
    'globalThis.__runtimePacks = { hanzi: kindergartenHanzi, pinyin: PINYIN_CORE_PACK, bridge: BRIDGE_VOCAB_FULL };',
    context
);

const runtime = {
    version: 1,
    source: 'data/vocab/单词库_分级/06_汉字 + 07_拼音 + 08_幼小衔接',
    hanzi: context.__runtimePacks.hanzi,
    pinyin: context.__runtimePacks.pinyin,
    bridge: context.__runtimePacks.bridge.filter((entry) => entry && entry.subject === 'language')
};

if (!Array.isArray(runtime.hanzi) || runtime.hanzi.length < 100
    || !Array.isArray(runtime.pinyin) || runtime.pinyin.length < 50
    || !Array.isArray(runtime.bridge) || runtime.bridge.length < 50) {
    throw new Error('hanzi/pinyin runtime source packs are incomplete');
}

fs.writeFileSync(outputPath, `${JSON.stringify(runtime)}\n`);
console.log(`generated ${path.relative(repoRoot, outputPath)} (${runtime.hanzi.length} hanzi, ${runtime.pinyin.length} pinyin, ${runtime.bridge.length} bridge)`);
