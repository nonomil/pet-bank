const fs = require('fs');
const path = require('path');

function readJson(relPath) {
  const fullPath = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function readText(relPath) {
  const fullPath = path.join(process.cwd(), relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

function collectSceneItemIds(scenesJson) {
  const ids = new Set();
  for (const scene of scenesJson.scenes || []) {
    for (const monster of scene.monsters || []) {
      for (const drop of monster.drops || []) {
        if (drop.item_id) ids.add(drop.item_id);
      }
    }
    for (const rare of scene.rare_drops || []) {
      if (rare.item_id) ids.add(rare.item_id);
    }
  }
  return [...ids].sort();
}

function collectWalkItemIds(walkJs) {
  const ids = new Set();
  const regex = /InventorySystem\.addItem\('([^']+)'/g;
  let match;
  while ((match = regex.exec(walkJs))) {
    ids.add(match[1]);
  }
  return [...ids].sort();
}

function collectExplorationDetailItemIds(explorationDetailJs) {
  const ids = new Set();
  const regex = /item:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(explorationDetailJs))) {
    ids.add(match[1]);
  }
  return [...ids].sort();
}

function collectBanchongSignatureMediaGaps(petsJson) {
  const groups = new Map();

  for (const pet of petsJson.flat || []) {
    if (pet.source !== 'banchong' || !Array.isArray(pet.stages) || pet.stages.length === 0) continue;
    const signature = pet.stages.map((stage) => stage.imageUrl || '').join('|');
    if (!signature) continue;
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(pet);
  }

  const gaps = [];
  for (const pets of groups.values()) {
    const mapped = pets.find((pet) => pet.imageUrl && pet.imageStages && pet.imageStyle === 'banchong');
    if (!mapped) continue;
    for (const pet of pets) {
      if (pet.imageUrl && pet.imageStages && pet.imageStyle === 'banchong') continue;
      gaps.push(`${pet.name} -> ${mapped.name}`);
    }
  }

  return gaps.sort();
}

function main() {
  const petsJson = readJson('data/pets.json');
  const itemsJson = readJson('data/items.json');
  const scenesJson = readJson('data/scenes.json');
  const indexHtml = readText('index.html');
  const appJs = readText('js/app.js');
  const runtimeLoaderJs = readText('js/runtime-loader.js');
  const walkJs = readText('js/walk.js');
  const mathPkJs = readText('js/math-pk.js');
  const hanziJs = readText('js/hanzi-game.js');
  const cardJs = readText('js/card-collection.js');
  const cardArenaUiJs = readText('js/card-arena-ui.js');
  const toolsJs = readText('js/tools.js');
  const shopJs = readText('js/shop.js');
  const treasureJs = readText('js/treasure.js');
  const explorationJs = readText('js/exploration.js');
  const explorationDetailJs = readText('js/exploration-detail.js');

  const usesSharedPointsApi = (source, method) =>
    /PetBankPoints/.test(source) && new RegExp('(?:pointsApi|PetBankPoints)\\.' + method + '\\s*\\(').test(source);

  const itemIds = new Set((itemsJson.items || []).map((item) => item.id));
  const missingSceneItems = collectSceneItemIds(scenesJson).filter((id) => !itemIds.has(id));
  const missingWalkItems = collectWalkItemIds(walkJs).filter((id) => !itemIds.has(id));
  const missingExplorationDetailItems = collectExplorationDetailItemIds(explorationDetailJs).filter((id) => !itemIds.has(id));
  const banchongSignatureMediaGaps = collectBanchongSignatureMediaGaps(petsJson);

  const checks = [
    {
      name: 'CardCollection.init wired in the lazy card bundle',
      ok: /ensureCardFeature[\s\S]*CardCollection\.init\(\)/.test(runtimeLoaderJs)
    },
    {
      name: 'ToolboxSystem.init wired in the lazy playground bundle',
      ok: /ensurePlaygroundFeature[\s\S]*ToolboxSystem\.init\(\)/.test(runtimeLoaderJs)
    },
    {
      name: 'Math PK uses the shared points API instead of direct balance mutation',
      ok: usesSharedPointsApi(mathPkJs, 'add') && !/window\.totalPoints\s*[+\-]=/.test(mathPkJs) && !/petbank_points/.test(mathPkJs)
    },
    {
      name: 'Hanzi game uses the shared points API instead of direct balance mutation',
      ok: usesSharedPointsApi(hanziJs, 'add') && !/window\.totalPoints\s*[+\-]=/.test(hanziJs) && !/petbank_points/.test(hanziJs)
    },
    {
      name: 'Game receipt bridge has no direct points ledger fallback',
      ok: usesSharedPointsApi(runtimeLoaderJs, 'add')
        && !/window\.totalPoints\s*=/.test(runtimeLoaderJs)
        && !/petbank_points/.test(runtimeLoaderJs)
    },
    {
      name: 'Math PK result return button targets math-pk container',
      ok: /MathPKGame\.renderUI\('math-pk-container'\)/.test(mathPkJs) && !/MathPKGame\.renderUI\('page-mathpk'\)/.test(mathPkJs)
    },
    {
      name: 'Pet page sprite is populated by the runtime pet image resolver',
      ok: /id="petDisplayImg"/.test(indexHtml)
        && /function getPetImagePath[\s\S]*imageStages/.test(appJs)
        && /displayImg\.src\s*=/.test(appJs)
    },
    {
      name: 'Card collection does not own a second points ledger',
      ok: !/totalPoints\s*[+\-]=/.test(cardJs) && !/petbank_points/.test(cardJs)
    },
    {
      name: 'Card arena does not own a second points ledger',
      ok: !/InventorySystem\.addPoints/.test(cardArenaUiJs)
        && !/ProfileSystem\.addPoints/.test(cardArenaUiJs)
        && !/petbank_arena_points/.test(cardArenaUiJs)
    },
    {
      name: 'Toolbox rewards use the shared points API instead of direct balance mutation',
      ok: usesSharedPointsApi(toolsJs, 'add') && !/totalPoints\s*[+\-]=/.test(toolsJs) && !/petbank_points/.test(toolsJs)
    },
    {
      name: 'Shop points flow uses the shared points API instead of direct balance mutation',
      ok: usesSharedPointsApi(shopJs, 'get') && usesSharedPointsApi(shopJs, 'add') && !/totalPoints\s*[+\-]=/.test(shopJs) && !/petbank_points/.test(shopJs)
    },
    {
      name: 'Treasure rewards use the shared points API instead of direct balance mutation',
      ok: usesSharedPointsApi(treasureJs, 'add') && !/totalPoints\s*[+\-]=/.test(treasureJs) && !/petbank_points/.test(treasureJs)
    },
    {
      name: 'Scene unlock flow uses the shared points API',
      ok: usesSharedPointsApi(explorationJs, 'spend') && !/petbank_points/.test(explorationJs)
    },
    {
      name: 'Pet stage galleries support imageStages and legacy stages',
      ok: /function getPetStageEntriesForSpecies[\s\S]*sp\.imageStages[\s\S]*Array\.isArray\(sp\.stages\)/.test(appJs)
    },
    {
      name: 'Banchong duplicate-stage pets have normalized display images',
      ok: banchongSignatureMediaGaps.length === 0,
      details: banchongSignatureMediaGaps
    },
    {
      name: 'Scene item ids all exist in data/items.json',
      ok: missingSceneItems.length === 0,
      details: missingSceneItems
    },
    {
      name: 'Walk event item ids all exist in data/items.json',
      ok: missingWalkItems.length === 0,
      details: missingWalkItems
    },
    {
      name: 'Exploration detail item ids all exist in data/items.json',
      ok: missingExplorationDetailItems.length === 0,
      details: missingExplorationDetailItems
    }
  ];

  let failed = 0;
  for (const check of checks) {
    if (check.ok) {
      console.log(`PASS ${check.name}`);
      continue;
    }
    failed += 1;
    console.log(`FAIL ${check.name}`);
    if (check.details && check.details.length) {
      console.log(`  -> ${check.details.join(', ')}`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
