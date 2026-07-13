import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');

assert.match(index, /id="homeExplorePanel"/, 'home page exposes the exploration switcher');
assert.match(index, /data-home-explore-mode="forest"/, 'home page exposes the forest route');
assert.match(index, /id="sceneGridMap"/, 'home page contains the forest map board');
assert.match(index, /data-home-explore-mode="story"/, 'home page exposes story roaming');
assert.match(index, /data-home-explore-mode="detective"/, 'home page exposes the detective story');
assert.match(app, /function openHomeExploreMode\(mode\)/, 'home exploration modes have one navigation entry point');
assert.match(app, /ExplorationSystem\.renderSceneGridMap\(null, 'sceneGridMap'\)/, 'forest map renders on the home board');
assert.match(app, /data-home-explore-mode/, 'home exploration buttons receive active-state updates');
assert.match(runtime, /map:\s*\['js\/exploration\.js'\]/, 'map page loads the forest exploration runtime');
assert.match(runtime, /case 'map':[\s\S]{0,80}ensureMapFeature\(\)/, 'map page uses the dedicated map feature');
assert.match(css, /\.space-growth-map-shell\s*\{[\s\S]*?--pixel-ink:/, 'detective shell declares the story visual tokens');
assert.match(css, /\.space-growth-map-header h2[\s\S]*?var\(--pixel-ink\)/, 'detective heading uses the story ink color');

console.log('PASS exploration mode contract');
