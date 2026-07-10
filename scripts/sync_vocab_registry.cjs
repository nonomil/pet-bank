const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const UPSTREAM_MODULE_DIR = path.join(
  REPO_ROOT,
  'data',
  'learn',
  'packs',
  'english-mc-hybrid-2026',
  'modules'
);
const PACKAGE_DIR = path.join(REPO_ROOT, 'data', 'vocab', 'english-minecraft');
const VIEWS_DIR = path.join(PACKAGE_DIR, 'views');

const VIEW_FILES = [
  {
    id: 'all',
    source: 'minecraft-vocab.json',
    target: 'all.json',
    purpose: '全量 Minecraft 英语词库，供综合游戏和自由练习使用'
  },
  {
    id: 'starter',
    source: 'minecraft-vocab-starter.json',
    target: 'starter.json',
    purpose: '低门槛起步词，适合首次接触和热身'
  },
  {
    id: 'core',
    source: 'minecraft-vocab-core.json',
    target: 'core.json',
    purpose: '核心 Minecraft 主题词，用于复习和扩展'
  },
  {
    id: 'typing-view',
    source: 'minecraft-vocab-typing-view.json',
    target: 'typing-view.json',
    purpose: '短词键盘训练视图'
  },
  {
    id: 'memory-view',
    source: 'minecraft-vocab-memory-view.json',
    target: 'memory-view.json',
    purpose: '看图认义、地图找词和记忆配对视图'
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function repoRelative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function copyView(view) {
  const sourcePath = path.join(UPSTREAM_MODULE_DIR, view.source);
  const targetPath = path.join(VIEWS_DIR, view.target);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`missing upstream vocab view: ${repoRelative(sourcePath)}`);
  }

  const data = readJson(sourcePath);
  writeJson(targetPath, data);
  return {
    id: view.id,
    purpose: view.purpose,
    file: repoRelative(targetPath),
    upstreamFile: repoRelative(sourcePath),
    sourceModuleId: data.sourceModuleId || 'minecraft-vocab',
    viewId: data.viewId || view.id,
    cardCount: Array.isArray(data.cards) ? data.cards.length : 0,
    generatedAt: data.generatedAt || ''
  };
}

function sync() {
  const views = VIEW_FILES.map(copyView);
  const manifest = {
    id: 'english-minecraft',
    title: 'Minecraft 英语小游戏词库',
    type: 'game-vocab-pack',
    version: '2026-07-08',
    sourcePackId: 'english-mc-hybrid-2026',
    sourceModuleId: 'minecraft-vocab',
    description: '从正式学习中心 Minecraft 英语资料包同步出来的小游戏题库副本。小游戏默认引用这里，不直接读取 data/learn 下的正式资料包。',
    updatedAt: new Date().toISOString(),
    views
  };

  writeJson(path.join(PACKAGE_DIR, 'manifest.json'), manifest);
  console.log(`synced vocab package: ${repoRelative(PACKAGE_DIR)}`);
  views.forEach(view => {
    console.log(`- ${view.id}: ${view.cardCount} -> ${view.file}`);
  });
}

if (require.main === module) {
  try {
    sync();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

module.exports = {
  sync,
  VIEW_FILES
};
