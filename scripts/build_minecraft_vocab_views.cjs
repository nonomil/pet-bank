const path = require('path');

const { writeMinecraftVocabViews } = require('./minecraft_vocab_views.cjs');

const repoRoot = path.resolve(__dirname, '..');
const vocabPath = path.join(
  repoRoot,
  'data',
  'learn',
  'packs',
  'english-mc-hybrid-2026',
  'modules',
  'minecraft-vocab.json'
);

function main() {
  const summary = writeMinecraftVocabViews(vocabPath);
  console.log(JSON.stringify(summary, null, 2));
}

main();
