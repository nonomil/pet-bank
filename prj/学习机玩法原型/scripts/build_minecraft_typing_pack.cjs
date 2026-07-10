const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const prototypeDir = path.resolve(__dirname, '..');
const outputPath = path.join(prototypeDir, 'assets', 'generated', 'minecraft-typing-expanded.json');
const typingViewPath = path.join(
  repoRoot,
  'data',
  'learn',
  'packs',
  'english-mc-hybrid-2026',
  'modules',
  'minecraft-vocab-typing-view.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const typingView = readJson(typingViewPath);
  const cards = Array.isArray(typingView.cards) ? typingView.cards : [];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({
    id: 'minecraft-typing-expanded',
    type: 'vocab',
    title: 'Minecraft 打字射击扩展词包',
    sourceModuleId: 'minecraft-vocab',
    sourceViewId: 'typing-view',
    generatedAt: new Date().toISOString(),
    description: '从正式 Minecraft 主仓导出的 typing-view 生成兼容词包，用于旧原型或离线调试继续复用。',
    cards
  }, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${cards.length} cards to ${outputPath}`);
}

main();
