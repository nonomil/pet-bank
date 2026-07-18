import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const style = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const explorationDetail = fs.readFileSync(path.join(root, 'js', 'exploration-detail.js'), 'utf8');
const storyPage = fs.readFileSync(path.join(root, 'js', 'pixel-story-page.js'), 'utf8');

assert.doesNotMatch(index, /id="homeForestRouteHost"|id="sceneGridMap"/, 'home does not own the forest route host');
assert.match(index, /id="forestMapSceneGrid"/, 'forest route owns the forest map host');
assert.match(index, /id="pixelStoryMapHost"/, 'explore owns a fixed story map host');
assert.match(index, /id="pixelStoryChapterHost"/, 'explore owns a fixed chapter host');
assert.match(index, /id="explorationStageRoot"/, 'dialogue owns a fixed stage host');
assert.doesNotMatch(index, /home-demo-original-content/, 'home must not nest the legacy dashboard wrapper');
assert.doesNotMatch(index, /homePixelWorldMapSlot/, 'home must not contain the retired pixel map slot');
assert.doesNotMatch(index, /data-home-explore-mode/, 'home must not contain the retired mode switcher');
assert.doesNotMatch(app, /pageExplore\.innerHTML\s*=/, 'app must not replace the explore page root');
assert.doesNotMatch(app, /function ensureExploreMapShell\s*\(/, 'app must not own a second explore shell');
assert.doesNotMatch(style, /home-explore-modebar|home-pixel-world-map-shell|home-demo-original-content/, 'style must not keep retired home explore shells');
assert.match(explorationDetail, /hostId/, 'dialogue stage accepts an explicit host');
assert.match(storyPage, /PixelStoryPage/, 'story page owns fixed explore hosts');
assert.match(storyPage, /pixelStoryMapHost/, 'story page activates the map host');

console.log('PASS home/explore DOM ownership contract');
