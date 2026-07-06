import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'https://mayihaoke.com';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(repoRoot, 'data/learn/external/mayihaoke');
const outputPath = path.join(outputDir, 'resources.json');

const routePatterns = [
  '/mcbook56/read/:chapter?',
  '/mcbookstarters/read/:chapter?',
  '/mcbook78/read/:chapter?',
  '/minewords',
  '/cambridge-vocab',
  '/englishcreep',
  '/englishcreep/play',
  '/word-map'
];

const starterWords = [
  ['block', '方块', '/mcbook56/read/:chapter?'],
  ['world', '世界', '/mcbook56/read/:chapter?'],
  ['hello', '你好', '/mcbook56/read/:chapter?'],
  ['look', '看', '/mcbook56/read/:chapter?'],
  ['stone', '石头', '/mcbook56/read/:chapter?'],
  ['light', '光', '/mcbook56/read/:chapter?'],
  ['run', '跑', '/mcbook56/read/:chapter?'],
  ['door', '门', '/mcbook56/read/:chapter?'],
  ['friend', '朋友', '/mcbook56/read/:chapter?'],
  ['cat', '猫', '/mcbookstarters/read/:chapter?'],
  ['bag', '书包', '/mcbookstarters/read/:chapter?'],
  ['sun', '太阳', '/mcbookstarters/read/:chapter?'],
  ['tree', '树', '/mcbookstarters/read/:chapter?'],
  ['red', '红色', '/mcbookstarters/read/:chapter?'],
  ['play', '玩', '/mcbookstarters/read/:chapter?'],
  ['sword', '剑', '/minewords'],
  ['pickaxe', '镐', '/minewords'],
  ['diamond', '钻石', '/minewords'],
  ['creeper', '苦力怕', '/minewords'],
  ['craft', '合成', '/minewords'],
  ['water', '水', '/mcbook56/read/:chapter?'],
  ['fire', '火', '/mcbook56/read/:chapter?'],
  ['house', '房子', '/minewords'],
  ['apple', '苹果', '/minewords']
];

function normalizeAssetPath(assetPath) {
  if (!assetPath) return '';
  if (assetPath.startsWith('http')) return assetPath;
  return assetPath.startsWith('/') ? assetPath : `/assets/${assetPath.replace(/^\.\//, '')}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 pet-bank local learning resource snapshot'
    }
  });
  if (!response.ok) {
    throw new Error(`fetch failed ${response.status} ${url}`);
  }
  return response.text();
}

function extractEntryScript(html) {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].map(match => match[1]);
  const entry = scripts.find(src => src.includes('/assets/index-')) || scripts[0];
  if (!entry) throw new Error('entry script not found');
  return entry;
}

function extractRoutes(source) {
  const routes = [];
  const routeRegex = /path:"([^"]+)"(?:,name:"([^"]+)")?[^{}]*?meta:\{title:"([^"]*)"/g;
  for (const match of source.matchAll(routeRegex)) {
    if (!match[1]) continue;
    routes.push({
      path: match[1],
      name: match[2] || '',
      title: match[3] || ''
    });
  }
  for (const routePath of routePatterns) {
    if (source.includes(routePath) && !routes.some(route => route.path === routePath)) {
      routes.push({ path: routePath, name: '', title: '' });
    }
  }
  return [...new Map(routes.map(route => [route.path, route])).values()]
    .sort((a, b) => a.path.localeCompare(b.path));
}

function extractChunkPaths(source) {
  const chunks = new Set();
  for (const match of source.matchAll(/import\("\.\/([^"]+\.js)"\)/g)) {
    chunks.add(`/assets/${match[1]}`);
  }
  for (const match of source.matchAll(/"([^"]+\.js)"/g)) {
    if (/^(?:Chapter|index|Mine|MC|Story|Word|Cambridge)/.test(match[1])) {
      chunks.add(`/assets/${match[1]}`);
    }
  }
  return [...chunks].sort();
}

function extractAssets(source, sourceChunk) {
  const assets = [];
  const assetRegex = /["']([^"']+\.(?:png|webp|jpg|jpeg|svg|mp3|wav|ogg|json))["']/gi;
  for (const match of source.matchAll(assetRegex)) {
    const rawPath = match[1];
    if (/^(?:http|\/assets|assets|\.\/)/.test(rawPath)) {
      assets.push({
        path: normalizeAssetPath(rawPath),
        sourceChunk
      });
    }
  }
  return assets;
}

function extractChineseTitleWords(source) {
  const words = [];
  const titleRegex = /title:"([^"]*Minecraft[^"]*|[^"]*英语[^"]*|[^"]*单词[^"]*)"/g;
  for (const match of source.matchAll(titleRegex)) {
    words.push(match[1]);
  }
  return [...new Set(words)];
}

async function main() {
  const html = await fetchText(`${BASE_URL}/`);
  const entryScript = extractEntryScript(html);
  const entrySource = await fetchText(`${BASE_URL}${entryScript}`);

  const chunkPaths = extractChunkPaths(entrySource);
  const chunkRecords = [{ path: entryScript, bytes: entrySource.length, importedBy: 'html' }];
  const sources = new Map([[entryScript, entrySource]]);

  for (const chunkPath of chunkPaths) {
    try {
      const source = await fetchText(`${BASE_URL}${chunkPath}`);
      sources.set(chunkPath, source);
      chunkRecords.push({ path: chunkPath, bytes: source.length, importedBy: entryScript });
    } catch (error) {
      chunkRecords.push({ path: chunkPath, error: String(error.message || error), importedBy: entryScript });
    }
  }

  const allSource = [...sources.values()].join('\n');
  const routeRecords = extractRoutes(allSource);
  const assets = [];
  const notes = [];
  for (const [sourceChunk, source] of sources) {
    assets.push(...extractAssets(source, sourceChunk));
    notes.push(...extractChineseTitleWords(source).map(title => ({ title, sourceChunk })));
  }

  const uniqueAssets = [...new Map(assets.map(asset => [`${asset.path}|${asset.sourceChunk}`, asset])).values()]
    .sort((a, b) => a.path.localeCompare(b.path));

  const candidateWords = starterWords.map(([word, translation, sourceRoute], index) => ({
    id: `mayihaoke-candidate-${String(index + 1).padStart(2, '0')}`,
    word,
    translation,
    sourceRoute,
    sourceChunk: sourceRoute === '/minewords' ? entryScript : (chunkRecords.find(chunk => /Chapter1[-\w]*\.js$/.test(chunk.path))?.path || entryScript),
    confidence: 'seed-from-crawled-route',
    notes: 'Temporary local seed based on crawled route scope; replace with curated/generated assets before runtime use.'
  }));

  const snapshot = {
    provider: 'mayihaoke',
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    entryScript,
    routes: routeRecords,
    chunks: chunkRecords.sort((a, b) => a.path.localeCompare(b.path)),
    assets: uniqueAssets,
    routeTitleNotes: [...new Map(notes.map(note => [`${note.title}|${note.sourceChunk}`, note])).values()],
    candidateWords
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
  console.log(`Routes: ${snapshot.routes.length}`);
  console.log(`Chunks: ${snapshot.chunks.length}`);
  console.log(`Assets: ${snapshot.assets.length}`);
  console.log(`Candidate words: ${snapshot.candidateWords.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
