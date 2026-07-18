import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/learn-center.js', 'utf8');
const styles = fs.readFileSync('css/learn-center.css', 'utf8');

assert.match(source, /class="learn-demo-sidebar"/, 'learning hub should render the demo-style left sidebar');
assert.match(source, /class="learn-demo-main"/, 'learning hub should render the demo-style middle area');
assert.match(source, /class="learn-demo-right-rail"/, 'learning hub should render the demo-style right progress rail');
assert.match(source, /class="learn-demo-focus-grid"/, 'today tab should render a main focus card and completion card');
assert.match(source, /class="learn-demo-resource-grid"/, 'today tab should render three compact resource cards');
assert.match(source, /picturebooks:\s*\{[\s\S]*?label:\s*'绘本阅读'/, 'learning hub should keep picturebooks in sidebar metadata');
assert.match(source, /Object\.entries\(hubTabMeta\)\.map/, 'learning hub should render sidebar tabs from metadata');
assert.match(styles, /\.learn-demo-workspace\s*\{/, 'learning hub should define the demo-style three-column layout');
assert.match(styles, /grid-template-columns:\s*220px\s+minmax\(0, 1fr\)\s+280px/, 'learning workspace should reserve demo left, middle, and right columns');
assert.match(styles, /\.learn-demo-right-rail\s*\{/, 'learning workspace should style the personal progress rail');

console.log('PASS learning workspace contract');
