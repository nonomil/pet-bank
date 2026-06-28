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

function main() {
  const itemsJson = readJson('data/items.json');
  const scenesJson = readJson('data/scenes.json');
  const appJs = readText('js/app.js');
  const walkJs = readText('js/walk.js');
  const mathPkJs = readText('js/math-pk.js');
  const cardJs = readText('js/card-collection.js');
  const toolsJs = readText('js/tools.js');
  const shopJs = readText('js/shop.js');
  const treasureJs = readText('js/treasure.js');
  const explorationJs = readText('js/exploration.js');

  const itemIds = new Set((itemsJson.items || []).map((item) => item.id));
  const missingSceneItems = collectSceneItemIds(scenesJson).filter((id) => !itemIds.has(id));
  const missingWalkItems = collectWalkItemIds(walkJs).filter((id) => !itemIds.has(id));

  const checks = [
    {
      name: 'CardCollection.init wired in app init',
      ok: /CardCollection\.init\(\)/.test(appJs)
    },
    {
      name: 'ToolboxSystem.init wired in app init',
      ok: /ToolboxSystem\.init\(\)/.test(appJs)
    },
    {
      name: 'Math PK uses addGrowthPoints instead of direct totalPoints mutation',
      ok: /addGrowthPoints\(/.test(mathPkJs) && !/window\.totalPoints\s*\+=/.test(mathPkJs)
    },
    {
      name: 'Card collection rewards use addGrowthPoints instead of direct totalPoints mutation',
      ok: /addGrowthPoints\(/.test(cardJs) && !/totalPoints\s*\+=/.test(cardJs)
    },
    {
      name: 'Toolbox rewards use addGrowthPoints instead of direct totalPoints mutation',
      ok: /addGrowthPoints\(/.test(toolsJs) && !/totalPoints\s*\+=/.test(toolsJs)
    },
    {
      name: 'Shop points flow avoids direct totalPoints mutation',
      ok: /addGrowthPoints\(/.test(shopJs) && !/totalPoints\s*[+\-]=/.test(shopJs)
    },
    {
      name: 'Treasure rewards use addGrowthPoints instead of direct totalPoints mutation',
      ok: /addGrowthPoints\(/.test(treasureJs) && !/totalPoints\s*\+=/.test(treasureJs)
    },
    {
      name: 'Scene unlock flow avoids direct points storage mutation when possible',
      ok: /addGrowthPoints\(-scene\.unlock_cost\)/.test(explorationJs)
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
