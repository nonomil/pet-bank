import assert from 'node:assert/strict';
import fs from 'node:fs';

const shop = fs.readFileSync('js/shop.js', 'utf8');
const inventory = fs.readFileSync('js/inventory.js', 'utf8');
const home = fs.readFileSync('js/home.js', 'utf8');

assert.match(shop, /function spendGrowthPoints|const spendGrowthPoints/, 'shop must use a dedicated spend operation');
assert.match(shop, /await inventory\.loadItemsData\(\)/, 'inventory purchases must wait for item definitions');
const inventoryPurchase = shop.match(/if \(item\.toInventory\)[\s\S]*?return true;/)?.[0] || '';
assert.match(inventoryPurchase, /inventory\.addItem\(item\.id, 1\)/, 'inventory purchase must grant through the inventory owner');
assert.match(inventoryPurchase, /inventory\.addItem\(item\.id, 1\)[\s\S]*?spendGrowthPoints\(item\.price\)/, 'inventory grant must succeed before points are spent');
assert.match(shop, /adjustGrowthPoints\(box\.price\)/, 'failed blind-box grants must refund the box price');
assert.match(inventory, /available <= 0\) return \{ success: false/, 'full stacks must fail instead of reporting a false success');
assert.match(inventory, /added, msg/, 'inventory grants must report the actual quantity added');
assert.match(home, /function removeFurnitureOwnership\(furnId\)/, 'furniture purchases need a rollback owner');

console.log('PASS shop transaction contract');
