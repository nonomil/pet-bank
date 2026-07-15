import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'tmp', 'pixel-story-visual-refresh', 'raw');
const outputRoot = path.join(root, 'assets', 'story', 'pixel-worlds-v1', 'icons');
const packRoot = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story');
const tracks = {
  'sci-fi': ['moon-station', 'signal-beacon', 'glowing-star-seed', 'repair-gear', 'glass-dome', 'orbit-elevator', 'twin-star-bridge', 'hologram-compass', 'blue-light-core', 'solar-garden', 'mini-drone', 'crystal-battery', 'space-tunnel', 'landing-pad', 'constellation-lens', 'floating-greenhouse', 'robot-arm', 'star-map-fragment', 'docking-ring', 'home-beacon'],
  forest: ['leafy-gate', 'stream-stone', 'acorn-lantern', 'mushroom-circle', 'bird-nest', 'berry-basket', 'wooden-bridge', 'rain-puddle', 'tree-hollow', 'firefly-jar', 'mossy-stepping-stone', 'flower-compass', 'squirrel-den', 'little-waterfall', 'leaf-boat', 'pinecone-workshop', 'forest-bell', 'rainbow-clearing', 'seed-vault', 'camp-lantern'],
  block: ['village-gate', 'wood-plank', 'stone-arch', 'glass-window', 'water-channel', 'amber-lamp', 'cyan-crystal', 'safe-mine-cart', 'bridge-symbol', 'power-cube', 'garden-plot', 'crafting-table', 'cave-lantern', 'block-elevator', 'treasure-chest', 'tunnel-portal', 'snow-block', 'lava-lamp', 'builder-badge', 'home-beacon'],
  detective: ['magnifying-glass', 'clue-envelope', 'blue-footprint', 'star-fragment', 'evidence-tray', 'safe-lock', 'red-thread-knot', 'tiny-camera', 'constellation-card', 'glowing-fingerprint', 'clue-lantern', 'keyhole', 'map-pin', 'three-color-badge', 'robot-witness', 'leaf-clue', 'block-clue', 'signal-pulse', 'evidence-box', 'mystery-beacon'],
};

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function areaFromPartName(file) {
  const match = file.match(/_(\d+)x(\d+)\.png$/);
  return match ? Number(match[1]) * Number(match[2]) : 0;
}

function selectParts(track, files) {
  if (track === 'detective') return files.filter((file) => areaFromPartName(file) > 10000);
  return files.slice(0, 20);
}

const manifestPath = path.join(packRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allTracks = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])];

for (const [track, names] of Object.entries(tracks)) {
  const sourceDir = path.join(sourceRoot, track, 'split');
  const sourceFiles = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.png')).sort();
  const selected = selectParts(track, sourceFiles);
  if (selected.length !== names.length) throw new Error(`${track}: expected ${names.length} selected parts, got ${selected.length}`);

  const outputDir = path.join(outputRoot, track);
  fs.mkdirSync(outputDir, { recursive: true });
  selected.forEach((sourceFile, index) => {
    fs.copyFileSync(path.join(sourceDir, sourceFile), path.join(outputDir, `${names[index]}.webp`));
  });

  const route = allTracks.find((item) => item.id === track);
  if (!route) throw new Error(`manifest track missing: ${track}`);
  route.nodes.forEach((node, index) => {
    node.icon = `assets/story/pixel-worlds-v1/icons/${track}/${names[index]}.webp`;
    const levelPath = path.join(packRoot, 'levels', `${node.levelId}.json`);
    const level = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
    level.icon = node.icon;
    writeJson(levelPath, level);
  });
  console.log(`PROMOTED ${track} icons=${selected.length}`);
}

writeJson(manifestPath, manifest);
console.log(`PROMOTED pixel story icons total=${Object.values(tracks).flat().length}`);
