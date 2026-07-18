import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const indexSource = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'js', 'app.js'), 'utf8');
const storyPageSource = fs.readFileSync(path.join(repoRoot, 'js', 'pixel-story-page.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(repoRoot, 'js', 'pixel-story-map.js'), 'utf8');
const pixelStyleSource = fs.readFileSync(path.join(repoRoot, 'css', 'pixel-story.css'), 'utf8');

const failures = [];
const expect = (condition, message) => {
    if (!condition) failures.push(message);
};

expect(!indexSource.includes('data-home-explore-mode='), '首页不应再嵌入像素世界切换器');
expect(!indexSource.includes('id="homePixelWorldMapSlot"'), '首页不应再嵌入像素世界地图槽位');
expect(appSource.includes('function renderPixelStoryExplorePage'), '探索页必须保留像素世界地图渲染器');
expect(indexSource.includes('id="pixelStoryShell"'), '探索页必须声明独立像素故事壳');
expect(storyPageSource.includes('pixelStoryMapHost'), '探索页必须使用固定地图宿主');
expect(pixelStyleSource.includes('#page-explore .pixel-story-shell'), '探索页故事壳必须使用专属样式');
expect(mapSource.includes('var worldTracks = manifest.worlds || [];'), '像素世界地图应将三张主地图与 bonus 轨道分开');
expect(mapSource.includes('data-detective-bonus'), '像素世界地图缺少侦探小游戏 bonus 入口');

if (failures.length) {
    failures.forEach((message) => console.error(`FAIL ${message}`));
    process.exit(1);
}

console.log('PASS pixel worlds entry contract');
