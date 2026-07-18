import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const storyPage = fs.readFileSync(path.join(root, 'js', 'pixel-story-page.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');

assert.doesNotMatch(index, /id="homeExplorePanel"|id="sceneGridMap"/, 'home page does not embed the forest map');
assert.doesNotMatch(app, /renderHomeExploreMap|renderSceneGridMap\(null, 'sceneGridMap'\)/, 'home page does not render the forest map');
assert.match(app, /function renderPixelStoryExplorePage\(/, 'explore page has a card map renderer');
assert.match(index, /id="pixelStoryShell"/, 'explore page declares the pixel story shell');
assert.match(index, /id="page-forest-map"/, 'explore exposes a dedicated forest map page');
assert.match(index, /id="forestMapSceneGrid"/, 'forest page uses an independent map board');
assert.match(index, /id="exploreMapSwitcher"/, 'explore exposes a map switcher');
assert.match(storyPage, /PixelStoryPage/, 'explore page uses the fixed story page orchestrator');
assert.match(app, /page === 'forest-map' && window\.ExplorationSystem/, 'forest page has a dedicated activation path');
assert.match(runtime, /case 'forest-map':[\s\S]{0,80}ensureExploreFeature\(\)/, 'forest page loads the exploration runtime');
assert.match(runtime, /map:\s*\['js\/exploration\.js'\]/, 'map bundle remains available for the dedicated forest route');
assert.match(runtime, /case 'map':[\s\S]{0,80}ensureMapFeature\(\)/, 'map page uses the dedicated map feature');
assert.match(css, /\.space-growth-map-shell\s*\{[\s\S]*?--pixel-ink:/, 'detective shell declares the story visual tokens');
assert.match(css, /\.space-growth-map-header h2[\s\S]*?var\(--pixel-ink\)/, 'detective heading uses the story ink color');

console.log('PASS exploration mode contract');
