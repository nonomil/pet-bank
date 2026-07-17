import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const indexSource = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(repoRoot, 'js', 'app.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(repoRoot, 'js', 'pixel-story-map.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(repoRoot, 'css', 'style.css'), 'utf8');

const failures = [];
const expect = (condition, message) => {
    if (!condition) failures.push(message);
};

const homeModeMatches = [...indexSource.matchAll(/data-home-explore-mode="([^"]+)"/g)].map((match) => match[1]);
expect(
    homeModeMatches.join(',') === 'forest,sci-fi,block',
    `首页应只显示三张主地图切换，实际为 ${homeModeMatches.join(',') || '空'}`
);
expect(indexSource.includes('id="homePixelWorldMapSlot"'), '首页缺少像素世界地图渲染槽位');
expect(indexSource.includes('data-home-explore-mode="sci-fi"'), '首页缺少科幻地图入口');
expect(indexSource.includes('data-home-explore-mode="block"'), '首页缺少方块世界入口');
expect(appSource.includes("['forest', 'sci-fi', 'block', 'detective'].includes(mode)"), '首页地图模式校验未覆盖三张主地图与侦探 bonus');
expect(appSource.includes('homePixelWorldMapSlot'), '首页切换逻辑没有渲染像素世界地图槽位');
expect(mapSource.includes('var worldTracks = manifest.worlds || [];'), '像素世界地图应将三张主地图与 bonus 轨道分开');
expect(mapSource.includes('data-detective-bonus'), '像素世界地图缺少侦探小游戏 bonus 入口');
expect(styleSource.includes('.home-pixel-world-map-shell'), '首页像素世界地图缺少独立样式');

if (failures.length) {
    failures.forEach((message) => console.error(`FAIL ${message}`));
    process.exit(1);
}

console.log('PASS pixel worlds entry contract');
