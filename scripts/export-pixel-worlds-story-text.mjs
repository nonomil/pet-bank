import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packRoot = path.join(repoRoot, 'data', 'story-packs', '05-pixel-worlds-story');
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'manifest.json'), 'utf8'));
const outputPath = path.join(repoRoot, 'docs', '探索地图故事', '像素世界漫游', '01-80节点台词清单.md');

const characterNames = Object.fromEntries(
    Object.entries(manifest.characters || {}).map(([id, character]) => [id, character.name || id])
);
const tracks = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])];
const sections = [];
let lineCount = 0;

for (const track of tracks) {
    sections.push(`# 地图：${track.title}`);
    sections.push(`- 路线：${track.id}`);
    sections.push('');
    for (const node of [...(track.nodes || [])].sort((a, b) => (a.order || 99) - (b.order || 99))) {
        const levelPath = path.join(packRoot, 'levels', `${node.levelId}.json`);
        const level = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
        sections.push(`## ${node.levelId} ${level.title || node.label || ''}`.trim());
        sections.push('');
        for (const scene of level.scenes || []) {
            for (const line of scene.lines || []) {
                const text = String(line.text || line.prompt || '').trim();
                if (!text) continue;
                lineCount += 1;
                const speaker = characterNames[line.character] || (line.type === 'activity' ? '互动提示' : '故事文本');
                sections.push(`- **${speaker}**：${text}`);
                if (line.type === 'activity') {
                    for (const action of line.actions || []) {
                        if (action.label) sections.push(`  - 选项：${action.label}`);
                        if (action.feedback) sections.push(`    - 反馈：${action.feedback}`);
                    }
                }
            }
        }
        sections.push('');
    }
}

const header = [
    '# 像素世界漫游：80 节点台词清单',
    '',
    '> 本文由 `data/story-packs/05-pixel-worlds-story/levels/*.json` 生成，运行时 JSON 是唯一文本源。',
    '> 朗读音频由 `scripts/generate-pixel-story-tts.py` 使用 VoxCPM2 生成，映射见 `data/story-packs/05-pixel-worlds-story/audio-manifest.json`。',
    '',
    `共 ${tracks.reduce((count, track) => count + (track.nodes || []).length, 0)} 个节点，${lineCount} 段朗读文本。`,
    '',
];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, [...header, ...sections].join('\n') + '\n', 'utf8');
console.log(`WROTE ${outputPath}: ${lineCount} readable lines`);
